import { createHash } from "node:crypto";

import { normalizarGrupo } from "@/lib/buscas/penetracao";
import { execucoesCollection, type Busca, type BuscaExecucao } from "@/lib/buscas/types";
import { skinsDoNicho } from "@/lib/demos/nicho";
import type { AppDb } from "@/lib/firestore-like";

import type { AutomacaoConfig } from "./config";

/**
 * Os PARES (nicho, região) que a automação pode buscar — a segunda fonte de
 * trabalho, quando os leads existentes não bastam. Nenhum par é inventado:
 * todos saem das buscas que o OPERADOR já fez.
 *
 * - O sub-nicho é ignorado e o agrupamento usa a MESMA régua de
 *   "neste nicho nesta cidade" da penetração (`normalizarGrupo`).
 * - Só nicho com skin: buscar nicho sem skin gasta cota para lead que
 *   nunca vira demo.
 * - Cada par tem UM doc de busca da automação (`origem: "automacao"`, id
 *   determinístico), criado no primeiro uso e reexecutado depois — a
 *   subcoleção `execucoes` dele é a série histórica de quantos leads novos
 *   o par trouxe, e é dela que sai a saturação.
 */

export interface ParBusca {
  /** `nicho|regiao` normalizados — a identidade do par. */
  chave: string;
  /** Texto do nicho como o operador digitou na busca mais recente do par. */
  nicho: string;
  regiao: string;
  /** Todas as buscas do grupo — do operador E a da automação. */
  buscas: Busca[];
}

export function chavePar(nicho: string, regiao: string): string {
  return `${normalizarGrupo(nicho)}|${normalizarGrupo(regiao)}`;
}

/** Id do doc de busca da automação para o par — o mesmo em toda noite. */
export function idBuscaAutomacao(chave: string): string {
  return `automacao-${createHash("sha1").update(chave).digest("hex").slice(0, 16)}`;
}

/** Pura: agrupa as buscas em pares, só os que têm busca do operador e skin. */
export function paresDasBuscas(buscas: Busca[]): ParBusca[] {
  const grupos = new Map<string, Busca[]>();
  for (const busca of buscas) {
    if (!busca.nicho?.trim() || !busca.regiao?.trim()) continue;
    const chave = chavePar(busca.nicho, busca.regiao);
    grupos.set(chave, [...(grupos.get(chave) ?? []), busca]);
  }
  const pares: ParBusca[] = [];
  for (const [chave, doGrupo] of grupos) {
    const doOperador = doGrupo
      .filter((b) => b.origem !== "automacao")
      .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
    const referencia = doOperador[0];
    if (!referencia) continue;
    if (skinsDoNicho(referencia.nicho).length === 0) continue;
    pares.push({ chave, nicho: referencia.nicho.trim(), regiao: referencia.regiao.trim(), buscas: doGrupo });
  }
  return pares.sort((a, b) => a.chave.localeCompare(b.chave));
}

/**
 * Saturado: o par já rodou pela automação pelo menos `saturacaoExecucoes`
 * vezes e as últimas `saturacaoExecucoes`, SOMADAS, trouxeram menos que
 * `saturacaoMinNovos` leads novos (padrão: 3 execuções, menos de 3 novos —
 * média abaixo de um lead novo por noite). A área esgotou; buscar de novo
 * é pagar página para ver repetido. `execucoes` em ordem decrescente.
 */
export function parSaturado(
  execucoesDesc: BuscaExecucao[],
  config: Pick<AutomacaoConfig, "saturacaoExecucoes" | "saturacaoMinNovos">,
): boolean {
  const janela = config.saturacaoExecucoes;
  if (janela <= 0 || execucoesDesc.length < janela) return false;
  const novos = execucoesDesc.slice(0, janela).reduce((soma, e) => soma + (e.novos ?? 0), 0);
  return novos < config.saturacaoMinNovos;
}

/** Houve execução do par (qualquer máquina) nas últimas `horas`? */
export function parRecente(ultimaEm: string | undefined, now: Date, horas: number): boolean {
  if (!ultimaEm || horas <= 0) return false;
  const t = new Date(ultimaEm).getTime();
  return Number.isFinite(t) && now.getTime() - t < horas * 3600_000;
}

async function execucoesDe(db: AppDb, buscaId: string): Promise<BuscaExecucao[]> {
  const { docs } = await db.collection(execucoesCollection(buscaId)).get();
  return docs
    .map((doc) => doc.data() as unknown as BuscaExecucao)
    .filter((e) => typeof e.em === "string")
    .sort((a, b) => b.em.localeCompare(a.em));
}

export interface HistoricoPar {
  /** A execução mais recente do par, de QUALQUER máquina (criação manual, cron, automação). */
  ultimaEm?: string;
  /** As execuções do doc da automação, mais recente primeiro. */
  execucoesAutomacao: BuscaExecucao[];
}

/**
 * O histórico de um par. Só lê a subcoleção `execucoes` de quem pode ter
 * uma — busca recorrente (o cron da Vercel) e o doc da automação; busca
 * manual só tem a data de criação.
 */
export async function historicoDoPar(db: AppDb, par: ParBusca): Promise<HistoricoPar> {
  const idAutomacao = idBuscaAutomacao(par.chave);
  let ultimaEm: string | undefined;
  let execucoesAutomacao: BuscaExecucao[] = [];
  const marcar = (em: string | undefined) => {
    if (em && (!ultimaEm || em > ultimaEm)) ultimaEm = em;
  };
  for (const busca of par.buscas) {
    marcar(busca.criadaEm);
    if (busca.recorrente !== true && busca.origem !== "automacao") continue;
    const execucoes = await execucoesDe(db, busca.id);
    marcar(execucoes[0]?.em);
    if (busca.id === idAutomacao) execucoesAutomacao = execucoes;
  }
  return { ultimaEm, execucoesAutomacao };
}

export interface EscolhaPar {
  par?: ParBusca;
  /** Por que os outros pares ficaram de fora — vai para o registro da unidade. */
  descartados: { saturados: string[]; recentes: string[]; jaTentados: string[] };
}

/**
 * O próximo par a buscar. Rodízio, não sorteio: entre os que servem, o que
 * a automação buscou há MAIS tempo vai primeiro (nunca buscado antes de
 * todos), desempate pela chave — toda área tem a vez antes de alguma
 * repetir.
 */
export async function escolherPar(
  db: AppDb,
  buscas: Busca[],
  config: AutomacaoConfig,
  now: Date,
  jaTentados: readonly string[],
): Promise<EscolhaPar> {
  const descartados: EscolhaPar["descartados"] = { saturados: [], recentes: [], jaTentados: [] };
  const aptos: Array<{ par: ParBusca; ultimaAutomacao: string }> = [];
  for (const par of paresDasBuscas(buscas)) {
    if (jaTentados.includes(par.chave)) {
      descartados.jaTentados.push(par.chave);
      continue;
    }
    const historico = await historicoDoPar(db, par);
    if (parSaturado(historico.execucoesAutomacao, config)) {
      descartados.saturados.push(par.chave);
      continue;
    }
    if (parRecente(historico.ultimaEm, now, config.intervaloParHoras)) {
      descartados.recentes.push(par.chave);
      continue;
    }
    aptos.push({ par, ultimaAutomacao: historico.execucoesAutomacao[0]?.em ?? "" });
  }
  aptos.sort(
    (a, b) => a.ultimaAutomacao.localeCompare(b.ultimaAutomacao) || a.par.chave.localeCompare(b.par.chave),
  );
  return { par: aptos[0]?.par, descartados };
}
