import { ConflictError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";

import { AUTOMACAO_COLLECTION, travaAtiva, travaRef, ultimaRef } from "./execucao";

/**
 * O "RODAR AGORA" e a pergunta que ele depende: há execução ATIVA?
 *
 * A trava (`/automacao/trava`) só existe depois que o workflow chama
 * `planejar` — o que leva de segundos a minutos depois do
 * `repository_dispatch`. Nesse intervalo a trava está livre, e um segundo
 * clique dispararia de novo: com o `concurrency` serial do workflow, o
 * segundo run ESPERA o primeiro e roda logo depois dele, com a trava já
 * liberada — duas execuções seguidas, pagando busca e IA duas vezes. Por
 * isso o pedido fica registrado (`/automacao/disparo`) e conta como
 * execução ativa até virar execução (o ponteiro `ultima` anda para depois
 * dele) ou até `DISPARO_PENDENTE_MS` sem notícia — o workflow desabilitado
 * ou fora do branch default não pode travar o botão para sempre.
 */

export const DISPARO_DOC = "disparo";

/** Quanto tempo um pedido sem execução correspondente segura o botão. */
export const DISPARO_PENDENTE_MS = 10 * 60_000;

export type ExecucaoAtiva =
  /** A trava está viva: o workflow está rodando esta execução. */
  | { tipo: "execucao"; execucaoId: string; expiraEm: string }
  /** Alguém pediu "rodar agora" e o workflow ainda não começou. */
  | { tipo: "disparo"; em: string; por?: string };

export function disparoRef(db: AppDb) {
  return db.collection(AUTOMACAO_COLLECTION).doc(DISPARO_DOC);
}

/**
 * O pedido ainda está pendente? Pura. Vira execução quando o ponteiro
 * `ultima` é gravado DEPOIS dele — `planejar` grava ao começar (rodando ou
 * nada a fazer) e `finalizar` grava a falha de antes do plano, então
 * qualquer desfecho do run pedido move o ponteiro.
 */
export function disparoPendente(
  disparo: Record<string, unknown> | undefined,
  ultima: Record<string, unknown> | undefined,
  now: Date,
): { em: string; por?: string } | undefined {
  const em = typeof disparo?.em === "string" ? disparo.em : "";
  if (!em) return undefined;
  const t = new Date(em).getTime();
  if (!Number.isFinite(t) || now.getTime() - t >= DISPARO_PENDENTE_MS || t > now.getTime()) return undefined;
  const ultimaEm = typeof ultima?.em === "string" ? ultima.em : "";
  if (ultimaEm && ultimaEm >= em) return undefined;
  return { em, ...(typeof disparo?.por === "string" && disparo.por && { por: disparo.por }) };
}

function ativaDe(
  trava: Record<string, unknown> | undefined,
  disparo: Record<string, unknown> | undefined,
  ultima: Record<string, unknown> | undefined,
  now: Date,
): ExecucaoAtiva | null {
  const viva = travaAtiva(trava, now);
  if (viva) return { tipo: "execucao", execucaoId: viva.execucaoId, expiraEm: viva.expiraEm };
  const pedido = disparoPendente(disparo, ultima, now);
  return pedido ? { tipo: "disparo", ...pedido } : null;
}

/** Três leituras de doc: trava, pedido e ponteiro. */
export async function execucaoAtiva(db: AppDb, now: Date = new Date()): Promise<ExecucaoAtiva | null> {
  const [trava, disparo, ultima] = await Promise.all([
    travaRef(db).get(),
    disparoRef(db).get(),
    ultimaRef(db).get(),
  ]);
  return ativaDe(trava.data(), disparo.data(), ultima.data(), now);
}

/**
 * Registra o pedido — ou recusa (409, `ConflictError` com `ativa`) se já há
 * execução ativa. Checagem e registro na MESMA transação: dois cliques
 * simultâneos (ou dois admins) não passam os dois.
 */
export async function registrarDisparo(db: AppDb, por: string, now: Date = new Date()): Promise<string> {
  const em = now.toISOString();
  return db.runTransaction(async (tx) => {
    const [trava, disparo, ultima] = await Promise.all([
      tx.get(travaRef(db)),
      tx.get(disparoRef(db)),
      tx.get(ultimaRef(db)),
    ]);
    const ativa = ativaDe(trava.data(), disparo.data(), ultima.data(), now);
    if (ativa) {
      throw new ConflictError(
        ativa.tipo === "execucao"
          ? "Já há uma execução da automação rodando — espere ela terminar."
          : "Uma execução já foi pedida e o GitHub ainda não a começou — espere alguns minutos.",
        { ativa },
      );
    }
    tx.set(disparoRef(db), { em, por });
    return em;
  });
}

/**
 * O GitHub recusou o disparo: o pedido não vai virar execução, então não
 * pode segurar o botão. Só apaga o pedido que É este (outro clique pode ter
 * registrado um depois).
 */
export async function desfazerDisparo(db: AppDb, em: string, now: Date = new Date()): Promise<void> {
  await db.runTransaction(async (tx) => {
    const atual = (await tx.get(disparoRef(db))).data();
    if (atual?.em !== em) return;
    tx.set(disparoRef(db), { em: "", desfeitoEm: now.toISOString() });
  });
}
