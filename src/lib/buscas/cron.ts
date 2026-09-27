import { loadConfig } from "@/lib/config";
import { QuotaExceededError, UserQuotaExceededError } from "@/lib/costs";
import type { AppDb } from "@/lib/firestore-like";
import { geocodeRegion } from "@/lib/geo/geocode";
import { getLead, upsertLeads } from "@/lib/leads/repo";
import { searchText } from "@/lib/places/client";
import { getUsuario } from "@/lib/usuarios";
import type { CronEstado, CronEtapa, CronFalha } from "./cron-estado";
import { recalcularPenetracaoBuscas } from "./penetracao";
import { listBuscasRecorrentes, registrarExecucao } from "./repo";
import type { Busca } from "./types";

/**
 * Execução diária das buscas recorrentes (rota /api/cron, Vercel Cron).
 * Mesmo pipeline da busca manual — geocode com cache, searchText com
 * reserveQuota por página, upsert que não rebaixa — reaproveitando o
 * buscaId do grupo (os leads novos entram no MESMO grupo da busca).
 *
 * Atribuição: a busca recorrente conta no usuário que a MARCOU como
 * recorrente (busca.userId), resolvido aqui por id (sem sessão HTTP). Busca
 * sem userId (legada) roda sem cota individual, só sob o teto global — como
 * antes desta feature.
 */

export const CRON_COLLECTION = "cron";
export const CRON_ULTIMA_DOC = "ultima";

export interface CronBuscaResumo {
  buscaId: string;
  nome: string;
  novos: number;
  existentes: number;
  /** Google falhou NESTA busca (não é cota) — as seguintes continuam. */
  erro?: string;
  /** Dono estourou o limite individual: esta busca foi pulada, a fila SEGUE. */
  pulada?: string;
}

/** Resumo da última rodada do cron — doc único /cron/ultima (sobrescrito). */
export interface CronExecucao {
  em: string;
  /**
   * `rodando` do início até o fim; `ok` ou `falhou` depois. Ausente em
   * docs de antes deste campo (só eram gravados em rodada bem-sucedida) =
   * `ok`. Ver `situacaoCron` em ./cron-estado.
   */
  estado?: CronEstado;
  /** Ausente enquanto `rodando`. */
  concluidaEm?: string;
  /** Quantas buscas estavam marcadas como recorrentes (antes do teto). */
  recorrentes: number;
  buscas: CronBuscaResumo[];
  totalNovos: number;
  totalExistentes: number;
  /** Cota estourou no meio: a rodada PAROU aqui (fila determinística). */
  interrompida?: { buscaId?: string; nome?: string; motivo: string };
  /**
   * Só com `estado: "falhou"`: a etapa em que a rodada parou, a mensagem e
   * o instante. `buscas`/totais guardam o que andou ANTES da falha.
   */
  falha?: CronFalha;
}

// Firestore rejeita undefined como valor; round-trip JSON descarta as chaves.
function toDoc(execucao: CronExecucao): Record<string, unknown> {
  return JSON.parse(JSON.stringify(execucao)) as Record<string, unknown>;
}

async function gravarUltima(db: AppDb, execucao: CronExecucao): Promise<void> {
  await db.collection(CRON_COLLECTION).doc(CRON_ULTIMA_DOC).set(toDoc(execucao));
}

export async function getUltimaExecucaoCron(db: AppDb): Promise<CronExecucao | null> {
  const snap = await db.collection(CRON_COLLECTION).doc(CRON_ULTIMA_DOC).get();
  const data = snap.exists ? snap.data() : undefined;
  return data ? (data as unknown as CronExecucao) : null;
}

/**
 * Uma rodada inteira. Nada escapa sem rastro em /cron/ultima:
 *
 * 1. antes de tudo, grava `estado: "rodando"` — se a função for MORTA no
 *    meio (estouro do maxDuration: a Vercel encerra o processo, nenhum
 *    catch roda), o painel vê um "rodando" velho e o mostra como "não
 *    concluiu", em vez de continuar exibindo a última rodada boa;
 * 2. qualquer exceção, em qualquer etapa (config, fila, penetração,
 *    gravação), grava `estado: "falhou"` com a etapa, a mensagem, o
 *    instante e o progresso até ali — e é RELANÇADA (a rota responde 500,
 *    e o log da Vercel registra a invocação como falha).
 *
 * Cota estourada NÃO é falha da rodada: `QuotaExceededError` interrompe a
 * fila de propósito (recurso compartilhado) e a rodada termina `ok` com
 * `interrompida` — como sempre foi.
 */
export async function executarBuscasRecorrentes(
  db: AppDb,
  now: Date = new Date(),
): Promise<CronExecucao> {
  const em = now.toISOString();
  let etapa: CronEtapa = "inicio";
  // Progresso visível ao catch: numa falha, o registro diz o que já andou.
  let recorrentesTotal = 0;
  const resumos: CronBuscaResumo[] = [];
  // Buscas que chegaram ao fim do pipeline — a penetração delas é
  // recalculada UMA vez, depois do laço (ver recalcularPenetracaoBuscas).
  const concluidas: string[] = [];
  let totalNovos = 0;
  let totalExistentes = 0;
  let interrompida: CronExecucao["interrompida"];

  try {
    await gravarUltima(db, {
      em,
      estado: "rodando",
      recorrentes: 0,
      buscas: [],
      totalNovos: 0,
      totalExistentes: 0,
    });

    etapa = "config";
    const config = await loadConfig(db);
    etapa = "fila";
    const recorrentes = await listBuscasRecorrentes(db);
    recorrentesTotal = recorrentes.length;
    // Teto de recorrentes simultâneas: o PATCH já recusa ligar acima dele,
    // mas o teto pode ter sido REDUZIDO depois — o recorte vale sempre.
    const fila = recorrentes.slice(0, Math.max(config.maxBuscasRecorrentes, 0));

    etapa = "buscas";
    for (const busca of fila) {
      try {
        const { criados, existentes, aviso } = await executarBusca(db, busca, config.caps, now);
        resumos.push({
          buscaId: busca.id,
          nome: busca.nome,
          novos: criados,
          existentes,
          ...(aviso?.startsWith("limite individual") && { pulada: aviso }),
        });
        totalNovos += criados;
        totalExistentes += existentes;
        concluidas.push(busca.id);
        // Teto GLOBAL estourado da 2ª página em diante: searchText devolve o
        // parcial (já pago) com aviso — registra e PARA a fila (recurso
        // compartilhado, afeta todo mundo). O limite INDIVIDUAL do dono não
        // interrompe — só esta busca ficou incompleta, a fila segue.
        if (aviso?.startsWith("teto mensal")) {
          interrompida = { buscaId: busca.id, nome: busca.nome, motivo: aviso };
          break;
        }
      } catch (error) {
        if (error instanceof UserQuotaExceededError) {
          // Nada foi pago (página 0): o limite é do DONO desta busca, não um
          // recurso global — pula só ela e a fila continua para as demais.
          resumos.push({
            buscaId: busca.id,
            nome: busca.nome,
            novos: 0,
            existentes: 0,
            pulada: error.message,
          });
          continue;
        }
        if (error instanceof QuotaExceededError) {
          // Nada desta busca foi pago nem gravado; a fila para aqui.
          interrompida = { buscaId: busca.id, nome: busca.nome, motivo: error.message };
          break;
        }
        // Erro do Google (ou inesperado) nesta busca: registra e segue —
        // uma região com problema não pode travar as demais.
        resumos.push({
          buscaId: busca.id,
          nome: busca.nome,
          novos: 0,
          existentes: 0,
          erro: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Penetração no fim da rodada, não por busca: cada recálculo varre
    // /buscas e /leads inteiras, e N varreduras por rodada faziam o cron
    // estourar o tempo com a base crescendo. Roda também quando a fila foi
    // interrompida por cota — o que rodou antes da interrupção é recalculado.
    etapa = "penetracao";
    await recalcularPenetracaoBuscas(db, concluidas);

    etapa = "registro";
    const execucao: CronExecucao = {
      em,
      estado: "ok",
      concluidaEm: new Date().toISOString(),
      recorrentes: recorrentesTotal,
      buscas: resumos,
      totalNovos,
      totalExistentes,
      ...(interrompida && { interrompida }),
    };
    await gravarUltima(db, execucao);
    return execucao;
  } catch (error) {
    const falhaEm = new Date().toISOString();
    const execucao: CronExecucao = {
      em,
      estado: "falhou",
      concluidaEm: falhaEm,
      recorrentes: recorrentesTotal,
      buscas: resumos,
      totalNovos,
      totalExistentes,
      ...(interrompida && { interrompida }),
      falha: {
        etapa,
        mensagem: error instanceof Error ? error.message : String(error),
        em: falhaEm,
      },
    };
    try {
      await gravarUltima(db, execucao);
    } catch (erroAoRegistrar) {
      // O próprio Firestore caiu: não há onde gravar. Fica o log, e o
      // marcador "rodando" (se chegou a ser gravado) envelhece até o
      // painel mostrá-lo como "não concluiu".
      console.error("[cron] falha ao registrar a falha da rodada:", erroAoRegistrar);
    }
    throw error;
  }
}

/** Uma busca recorrente: mesmo pipeline do POST /api/search. */
async function executarBusca(
  db: AppDb,
  busca: Busca,
  caps: Awaited<ReturnType<typeof loadConfig>>["caps"],
  now: Date,
): Promise<{ criados: number; existentes: number; aviso?: string }> {
  // Conta no dono que marcou a busca como recorrente — resolvido por id
  // (sem sessão HTTP no cron). Sem userId (busca legada) ou dono sumido:
  // roda sem cota individual, só sob o teto global, como antes.
  const dono = busca.userId ? await getUsuario(db, busca.userId) : undefined;
  const isAdmin = dono?.papel === "admin";
  const geo = await geocodeRegion(db, busca.regiao, caps, { userId: dono?.id, isAdmin });
  const query = [busca.nicho, busca.subNicho, busca.regiao].filter(Boolean).join(" ");
  const resultado = await searchText(db, query, caps, {
    quantidade: busca.quantidade,
    qualificada: busca.qualificada,
    soSemSite: busca.soSemSite,
    locationRestriction: geo.viewport,
    isNovo: async (placeId) => !(await getLead(db, placeId)),
    userId: dono?.id,
    isAdmin,
    limitesUsuario: dono?.limites,
  });
  const { criados, existentes } = await upsertLeads(
    db,
    resultado.places,
    { nicho: busca.nicho, subNicho: busca.subNicho, regiao: busca.regiao },
    busca.id,
    now,
  );
  await registrarExecucao(db, busca.id, {
    em: now.toISOString(),
    novos: criados,
    existentes,
  });
  // A penetração do grupo NÃO é recalculada aqui: o laço de
  // executarBuscasRecorrentes recalcula todas as concluídas de uma vez, no
  // fim da rodada.
  return { criados, existentes, aviso: resultado.aviso };
}
