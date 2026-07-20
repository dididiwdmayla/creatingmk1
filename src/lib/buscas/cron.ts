import { loadConfig } from "@/lib/config";
import { QuotaExceededError } from "@/lib/costs";
import type { AppDb } from "@/lib/firestore-like";
import { geocodeRegion } from "@/lib/geo/geocode";
import { getLead, upsertLeads } from "@/lib/leads/repo";
import { searchText } from "@/lib/places/client";
import { listBuscasRecorrentes, registrarExecucao } from "./repo";
import type { Busca } from "./types";

/**
 * Execução diária das buscas recorrentes (rota /api/cron, Vercel Cron).
 * Mesmo pipeline da busca manual — geocode com cache, searchText com
 * reserveQuota por página, upsert que não rebaixa — reaproveitando o
 * buscaId do grupo (os leads novos entram no MESMO grupo da busca).
 * Sem usuário: o cron não carimba userId nem quebra porUsuario.
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
}

/** Resumo da última rodada do cron — doc único /cron/ultima (sobrescrito). */
export interface CronExecucao {
  em: string;
  concluidaEm: string;
  /** Quantas buscas estavam marcadas como recorrentes (antes do teto). */
  recorrentes: number;
  buscas: CronBuscaResumo[];
  totalNovos: number;
  totalExistentes: number;
  /** Cota estourou no meio: a rodada PAROU aqui (fila determinística). */
  interrompida?: { buscaId?: string; nome?: string; motivo: string };
}

// Firestore rejeita undefined como valor; round-trip JSON descarta as chaves.
function toDoc(execucao: CronExecucao): Record<string, unknown> {
  return JSON.parse(JSON.stringify(execucao)) as Record<string, unknown>;
}

export async function getUltimaExecucaoCron(db: AppDb): Promise<CronExecucao | null> {
  const snap = await db.collection(CRON_COLLECTION).doc(CRON_ULTIMA_DOC).get();
  const data = snap.exists ? snap.data() : undefined;
  return data ? (data as unknown as CronExecucao) : null;
}

export async function executarBuscasRecorrentes(
  db: AppDb,
  now: Date = new Date(),
): Promise<CronExecucao> {
  const em = now.toISOString();
  const config = await loadConfig(db);
  const recorrentes = await listBuscasRecorrentes(db);
  // Teto de recorrentes simultâneas: o PATCH já recusa ligar acima dele,
  // mas o teto pode ter sido REDUZIDO depois — o recorte vale sempre.
  const fila = recorrentes.slice(0, Math.max(config.maxBuscasRecorrentes, 0));

  const resumos: CronBuscaResumo[] = [];
  let totalNovos = 0;
  let totalExistentes = 0;
  let interrompida: CronExecucao["interrompida"];

  for (const busca of fila) {
    try {
      const { criados, existentes, aviso } = await executarBusca(db, busca, config.caps, now);
      resumos.push({ buscaId: busca.id, nome: busca.nome, novos: criados, existentes });
      totalNovos += criados;
      totalExistentes += existentes;
      // Teto estourado da 2ª página em diante: searchText devolve o
      // parcial (já pago) com aviso — registra e PARA a fila.
      if (aviso?.startsWith("teto mensal")) {
        interrompida = { buscaId: busca.id, nome: busca.nome, motivo: aviso };
        break;
      }
    } catch (error) {
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

  const execucao: CronExecucao = {
    em,
    concluidaEm: new Date().toISOString(),
    recorrentes: recorrentes.length,
    buscas: resumos,
    totalNovos,
    totalExistentes,
    ...(interrompida && { interrompida }),
  };
  await db.collection(CRON_COLLECTION).doc(CRON_ULTIMA_DOC).set(toDoc(execucao));
  return execucao;
}

/** Uma busca recorrente: mesmo pipeline do POST /api/search. */
async function executarBusca(
  db: AppDb,
  busca: Busca,
  caps: Awaited<ReturnType<typeof loadConfig>>["caps"],
  now: Date,
): Promise<{ criados: number; existentes: number; aviso?: string }> {
  const geo = await geocodeRegion(db, busca.regiao, caps);
  const query = [busca.nicho, busca.subNicho, busca.regiao].filter(Boolean).join(" ");
  const resultado = await searchText(db, query, caps, {
    quantidade: busca.quantidade,
    qualificada: busca.qualificada,
    locationRestriction: geo.viewport,
    isNovo: async (placeId) => !(await getLead(db, placeId)),
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
  return { criados, existentes, aviso: resultado.aviso };
}
