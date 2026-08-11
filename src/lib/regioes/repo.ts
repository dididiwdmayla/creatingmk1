import { NotFoundError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import { REGIOES_COLLECTION, type RegiaoIndice } from "./types";
import type { IndiceGerado } from "./ia";

// O Firestore real rejeita undefined (cambioAproxBRL/indiceAjustado
// ausentes); o round-trip JSON descarta essas chaves.
function toDoc(regiao: RegiaoIndice): Record<string, unknown> {
  return JSON.parse(JSON.stringify(regiao)) as Record<string, unknown>;
}

function docRef(db: AppDb, slug: string) {
  return db.collection(REGIOES_COLLECTION).doc(slug);
}

/**
 * Todas as regiões já cacheadas. Leitura pura do cache — nunca gera nada,
 * nunca chama IA: quem precisa da lista inteira é a tela `/mundo`, que é
 * derivada e não pode custar uma chamada paga sequer. Coleção pequena por
 * construção (um doc por região geocodificada na vida do app).
 */
export async function listRegioes(db: AppDb): Promise<RegiaoIndice[]> {
  const snapshot = await db.collection(REGIOES_COLLECTION).get();
  return snapshot.docs.map((doc) => ({ ...(doc.data() as unknown as RegiaoIndice), slug: doc.id }));
}

export async function getRegiaoIndice(db: AppDb, slug: string): Promise<RegiaoIndice | undefined> {
  const snap = await docRef(db, slug).get();
  const data = snap.exists ? snap.data() : undefined;
  return data ? ({ ...(data as unknown as RegiaoIndice), slug }) : undefined;
}

/**
 * Grava o índice gerado (1ª geração ou regeneração pelo admin). O
 * `indiceAjustado` já existente é PRESERVADO — regenerar atualiza só a
 * base sugerida pela IA; a edição manual do admin é decisão separada,
 * limpa apenas via `setIndiceAjustado(db, slug, null)`.
 */
export async function salvarRegiaoIndice(
  db: AppDb,
  slug: string,
  contexto: { regiaoTexto: string; cidade: string; pais: string },
  gerado: IndiceGerado,
  now: Date = new Date(),
): Promise<RegiaoIndice> {
  const atual = await getRegiaoIndice(db, slug);
  const regiao: RegiaoIndice = {
    slug,
    regiaoTexto: contexto.regiaoTexto,
    cidade: contexto.cidade,
    pais: contexto.pais,
    ...gerado,
    ...(atual?.indiceAjustado !== undefined && { indiceAjustado: atual.indiceAjustado }),
    geradoEm: now.toISOString(),
  };
  await docRef(db, slug).set(toDoc(regiao));
  return regiao;
}

/**
 * Edição manual do admin, só na UI da região: `valor` seta `indiceAjustado`
 * (vence o `indice` gerado nos cálculos), `null` limpa (volta a valer o
 * gerado). Exige que a região já tenha sido gerada ao menos uma vez.
 */
export async function setIndiceAjustado(
  db: AppDb,
  slug: string,
  valor: number | null,
): Promise<RegiaoIndice> {
  const atual = await getRegiaoIndice(db, slug);
  if (!atual) {
    throw new NotFoundError(
      `Região "${slug}" ainda não tem índice gerado — abra a calculadora primeiro.`,
    );
  }
  // undefined explícito é descartado no round-trip JSON de toDoc (limpa de verdade).
  const atualizada: RegiaoIndice = { ...atual, indiceAjustado: valor ?? undefined };
  await docRef(db, slug).set(toDoc(atualizada));
  return atualizada;
}
