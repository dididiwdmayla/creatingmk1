import type { AppDb } from "@/lib/firestore-like";
import { BUSCAS_COLLECTION, type Busca } from "./types";

// O Firestore real rejeita undefined como valor (subNicho ausente); o
// round-trip JSON descarta essas chaves.
function toDoc(busca: Busca): Record<string, unknown> {
  return JSON.parse(JSON.stringify(busca)) as Record<string, unknown>;
}

export async function createBusca(
  db: AppDb,
  dados: Omit<Busca, "criadaEm">,
  now: Date = new Date(),
): Promise<Busca> {
  const busca: Busca = { ...dados, criadaEm: now.toISOString() };
  await db.collection(BUSCAS_COLLECTION).doc(busca.id).set(toDoc(busca));
  return busca;
}

/** Buscas salvas, mais recentes primeiro. */
export async function listBuscas(db: AppDb): Promise<Busca[]> {
  const snapshot = await db.collection(BUSCAS_COLLECTION).get();
  return snapshot.docs
    .map((doc) => ({ ...(doc.data() as unknown as Busca), id: doc.id }))
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
}
