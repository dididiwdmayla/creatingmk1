import type { AppDb } from "@/lib/firestore-like";
import { chaveNicho } from "./chave";
import { normalizarSlots, proximoIndice } from "./rotacao";
import { CHAVE_GENERICAS, FRASES_COLLECTION, type FrasesProspeccao } from "./types";

/**
 * Repositório de /frasesProspeccao — um doc por nicho mais o doc reservado
 * do conjunto genérico (`CHAVE_GENERICAS`). Em toda função daqui,
 * `nicho: null` significa "o conjunto genérico de fallback": os dois têm a
 * mesma forma e a mesma rotação, então um único caminho de código serve aos
 * dois.
 *
 * As duas escritas usam `merge` e são DISJUNTAS de propósito: salvar textos
 * nunca zera o contador, e avançar o contador nunca sobrescreve os textos —
 * o admin editando na tela de administração e um membro disparando um
 * WhatsApp no mesmo segundo não se atropelam.
 */

/** Chave do doc: o nicho normalizado, ou a reservada do conjunto genérico. */
export function chaveDoAlvo(nicho: string | null): string {
  return nicho === null ? CHAVE_GENERICAS : chaveNicho(nicho);
}

function docRef(db: AppDb, nicho: string | null) {
  return db.collection(FRASES_COLLECTION).doc(chaveDoAlvo(nicho));
}

/** Conjunto vazio (nunca salvo) — a forma que um nicho novo assume na tela. */
export function conjuntoVazio(nicho: string): FrasesProspeccao {
  return { nicho, frases: normalizarSlots(undefined), indice: 0 };
}

function asConjunto(data: Record<string, unknown>): FrasesProspeccao {
  const bruto = data as unknown as Partial<FrasesProspeccao>;
  return {
    nicho: typeof bruto.nicho === "string" ? bruto.nicho : "",
    frases: normalizarSlots(bruto.frases),
    indice: Number.isInteger(bruto.indice) && (bruto.indice as number) >= 0 ? (bruto.indice as number) : 0,
    ...(typeof bruto.atualizadoEm === "string" && { atualizadoEm: bruto.atualizadoEm }),
  };
}

/** Conjunto salvo do nicho (ou o genérico) — undefined se nunca foi salvo. */
export async function getConjunto(
  db: AppDb,
  nicho: string | null,
): Promise<FrasesProspeccao | undefined> {
  const snap = await docRef(db, nicho).get();
  const data = snap.exists ? snap.data() : undefined;
  return data ? asConjunto(data) : undefined;
}

/**
 * Todos os conjuntos salvos, separando o genérico dos nichos. A coleção tem
 * um doc por nicho já visto — dezenas, não milhares —, então ler inteira e
 * separar em memória segue a mesma escolha do resto do app (ver AppDb).
 */
export async function listConjuntos(
  db: AppDb,
): Promise<{ nichos: FrasesProspeccao[]; genericas?: FrasesProspeccao }> {
  const snapshot = await db.collection(FRASES_COLLECTION).get();
  const nichos: FrasesProspeccao[] = [];
  let genericas: FrasesProspeccao | undefined;
  for (const doc of snapshot.docs) {
    const conjunto = asConjunto(doc.data());
    if (doc.id === CHAVE_GENERICAS) {
      genericas = conjunto;
    } else {
      nichos.push(conjunto);
    }
  }
  nichos.sort((a, b) => a.nicho.localeCompare(b.nicho));
  return { nichos, ...(genericas && { genericas }) };
}

/**
 * Salva os TEXTOS do conjunto (tela de administração, admin). Escreve só
 * `nicho`/`frases`/`atualizadoEm` com merge: o `indice` já gravado
 * sobrevive — editar uma frase não reinicia a rotação do time.
 */
export async function salvarConjunto(
  db: AppDb,
  nicho: string | null,
  frases: string[],
  now: Date = new Date(),
): Promise<FrasesProspeccao> {
  const slots = normalizarSlots(frases);
  await docRef(db, nicho).set(
    {
      nicho: nicho ?? "",
      frases: slots,
      atualizadoEm: now.toISOString(),
    },
    { merge: true },
  );
  const atual = await getConjunto(db, nicho);
  return atual ?? { nicho: nicho ?? "", frases: slots, indice: 0 };
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
  nicho: string | null,
  now: Date = new Date(),
): Promise<number> {
  const conjunto = await getConjunto(db, nicho);
  if (!conjunto) return 0;
  const proximo = proximoIndice(conjunto);
  if (proximo === conjunto.indice) return conjunto.indice;
  await docRef(db, nicho).set({ indice: proximo, atualizadoEm: now.toISOString() }, { merge: true });
  return proximo;
}
