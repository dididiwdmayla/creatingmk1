import { loadConfig } from "@/lib/config";
import { enfileirarCapturas } from "@/lib/demos/capturas/enfileirar";
import type { DemoStorage } from "@/lib/demos/imagens";
import { ValidationError } from "@/lib/errors";
import { loadFilaConfig } from "@/lib/fila/config";
import type { AppDb } from "@/lib/firestore-like";
import { LEADS_COLLECTION, type Lead } from "@/lib/leads/types";

import { AUTOMACAO_USER_ID } from "./autor";
import { loadAutomacaoConfig, type AutomacaoConfig } from "./config";
import { leadsParaDemo } from "./elegivel";
import { calcularEstoque, estoqueDaBase, lerBaseEstoque, type Estoque } from "./estoque";
import {
  UNIDADE_PRAZO_MS,
  UNIDADE_TENTATIVAS_MAX,
  exigirTrava,
  execucaoRef,
  lerExecucao,
  lerExecucaoTx,
  novaTrava,
  paraDoc,
  travaAtiva,
  travaRef,
  ultimaRef,
  type ExecucaoAutomacao,
  type LoteCapturas,
  type Unidade,
} from "./execucao";
import { varrerDemosExpiradas, type ResultadoVarredura } from "./varredura";
import {
  faltaNaExecucao,
  processarUnidadeBusca,
  processarUnidadeDemo,
  type ContextoUnidade,
  type ResultadoUnidade,
} from "./unidades";

/**
 * O MOTOR da automação do estoque, em três atos — cada um uma chamada
 * curta do workflow (`scripts/automacao-ci.mjs`), bem dentro dos 300 s da
 * função: PLANEJAR uma vez, PASSO uma unidade por chamada até acabar,
 * FINALIZAR uma vez, sempre, com ou sem erro.
 */

/** Tamanho máximo de um lote de capturas — o `MAX_LOTE` de `/api/capturas`. */
export const LOTE_CAPTURAS = 60;

export interface Opcoes {
  now?: Date;
  novoId?: () => string;
  /**
   * Fábrica do Storage para a varredura das demos vencidas (a rota passa
   * `getDemoStorage`). Ausente, ou lançando: a varredura não roda — apagar
   * sem limpar as capturas deixaria arquivo órfão.
   */
  storage?: () => DemoStorage;
}

function semStorage(): DemoStorage {
  throw new Error("Storage não configurado nesta chamada");
}

function relogio(opcoes: Opcoes) {
  return {
    now: opcoes.now ?? new Date(),
    novoId: opcoes.novoId ?? (() => crypto.randomUUID()),
  };
}

function registroVazio(
  id: string,
  estado: ExecucaoAutomacao["estado"],
  config: AutomacaoConfig,
  disparo: string,
  runUrl: string | undefined,
  now: Date,
): ExecucaoAutomacao {
  const em = now.toISOString();
  return {
    id,
    estado,
    disparo,
    ...(runUrl && { runUrl }),
    iniciadaEm: em,
    atualizadaEm: em,
    alvo: config.alvoEstoque,
    falta: 0,
    unidades: [],
    demosCriadas: [],
    buscas: [],
    paresTentados: [],
    requisicoesBusca: 0,
    chamadasIA: 0,
    falhas: [],
  };
}

async function gravarEncerrada(db: AppDb, execucao: ExecucaoAutomacao): Promise<void> {
  await execucaoRef(db, execucao.id).set(paraDoc(execucao));
  await ultimaRef(db).set({ execucaoId: execucao.id, estado: execucao.estado, em: execucao.atualizadaEm });
}

/* ── PLANEJAR ─────────────────────────────────────────────────────────── */

export interface ResultadoPlanejar {
  acao: "executar" | "nada" | "recusada";
  execucaoId: string;
  motivo?: string;
  estoque?: Estoque;
  falta?: number;
  unidades?: number;
  execucaoAtiva?: string;
  /** A varredura das demos vencidas desta execução — vai para o log do workflow. */
  varredura?: ResultadoVarredura;
}

export async function planejar(
  db: AppDb,
  entrada: { disparo?: string; runUrl?: string } = {},
  opcoes: Opcoes = {},
): Promise<ResultadoPlanejar> {
  const { now, novoId } = relogio(opcoes);
  const config = await loadAutomacaoConfig(db);
  const disparo = entrada.disparo || "desconhecido";
  const id = novoId();

  const recusar = async (execucaoAtiva: string): Promise<ResultadoPlanejar> => {
    const motivo = `outra execução está ativa (${execucaoAtiva})`;
    const registro = { ...registroVazio(id, "recusada", config, disparo, entrada.runUrl, now), motivo, finalizadaEm: now.toISOString() };
    // Não mexe no ponteiro `ultima`: quem está rodando é a outra.
    await execucaoRef(db, id).set(paraDoc(registro));
    return { acao: "recusada", execucaoId: id, motivo, execucaoAtiva };
  };
  const nada = async (
    motivo: string,
    estoque?: Estoque,
    varredura?: ResultadoVarredura,
  ): Promise<ResultadoPlanejar> => {
    await gravarEncerrada(db, {
      ...registroVazio(id, "nada_a_fazer", config, disparo, entrada.runUrl, now),
      motivo,
      finalizadaEm: now.toISOString(),
      ...(estoque && { estoqueAntes: estoque }),
      ...(varredura && { varredura }),
    });
    return { acao: "nada", execucaoId: id, motivo, ...(estoque && { estoque }), ...(varredura && { varredura }) };
  };

  const trava = travaAtiva((await travaRef(db).get()).data(), now);
  if (trava) return recusar(trava.execucaoId);

  if (!config.ativo) return nada("automação desligada em /config/automacao");

  // A trava ANTES da varredura: duas execuções nunca apagam ao mesmo tempo.
  // De novo na transação que a toma: entre a leitura acima e aqui, outro
  // disparo pode ter planejado.
  const tomada = await db.runTransaction(async (tx) => {
    const atual = travaAtiva((await tx.get(travaRef(db))).data(), now);
    if (atual) return atual.execucaoId;
    tx.set(travaRef(db), { ...novaTrava(id, now) });
    return undefined;
  });
  if (tomada) return recusar(tomada);

  try {
    const lida = await lerBaseEstoque(db);
    // A varredura das demos vencidas, ANTES do estoque: a demo apagada deixa
    // de contar, e a mesma noite repõe. Ela devolve a lista de leads já com
    // as exclusões — nenhuma segunda leitura de `/leads`.
    const { resultado: varredura, leads } = await varrerDemosExpiradas(
      db,
      lida.leads,
      new Set(lida.envios.keys()),
      {
        now,
        prazoHoras: config.expiracaoDemoHoras,
        execucaoId: id,
        filaConfig: await loadFilaConfig(db),
        storage: opcoes.storage ?? semStorage,
      },
    );
    const base = { ...lida, leads };
    const estoque = estoqueDaBase(base, now);
    if (estoque.total >= config.alvoEstoque) {
      const resposta = await nada(`estoque ${estoque.total} ≥ alvo ${config.alvoEstoque}`, estoque, varredura);
      await liberarTrava(db, id, now);
      return resposta;
    }

    const falta = config.alvoEstoque - estoque.total;
    // Primeiro os leads que JÁ ESTÃO na base (nenhuma chamada paga); a busca
    // só entra no plano se eles não bastarem.
    const existentes = leadsParaDemo(base.leads, new Set(base.envios.keys()), config.corteLegado, falta);
    const unidades: Unidade[] = existentes.map((lead) => ({
      id: novoId(),
      tipo: "demo",
      leadId: lead.placeId,
      fonte: "existente",
      estado: "pendente",
      tentativas: 0,
    }));
    if (existentes.length < falta) {
      unidades.push({ id: novoId(), tipo: "busca", estado: "pendente", tentativas: 0 });
    }

    const plano: ExecucaoAutomacao = {
      ...registroVazio(id, "rodando", config, disparo, entrada.runUrl, now),
      estoqueAntes: estoque,
      falta,
      unidades,
      varredura,
    };
    // A trava é desta execução desde antes da varredura: o plano é gravado
    // sob ela.
    await execucaoRef(db, id).set(paraDoc(plano));
    await ultimaRef(db).set({ execucaoId: id, estado: "rodando", em: plano.iniciadaEm });
    return { acao: "executar", execucaoId: id, estoque, falta, unidades: unidades.length, varredura };
  } catch (erro) {
    // Sem plano gravado, ninguém liberaria a trava antes de ela vencer — e
    // um "rodar agora" logo depois seria recusado à toa.
    await liberarTrava(db, id, now);
    throw erro;
  }
}

/** Libera a trava — só se ainda for desta execução. */
async function liberarTrava(db: AppDb, execucaoId: string, now: Date): Promise<void> {
  const em = now.toISOString();
  await db.runTransaction(async (tx) => {
    const trava = travaAtiva((await tx.get(travaRef(db))).data(), now);
    if (trava && trava.execucaoId !== execucaoId) return;
    tx.set(travaRef(db), { execucaoId: "", expiraEm: em, liberadaEm: em });
  });
}

/* ── PASSO ────────────────────────────────────────────────────────────── */

export interface ResultadoPasso {
  temTrabalho: boolean;
  /** Só resta unidade rodando noutra chamada: espere antes de perguntar de novo. */
  esperarSegundos?: number;
  unidade?: { id: string; tipo: Unidade["tipo"]; estado: string; motivo?: string };
  motivo?: string;
}

function morta(unidade: Unidade, now: Date): boolean {
  if (unidade.estado !== "rodando" || !unidade.iniciadaEm) return false;
  return now.getTime() - new Date(unidade.iniciadaEm).getTime() > UNIDADE_PRAZO_MS;
}

function haTrabalho(execucao: ExecucaoAutomacao): boolean {
  return execucao.unidades.some((u) => u.estado === "pendente" || u.estado === "rodando");
}

export async function passo(db: AppDb, execucaoId: string, opcoes: Opcoes = {}): Promise<ResultadoPasso> {
  const { now, novoId } = relogio(opcoes);
  const em = now.toISOString();

  const escolha = await db.runTransaction(async (tx) => {
    const execucao = await lerExecucaoTx(tx, db, execucaoId);
    if (execucao.estado !== "rodando") return { tipo: "encerrada" as const, execucao };
    await exigirTrava(tx, db, execucaoId, now);

    let mudou = false;
    for (const unidade of execucao.unidades) {
      if (morta(unidade, now) && unidade.tentativas >= UNIDADE_TENTATIVAS_MAX) {
        unidade.estado = "falhou";
        unidade.motivo = `a função morreu no meio ${unidade.tentativas} vez(es)`;
        unidade.concluidaEm = em;
        execucao.falhas.push({
          unidadeId: unidade.id,
          tipo: unidade.tipo,
          ...(unidade.tipo === "demo" && { leadId: unidade.leadId }),
          motivo: unidade.motivo,
          em,
        });
        mudou = true;
      }
    }
    const alvo = execucao.unidades.find((u) => u.estado === "pendente" || morta(u, now));
    // Sinal de vida: a trava anda junto com o laço.
    tx.set(travaRef(db), { ...novaTrava(execucaoId, now) });
    if (!alvo) {
      if (mudou) tx.set(execucaoRef(db, execucaoId), paraDoc({ ...execucao, atualizadaEm: em }));
      const viva = execucao.unidades.find((u) => u.estado === "rodando");
      if (!viva?.iniciadaEm) return { tipo: "fim" as const, execucao };
      const falta = UNIDADE_PRAZO_MS - (now.getTime() - new Date(viva.iniciadaEm).getTime());
      return { tipo: "esperar" as const, segundos: Math.max(Math.ceil(falta / 1000), 1), execucao };
    }
    alvo.estado = "rodando";
    alvo.tentativas += 1;
    alvo.iniciadaEm = em;
    tx.set(execucaoRef(db, execucaoId), paraDoc({ ...execucao, atualizadaEm: em }));
    return { tipo: "unidade" as const, execucao, unidade: structuredClone(alvo) };
  });

  if (escolha.tipo === "encerrada") return { temTrabalho: false, motivo: `execução ${escolha.execucao.estado}` };
  if (escolha.tipo === "fim") return { temTrabalho: false, motivo: "sem unidades pendentes" };
  if (escolha.tipo === "esperar") {
    return { temTrabalho: true, esperarSegundos: escolha.segundos, motivo: "unidade em andamento noutra chamada" };
  }

  const config = await loadAutomacaoConfig(db);
  const ctx: ContextoUnidade = {
    db,
    execucao: escolha.execucao,
    config,
    caps: (await loadConfig(db)).caps,
    now,
  };
  const { unidade } = escolha;
  let resultado: ResultadoUnidade;
  try {
    resultado =
      unidade.tipo === "demo"
        ? await processarUnidadeDemo(ctx, unidade)
        : await processarUnidadeBusca(ctx, unidade, novoId);
  } catch (erro) {
    // Falha de UMA unidade não derruba a execução: registra e segue.
    resultado = { estado: "falhou", motivo: erro instanceof Error ? erro.message : String(erro) };
  }

  const depois = await aplicarResultado(db, execucaoId, unidade.id, resultado, config, now, novoId);
  return {
    temTrabalho: haTrabalho(depois),
    unidade: {
      id: unidade.id,
      tipo: unidade.tipo,
      estado: resultado.estado,
      ...(resultado.motivo && { motivo: resultado.motivo }),
    },
  };
}

/**
 * Grava o resultado de UMA unidade e decide se cabe mais uma busca: sem
 * nada pendente, ainda faltando demo, com teto de busca sobrando e par
 * disponível, entra outra unidade "busca" (que vai tentar o próximo par).
 * É a mesma regra do plano — "se ainda faltar, uma busca" —, aplicada de
 * novo quando o plano acaba curto (leads pulados, par que trouxe pouco).
 */
async function aplicarResultado(
  db: AppDb,
  execucaoId: string,
  unidadeId: string,
  resultado: ResultadoUnidade,
  config: AutomacaoConfig,
  now: Date,
  novoId: () => string,
): Promise<ExecucaoAutomacao> {
  const em = now.toISOString();
  return db.runTransaction(async (tx) => {
    const execucao = await lerExecucaoTx(tx, db, execucaoId);
    const unidade = execucao.unidades.find((u) => u.id === unidadeId);
    if (unidade) {
      Object.assign(unidade, resultado.detalhes ?? {}, {
        estado: resultado.estado,
        concluidaEm: em,
        ...(resultado.motivo ? { motivo: resultado.motivo } : {}),
      });
      if (resultado.estado === "falhou") {
        execucao.falhas.push({
          unidadeId,
          tipo: unidade.tipo,
          ...(unidade.tipo === "demo" && { leadId: unidade.leadId }),
          motivo: resultado.motivo ?? "falha sem mensagem",
          em,
        });
      }
    }
    if (resultado.demoCriada && !execucao.demosCriadas.includes(resultado.demoCriada)) {
      execucao.demosCriadas.push(resultado.demoCriada);
    }
    if (resultado.busca) execucao.buscas.push(resultado.busca);
    if (resultado.parTentado && !execucao.paresTentados.includes(resultado.parTentado)) {
      execucao.paresTentados.push(resultado.parTentado);
    }
    if (resultado.novasUnidades) execucao.unidades.push(...resultado.novasUnidades);
    if (resultado.semPares) execucao.semPares = true;
    if (resultado.bloqueio) execucao.bloqueio = resultado.bloqueio;

    if (
      execucao.estado === "rodando" &&
      !execucao.semPares &&
      !haTrabalho(execucao) &&
      faltaNaExecucao(execucao) > 0
    ) {
      if (execucao.requisicoesBusca < config.tetoBuscasNoite) {
        execucao.unidades.push({ id: novoId(), tipo: "busca", estado: "pendente", tentativas: 0 });
      } else {
        execucao.bloqueio = "teto de requisições de busca da noite";
      }
    }

    const atualizada = { ...execucao, atualizadaEm: em };
    tx.set(execucaoRef(db, execucaoId), paraDoc(atualizada));
    return atualizada;
  });
}

/* ── FINALIZAR ────────────────────────────────────────────────────────── */

export interface EntradaFinalizar {
  execucaoId?: string;
  /** O laço morreu (ou falhou): a execução é gravada como falha, com isto. */
  erro?: string;
  /** Por que o laço parou (teto de iterações, erros seguidos…). */
  motivo?: string;
  disparo?: string;
  runUrl?: string;
}

/**
 * As demos automáticas que ainda NÃO pediram captura nenhuma. Lido da
 * fonte da verdade (o lead), não da lista do plano: uma unidade que morreu
 * DEPOIS de gravar a demo, ou que terminou depois de uma execução anterior
 * ser finalizada, também entra — sem isto a demo ficaria para sempre sem
 * print, fora do estoque e fora da fila.
 */
async function demosSemCaptura(db: AppDb): Promise<string[]> {
  const { docs } = await db.collection(LEADS_COLLECTION).get();
  return docs
    .map((doc) => doc.data() as unknown as Lead)
    .filter((lead) => lead.demo?.origem === "automacao" && !lead.capturas && lead.leadDeTeste !== true)
    .map((lead) => lead.placeId)
    .sort();
}

export async function finalizar(
  db: AppDb,
  entrada: EntradaFinalizar,
  opcoes: Opcoes = {},
): Promise<ExecucaoAutomacao> {
  const { now, novoId } = relogio(opcoes);
  const em = now.toISOString();

  if (!entrada.execucaoId) {
    // O laço morreu antes de existir plano (planejar deu 5xx, rede caiu): a
    // falha ainda assim vira registro — nunca silêncio, como era no cron antigo.
    if (!entrada.erro) throw new ValidationError(["execucaoId ou erro é obrigatório"]);
    const config = await loadAutomacaoConfig(db);
    const registro: ExecucaoAutomacao = {
      ...registroVazio(novoId(), "falhou", config, entrada.disparo || "desconhecido", entrada.runUrl, now),
      erro: entrada.erro,
      motivo: `erro antes do plano: ${entrada.erro}`,
      finalizadaEm: em,
    };
    await gravarEncerrada(db, registro);
    return registro;
  }

  const execucao = await lerExecucao(db, entrada.execucaoId);
  // Idempotente: finalizar duas vezes devolve o registro já fechado.
  if (execucao.estado !== "rodando") return execucao;

  // Capturas: UMA chamada de `enfileirarCapturas` por lote de até 60 — o
  // workflow de capturas processa o lote com um build só e continua sendo
  // o único dono dos estados de captura.
  const capturas: LoteCapturas[] = [];
  const alvos = await demosSemCaptura(db);
  for (let i = 0; i < alvos.length; i += LOTE_CAPTURAS) {
    const lote = alvos.slice(i, i + LOTE_CAPTURAS);
    try {
      const r = await enfileirarCapturas(db, lote, { userId: AUTOMACAO_USER_ID, agora: () => em });
      capturas.push({
        leads: lote.length,
        execucaoId: r.execucaoId,
        enfileirados: r.enfileirados.length,
        pulados: r.pulados.length,
      });
    } catch (erro) {
      capturas.push({ leads: lote.length, erro: erro instanceof Error ? erro.message : String(erro) });
    }
  }

  const estoqueDepois = await calcularEstoque(db, now);

  return db.runTransaction(async (tx) => {
    const atual = await lerExecucaoTx(tx, db, entrada.execucaoId as string);
    const trava = travaAtiva((await tx.get(travaRef(db))).data(), now);
    for (const unidade of atual.unidades) {
      if (unidade.estado === "pendente" || unidade.estado === "rodando") {
        unidade.estado = "nao_processada";
        unidade.motivo = "a execução foi finalizada antes desta unidade";
      }
    }
    const motivo = entrada.erro
      ? `erro: ${entrada.erro}`
      : (entrada.motivo ??
        (atual.demosCriadas.length >= atual.falta ? "alvo atingido" : (atual.bloqueio ?? "sem mais trabalho")));
    const fechada: ExecucaoAutomacao = {
      ...atual,
      estado: entrada.erro ? "falhou" : "concluida",
      ...(entrada.erro && { erro: entrada.erro }),
      motivo,
      capturas,
      estoqueDepois,
      finalizadaEm: em,
      atualizadaEm: em,
    };
    tx.set(execucaoRef(db, atual.id), paraDoc(fechada));
    // Libera a trava — só a DESTA execução; nunca a de outra que já a tomou.
    if (!trava || trava.execucaoId === atual.id) {
      tx.set(travaRef(db), { execucaoId: "", expiraEm: em, liberadaEm: em });
    }
    tx.set(ultimaRef(db), { execucaoId: atual.id, estado: fechada.estado, em });
    return fechada;
  });
}
