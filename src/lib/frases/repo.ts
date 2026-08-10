import type { AppDb } from "@/lib/firestore-like";
import { normalizarSlots, proximoIndice } from "./rotacao";
import { FRASES_COLLECTION, type FrasesProspeccao } from "./types";

/**
 * Repositório de /frasesProspeccao — um doc por SKIN do registro, com o id
 * da skin como id do doc. O id da skin é um slug do próprio código
 * ("barbearia2-sul"), então não existe normalização de chave aqui: o que
 * existia (nicho digitado, minúsculas, `encodeURIComponent`) era o que
 * deixava "Barbearia", "barbearia old school" e "barbería" virarem três
 * conjuntos distintos.
 *
 * As duas escritas usam `merge` e são DISJUNTAS de propósito: salvar textos
 * nunca zera o contador, e avançar o contador nunca sobrescreve os textos —
 * o admin editando na tela de administração e um membro disparando um
 * WhatsApp no mesmo segundo não se atropelam.
 */

function docRef(db: AppDb, skinId: string) {
  return db.collection(FRASES_COLLECTION).doc(skinId);
}

/** Conjunto vazio (nunca salvo) — a forma que uma skin nova assume na tela. */
export function conjuntoVazio(skinId: string): FrasesProspeccao {
  return { skinId, frases: normalizarSlots(undefined), indice: 0 };
}

function asConjunto(id: string, data: Record<string, unknown>): FrasesProspeccao {
  const bruto = data as unknown as Partial<FrasesProspeccao>;
  return {
    skinId: id,
    frases: normalizarSlots(bruto.frases),
    indice: Number.isInteger(bruto.indice) && (bruto.indice as number) >= 0 ? (bruto.indice as number) : 0,
    ...(typeof bruto.atualizadoEm === "string" && { atualizadoEm: bruto.atualizadoEm }),
  };
}

/** Conjunto salvo da skin — undefined se nunca foi salvo. */
export async function getConjunto(
  db: AppDb,
  skinId: string,
): Promise<FrasesProspeccao | undefined> {
  const snap = await docRef(db, skinId).get();
  const data = snap.exists ? snap.data() : undefined;
  return data ? asConjunto(skinId, data) : undefined;
}

/**
 * Todos os docs salvos da coleção, na forma de conjunto. Inclui os docs
 * LEGADOS chaveados por texto de nicho (o `skinId` deles é o id antigo) —
 * quem separa o que é skin do registro é `montarConjuntos`/a migração, não
 * o repositório. A coleção tem um doc por skin (mais o resto legado) —
 * dezenas, não milhares —, então ler inteira segue a mesma escolha do resto
 * do app (ver AppDb).
 */
export async function listConjuntos(db: AppDb): Promise<FrasesProspeccao[]> {
  const snapshot = await db.collection(FRASES_COLLECTION).get();
  return snapshot.docs.map((doc) => asConjunto(doc.id, doc.data()));
}

/**
 * Salva os TEXTOS do conjunto (tela de administração, admin). Escreve só
 * `frases`/`atualizadoEm` com merge: o `indice` já gravado sobrevive —
 * editar uma frase não reinicia a rotação do time.
 */
export async function salvarConjunto(
  db: AppDb,
  skinId: string,
  frases: string[],
  now: Date = new Date(),
): Promise<FrasesProspeccao> {
  const slots = normalizarSlots(frases);
  await docRef(db, skinId).set(
    {
      frases: slots,
      atualizadoEm: now.toISOString(),
    },
    { merge: true },
  );
  const atual = await getConjunto(db, skinId);
  return atual ?? { skinId, frases: slots, indice: 0 };
}

/**
 * Avança a rotação depois de um envio. Incremento OTIMISTA e deliberado: lê,
 * calcula o próximo e grava, sem transação nem trava — dois envios no mesmo
 * instante podem repetir uma frase, o que é irrelevante para o uso, e uma
 * transação custaria mais do que resolve. Escreve só `indice`, com merge,
 * para nunca pisar nos textos que o admin possa estar salvando.
 *
 * Conjunto inexistente ou sem frase preenchida devolve 0 e não grava nada:
 * quem não participa da rotação não ganha doc por causa de um clique.
 */
export async function avancarRotacao(
  db: AppDb,
  skinId: string,
  now: Date = new Date(),
): Promise<number> {
  const conjunto = await getConjunto(db, skinId);
  if (!conjunto) return 0;
  const proximo = proximoIndice(conjunto);
  if (proximo === conjunto.indice) return conjunto.indice;
  await docRef(db, skinId).set(
    { indice: proximo, atualizadoEm: now.toISOString() },
    { merge: true },
  );
  return proximo;
}
