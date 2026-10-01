import type { AppDb, UsageDocRef, UsageTransaction } from "@/lib/firestore-like";

import type { FilaEnvioDoc } from "./estado";

/**
 * O HISTÓRICO POR CICLO — `filaEnvios/{leadId}/ciclos/{claimId}`.
 *
 * O doc principal de `filaEnvios` é UM por lead e cada reserva o sobrescreve
 * (claim, reservadoEm, dispositivo…): só o último ciclo ficava visível. Foi
 * isso que impediu responder, no diagnóstico do envio repetido, quantas
 * vezes um lead tinha sido levado e o que o aparelho disse em cada vez.
 *
 * Agora cada reserva também nasce como um registro PRÓPRIO, keyed pelo
 * claimId (único por reserva), que nenhuma reserva seguinte toca:
 *
 * - **abre** na transação de `reservarLead` (`resultado: null`); a skin
 *   entra logo depois, em `anotarRotacao`;
 * - **fecha UMA vez**, na MESMA transação de quem decide o desfecho: o
 *   confirmar do aparelho (`enviado`/`falhou`/`invalido`, com o `detalhe`),
 *   a devolução pela rota (`devolvida` — `liberarClaim`) ou a decisão do
 *   operador na revisão (`liberado_revisao`/`contactado_revisao`). O
 *   primeiro fechamento vale: um ciclo fechado nunca é reaberto nem
 *   sobrescrito, e é isso que o torna um registro, não um estado.
 *
 * O doc principal continua exatamente como era — este é um rastro AO LADO
 * dele, não uma troca de modelo. Subcoleção (e não coleção solta) porque o
 * acesso é sempre "os ciclos DESTE lead", e é uma varredura pequena do
 * próprio lead em vez de uma da base inteira; e porque a varredura de
 * `filaEnvios` (pool, revisão, pendências) não enxerga subcoleção — nada
 * do que já lia a coleção muda.
 *
 * Claim de ANTES desta mudança não tem ciclo aberto: o fechamento cria o
 * registro com o que o doc principal sabe (reserva, aparelho, skin), em vez
 * de perder o desfecho.
 */

export type ResultadoCiclo =
  | "enviado"
  | "falhou"
  | "invalido"
  /** A rota desistiu antes de montar a tarefa (sem print, sem telefone, marcador sem resolver). */
  | "devolvida"
  /** Revisão: o operador conferiu que NÃO saiu e devolveu à fila. */
  | "liberado_revisao"
  /** Revisão: o operador conferiu que SAIU. */
  | "contactado_revisao";

export interface CicloEnvio {
  claimId: string;
  leadId: string;
  reservadoEm: string;
  dispositivo: string;
  rotacaoSkinId: string | null;
  /** `null` enquanto o ciclo está aberto. */
  resultado: ResultadoCiclo | null;
  /** O texto que o aparelho mandou junto do confirmar (ou `null`). */
  detalhe: string | null;
  /** Quando o desfecho chegou (ISO), ou `null` enquanto aberto. */
  fechadoEm: string | null;
}

function ciclosCol(db: AppDb, leadId: string) {
  return db.collection(`filaEnvios/${leadId}/ciclos`);
}

export function cicloRef(db: AppDb, leadId: string, claimId: string): UsageDocRef {
  return ciclosCol(db, leadId).doc(claimId);
}

/** O ciclo que uma reserva abre — gravado na transação de `reservarLead`. */
export function cicloAberto(envio: FilaEnvioDoc): CicloEnvio {
  return {
    claimId: envio.claimId,
    leadId: envio.leadId,
    reservadoEm: envio.reservadoEm,
    dispositivo: envio.dispositivo,
    rotacaoSkinId: envio.rotacaoSkinId ?? null,
    resultado: null,
    detalhe: null,
    fechadoEm: null,
  };
}

/**
 * O ciclo FECHADO, puro — ou `undefined` quando ele já estava fechado (o
 * primeiro desfecho vale). `atual` é o doc lido na transação; ausente =
 * claim de antes dos ciclos, e o registro nasce do doc principal.
 */
export function cicloFechado(
  atual: Record<string, unknown> | undefined,
  envio: FilaEnvioDoc,
  resultado: ResultadoCiclo,
  detalhe: string | null,
  now: Date,
): CicloEnvio | undefined {
  if (atual && atual.resultado) return undefined;
  const base = (atual as CicloEnvio | undefined) ?? cicloAberto(envio);
  return { ...base, resultado, detalhe: detalhe ?? null, fechadoEm: now.toISOString() };
}

/**
 * Leitura do ciclo dentro de uma transação — o fechamento precisa saber se
 * ele já fechou. Fica separada da escrita porque o Firestore exige todas as
 * leituras antes de todas as escritas.
 */
export async function lerCicloTx(
  tx: UsageTransaction,
  db: AppDb,
  leadId: string,
  claimId: string,
): Promise<Record<string, unknown> | undefined> {
  return (await tx.get(cicloRef(db, leadId, claimId))).data();
}

/** Escreve o fechamento (se houver) — a metade de escrita de `lerCicloTx`. */
export function gravarFechamentoTx(
  tx: UsageTransaction,
  db: AppDb,
  fechado: CicloEnvio | undefined,
): void {
  if (!fechado) return;
  tx.set(cicloRef(db, fechado.leadId, fechado.claimId), { ...fechado });
}

/** Os ciclos de um lead, do mais ANTIGO para o mais novo — a história na ordem. */
export async function lerCiclos(db: AppDb, leadId: string): Promise<CicloEnvio[]> {
  const snap = await ciclosCol(db, leadId).get();
  return snap.docs
    .map((d) => d.data() as unknown as CicloEnvio)
    .sort((a, b) => a.reservadoEm.localeCompare(b.reservadoEm) || a.claimId.localeCompare(b.claimId));
}
