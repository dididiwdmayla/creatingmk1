import type { AppDb } from "@/lib/firestore-like";
import { TRADUCOES_NICHO_COLLECTION, type TraducaoNicho } from "./types";

/**
 * Repositório de /traducoesNicho — cache permanente por par nicho+idioma
 * (ver ./types). Mesma normalização de src/lib/buscas/penetracao.ts
 * (minúsculas, espaços colapsados): "Dentista" e "dentista " batem na
 * mesma chave.
 */

function normalizarNicho(nicho: string): string {
  return nicho.trim().toLowerCase().replace(/\s+/g, " ");
}

/** ID do doc: nicho normalizado + idioma, URL-encoded (sem "/"). */
export function traducaoCacheKey(nicho: string, idioma: string): string {
  return encodeURIComponent(`${normalizarNicho(nicho)}::${idioma}`);
}

function docRef(db: AppDb, nicho: string, idioma: string) {
  return db.collection(TRADUCOES_NICHO_COLLECTION).doc(traducaoCacheKey(nicho, idioma));
}

export async function getTraducaoNicho(
  db: AppDb,
  nicho: string,
  idioma: string,
): Promise<TraducaoNicho | undefined> {
  const snap = await docRef(db, nicho, idioma).get();
  const data = snap.exists ? snap.data() : undefined;
  return data ? (data as unknown as TraducaoNicho) : undefined;
}

export async function salvarTraducaoNicho(
  db: AppDb,
  nicho: string,
  idioma: string,
  termo: string,
  now: Date = new Date(),
): Promise<TraducaoNicho> {
  const traducao: TraducaoNicho = { nicho, idioma, termo, geradoEm: now.toISOString() };
  await docRef(db, nicho, idioma).set(traducao as unknown as Record<string, unknown>);
  return traducao;
}
