import type { AppDb } from "@/lib/firestore-like";

import { skinsDoNicho, normalizaNichoExato } from "./nicho";
import type { SkinDefinition } from "./types";

/**
 * Rodízio de skin × preset por nicho — quem escolhe a combinação de uma
 * demo nova para a AUTOMAÇÃO (a fila decide o nicho pelo lead; quem lê
 * este módulo decide QUAL combinação daquele nicho sai desta vez). Rodízio,
 * não sorteio: sorteio pode repetir a mesma cara para dois leads do mesmo
 * nicho na mesma noite; o rodízio garante que todas as combinações saem
 * antes de alguma repetir.
 */

export const RODIZIO_COLLECTION = "rodizioDemos";

export interface CombinacaoDemo {
  skinId: string;
  themeId: string;
}

/**
 * Todas as combinações possíveis de um nicho — skins do nicho (ver
 * skinsDoNicho) × presets de CADA skin (themePresets, o número real do
 * registro, nunca um 4 fixo). Ordem determinística por (id de skin, id de
 * preset) — nunca a ordem de declaração no registro, que pode mudar sem
 * que ninguém perceba que reordenou o rodízio de todo mundo.
 */
export function combinacoesDoNicho(
  nicho: string,
  skins?: readonly SkinDefinition[],
): CombinacaoDemo[] {
  const doNicho = skinsDoNicho(nicho, skins);
  const combinacoes = doNicho.flatMap((skin) =>
    skin.themePresets.map((theme) => ({ skinId: skin.id, themeId: theme.id })),
  );
  return combinacoes.sort(
    (a, b) => a.skinId.localeCompare(b.skinId) || a.themeId.localeCompare(b.themeId),
  );
}

function docRef(db: AppDb, nicho: string) {
  return db.collection(RODIZIO_COLLECTION).doc(normalizaNichoExato(nicho));
}

function numeroOuZero(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= 0 ? Math.floor(valor) : 0;
}

/**
 * A combinação seguinte do rodízio deste nicho, avançando o contador
 * ATOMICAMENTE (transação — duas demos criadas no mesmo instante para o
 * mesmo nicho nunca saem com a mesma combinação por corrida). `null` = o
 * nicho não tem skin nenhuma (ver skinsDoNicho).
 *
 * O estado gravado é um CONTADOR que só cresce, nunca o índice já reduzido
 * — o índice efetivo é `contador % combinacoes.length`, calculado a cada
 * leitura. Assim uma skin nova (ou uma removida) muda só o TAMANHO da
 * lista, e o módulo se ajusta sozinho no próximo turno sem exigir migração
 * nem resetar a posição de quem já estava girando.
 */
export async function proximaCombinacao(
  db: AppDb,
  nicho: string,
  now: Date = new Date(),
  skins?: readonly SkinDefinition[],
): Promise<CombinacaoDemo | null> {
  const combinacoes = combinacoesDoNicho(nicho, skins);
  if (combinacoes.length === 0) return null;

  const ref = docRef(db, nicho);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const contador = numeroOuZero(snap.exists ? snap.data()?.contador : undefined);
    const indice = contador % combinacoes.length;
    tx.set(
      ref,
      { contador: contador + 1, atualizadoEm: now.toISOString() },
      { merge: true },
    );
    return combinacoes[indice];
  });
}
