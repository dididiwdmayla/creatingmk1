import { NotFoundError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import { BUSCAS_COLLECTION, BUSCA_CORES, type Busca } from "./types";

// O Firestore real rejeita undefined como valor (subNicho ausente); o
// round-trip JSON descarta essas chaves.
function toDoc(busca: Busca): Record<string, unknown> {
  return JSON.parse(JSON.stringify(busca)) as Record<string, unknown>;
}

/** Docs antigos (antes do campo cor) ganham uma cor estável pelo índice. */
function asBusca(data: Record<string, unknown>, id: string, index: number): Busca {
  const busca = { ...(data as unknown as Busca), id };
  if (!busca.cor) {
    busca.cor = BUSCA_CORES[index % BUSCA_CORES.length];
  }
  return busca;
}

export async function createBusca(
  db: AppDb,
  dados: Omit<Busca, "criadaEm" | "cor"> & { cor?: string },
  now: Date = new Date(),
): Promise<Busca> {
  let cor = dados.cor;
  if (!cor) {
    // Rotação pela quantidade de buscas já salvas (escala pessoal).
    const snapshot = await db.collection(BUSCAS_COLLECTION).get();
    cor = BUSCA_CORES[snapshot.docs.length % BUSCA_CORES.length];
  }
  const busca: Busca = { ...dados, cor, criadaEm: now.toISOString() };
  await db.collection(BUSCAS_COLLECTION).doc(busca.id).set(toDoc(busca));
  return busca;
}

/** Buscas salvas, mais recentes primeiro. */
export async function listBuscas(db: AppDb): Promise<Busca[]> {
  const snapshot = await db.collection(BUSCAS_COLLECTION).get();
  return snapshot.docs
    .map((doc, index) => asBusca(doc.data(), doc.id, index))
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
}

export interface BuscaPatch {
  cor?: string;
  /** String vazia limpa a mensagem do grupo (volta ao fallback global). */
  mensagemPadrao?: string;
}

export async function updateBusca(db: AppDb, id: string, patch: BuscaPatch): Promise<Busca> {
  const ref = db.collection(BUSCAS_COLLECTION).doc(id);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : undefined;
  if (!data) {
    throw new NotFoundError(`Busca "${id}" não encontrada.`);
  }
  const busca: Busca = { ...(data as unknown as Busca), id };
  if (patch.cor !== undefined) {
    busca.cor = patch.cor;
  }
  if (patch.mensagemPadrao !== undefined) {
    // undefined some do doc no toDoc (round-trip JSON descarta a chave)…
    busca.mensagemPadrao = patch.mensagemPadrao.trim() || undefined;
  }
  await ref.set(toDoc(busca));
  return busca;
}
