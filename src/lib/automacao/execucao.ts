import { ConflictError, NotFoundError } from "@/lib/errors";
import type { AppDb, UsageTransaction } from "@/lib/firestore-like";

import type { Estoque } from "./estoque";
import type { ResultadoVarredura } from "./varredura";

/**
 * O PLANO DA NOITE e o REGISTRO da execução — o mesmo doc,
 * `/automacaoExecucoes/{id}`. O planejador escreve o plano; cada passo
 * marca a sua unidade; o finalizar fecha o registro. Quem abrir o doc de
 * manhã vê as duas coisas lado a lado: o que era para fazer e o que saiu.
 *
 * E a TRAVA, `/automacao/trava`: uma execução ativa por vez, com prazo de
 * validade RENOVADO a cada passo — um disparo manual e o agendado nunca
 * rodam juntos, e uma execução que morreu destrava sozinha `TRAVA_MS`
 * depois do último sinal de vida.
 */

export const EXECUCOES_COLLECTION = "automacaoExecucoes";
export const AUTOMACAO_COLLECTION = "automacao";
export const TRAVA_DOC = "trava";
export const ULTIMA_DOC = "ultima";

/** Validade da trava a partir do último sinal de vida (planejar ou passo). */
export const TRAVA_MS = 15 * 60_000;

/**
 * Uma unidade "rodando" há mais que isto morreu com a função: a Vercel
 * corta a função em 300 s (`maxDuration`), então passados 310 s ninguém
 * mais vai gravar o resultado dela.
 */
export const UNIDADE_PRAZO_MS = 310_000;

/** Tentativas por unidade (a segunda é a retomada da que morreu). */
export const UNIDADE_TENTATIVAS_MAX = 2;

export type EstadoExecucao = "rodando" | "concluida" | "falhou" | "nada_a_fazer" | "recusada";

export type EstadoUnidade = "pendente" | "rodando" | "feita" | "pulada" | "falhou" | "nao_processada";

/** Como o texto por IA terminou numa unidade demo. */
export type ResultadoIA = "ok" | "falhou" | "desligada" | "indisponivel" | "sem_suporte" | "teto";

export interface UnidadeBase {
  id: string;
  estado: EstadoUnidade;
  tentativas: number;
  iniciadaEm?: string;
  concluidaEm?: string;
  motivo?: string;
}

export interface UnidadeDemo extends UnidadeBase {
  tipo: "demo";
  leadId: string;
  /** De onde o lead veio: já estava na base, ou uma busca desta execução trouxe. */
  fonte: "existente" | "busca";
  skinId?: string;
  themeId?: string;
  ia?: ResultadoIA;
  iaMotivo?: string;
  aprovacao?: "pendente" | "aprovada";
}

export interface UnidadeBusca extends UnidadeBase {
  tipo: "busca";
  parChave?: string;
  nicho?: string;
  regiao?: string;
  buscaId?: string;
  paginas?: number;
  novos?: number;
}

export type Unidade = UnidadeDemo | UnidadeBusca;

export interface BuscaFeita {
  parChave: string;
  nicho: string;
  regiao: string;
  buscaId: string;
  paginas: number;
  novos: number;
}

export interface FalhaUnidade {
  unidadeId: string;
  tipo: Unidade["tipo"];
  leadId?: string;
  motivo: string;
  em: string;
}

export interface LoteCapturas {
  leads: number;
  execucaoId?: string;
  enfileirados?: number;
  pulados?: number;
  erro?: string;
}

export interface ExecucaoAutomacao {
  id: string;
  estado: EstadoExecucao;
  /** Quem disparou: `schedule`, `workflow_dispatch`, `repository_dispatch`… */
  disparo: string;
  runUrl?: string;
  iniciadaEm: string;
  atualizadaEm: string;
  finalizadaEm?: string;
  alvo: number;
  estoqueAntes?: Estoque;
  estoqueDepois?: Estoque;
  /** Quanto faltava para o alvo quando o plano foi feito. */
  falta: number;
  unidades: Unidade[];
  demosCriadas: string[];
  buscas: BuscaFeita[];
  /** Pares já tentados NESTA execução — uma busca nunca repete o par na mesma noite. */
  paresTentados: string[];
  /** Nenhum par sobrou para buscar — não adianta enfileirar outra busca. */
  semPares?: boolean;
  /** Páginas de Text Search cobradas desta execução (reservadas antes, acertadas depois). */
  requisicoesBusca: number;
  /** Chamadas ao Gemini cobradas desta execução (idem). */
  chamadasIA: number;
  falhas: FalhaUnidade[];
  capturas?: LoteCapturas[];
  /** O último bloqueio que impediu mais trabalho (teto, par) — vira o motivo de parada. */
  bloqueio?: string;
  /**
   * A varredura das demos automáticas vencidas, feita no `planejar` antes
   * do estoque (ver `varredura.ts`). Ausente = a execução não chegou a
   * varrer (desligada, recusada, falha antes do plano).
   */
  varredura?: ResultadoVarredura;
  /** Nada a fazer / recusada / motivo de parada. */
  motivo?: string;
  erro?: string;
}

// O Firestore recusa `undefined`; o round-trip JSON descarta as chaves.
export function paraDoc(execucao: ExecucaoAutomacao): Record<string, unknown> {
  return JSON.parse(JSON.stringify(execucao)) as Record<string, unknown>;
}

export function execucaoRef(db: AppDb, id: string) {
  return db.collection(EXECUCOES_COLLECTION).doc(id);
}

export function travaRef(db: AppDb) {
  return db.collection(AUTOMACAO_COLLECTION).doc(TRAVA_DOC);
}

export function ultimaRef(db: AppDb) {
  return db.collection(AUTOMACAO_COLLECTION).doc(ULTIMA_DOC);
}

export interface Trava {
  execucaoId: string;
  expiraEm: string;
}

/** A trava viva, ou `undefined` (ausente, vencida ou liberada). */
export function travaAtiva(data: Record<string, unknown> | undefined, now: Date): Trava | undefined {
  if (!data || typeof data.execucaoId !== "string" || !data.execucaoId) return undefined;
  const expira = new Date(String(data.expiraEm)).getTime();
  if (!Number.isFinite(expira) || expira <= now.getTime()) return undefined;
  return { execucaoId: data.execucaoId, expiraEm: String(data.expiraEm) };
}

export function novaTrava(execucaoId: string, now: Date): Trava {
  return { execucaoId, expiraEm: new Date(now.getTime() + TRAVA_MS).toISOString() };
}

export async function lerExecucao(db: AppDb, id: string): Promise<ExecucaoAutomacao> {
  const snap = await execucaoRef(db, id).get();
  const data = snap.exists ? snap.data() : undefined;
  if (!data) throw new NotFoundError(`Execução "${id}" não encontrada.`);
  return data as unknown as ExecucaoAutomacao;
}

export async function lerExecucaoTx(
  tx: UsageTransaction,
  db: AppDb,
  id: string,
): Promise<ExecucaoAutomacao> {
  const snap = await tx.get(execucaoRef(db, id));
  const data = snap.exists ? snap.data() : undefined;
  if (!data) throw new NotFoundError(`Execução "${id}" não encontrada.`);
  return data as unknown as ExecucaoAutomacao;
}

/**
 * Confere, dentro da transação, que a trava é DESTA execução — ou que está
 * livre, caso em que a execução a retoma (um runner lento que passou do
 * prazo sem ninguém ocupar o lugar continua dono). Outra execução viva com
 * a trava → 409.
 */
export async function exigirTrava(
  tx: UsageTransaction,
  db: AppDb,
  execucaoId: string,
  now: Date,
): Promise<void> {
  const snap = await tx.get(travaRef(db));
  const ativa = travaAtiva(snap.exists ? snap.data() : undefined, now);
  if (ativa && ativa.execucaoId !== execucaoId) {
    throw new ConflictError("Outra execução da automação está com a trava.", {
      execucaoAtiva: ativa.execucaoId,
    });
  }
}

export type CampoOrcamento = "requisicoesBusca" | "chamadasIA";

/**
 * RESERVA no teto DA NOITE, antes da chamada paga — o mesmo princípio de
 * `reserveQuota`: cobra primeiro, acerta depois. Concede até `quer`, mas só
 * se couber pelo menos `minimo`; senão concede 0 e nada é cobrado. Uma
 * unidade que morre no meio deixa a reserva cobrada: o erro fica do lado
 * seguro, e o teto da noite continua valendo mesmo para a unidade repetida.
 */
export async function reservarOrcamento(
  db: AppDb,
  execucaoId: string,
  campo: CampoOrcamento,
  quer: number,
  teto: number,
  minimo = 1,
): Promise<number> {
  return db.runTransaction(async (tx) => {
    const execucao = await lerExecucaoTx(tx, db, execucaoId);
    const usado = execucao[campo] ?? 0;
    const disponivel = Math.max(teto - usado, 0);
    const concedido = disponivel >= minimo ? Math.min(quer, disponivel) : 0;
    if (concedido > 0) {
      tx.set(execucaoRef(db, execucaoId), { [campo]: usado + concedido }, { merge: true });
    }
    return concedido;
  });
}

/** Devolve ao teto da noite o que foi reservado e não gasto (`delta` negativo). */
export async function acertarOrcamento(
  db: AppDb,
  execucaoId: string,
  campo: CampoOrcamento,
  delta: number,
): Promise<void> {
  if (delta === 0) return;
  await db.runTransaction(async (tx) => {
    const execucao = await lerExecucaoTx(tx, db, execucaoId);
    tx.set(
      execucaoRef(db, execucaoId),
      { [campo]: Math.max((execucao[campo] ?? 0) + delta, 0) },
      { merge: true },
    );
  });
}
