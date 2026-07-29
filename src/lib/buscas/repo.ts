import { NotFoundError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import {
  BUSCAS_COLLECTION,
  BUSCA_CORES,
  execucoesCollection,
  type Busca,
  type BuscaExecucao,
} from "./types";

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

/**
 * Buscas recorrentes na ordem DETERMINÍSTICA de execução do cron: mais
 * antiga primeiro (criadaEm asc, desempate pelo id) — a fila não muda de
 * ordem entre rodadas, então um teto de cota estourado interrompe sempre
 * as mesmas buscas do fim da fila, nunca aleatoriamente.
 */
export async function listBuscasRecorrentes(db: AppDb): Promise<Busca[]> {
  const todas = await listBuscas(db);
  return todas
    .filter((busca) => busca.recorrente === true)
    .sort((a, b) => a.criadaEm.localeCompare(b.criadaEm) || a.id.localeCompare(b.id));
}

/**
 * Grava o resumo do delta de uma re-execução do cron na subcoleção
 * /buscas/{id}/execucoes e soma o delta aos totais do grupo (os leads
 * novos do cron pertencem a esta busca — os contadores acompanham).
 */
export async function registrarExecucao(
  db: AppDb,
  buscaId: string,
  execucao: BuscaExecucao,
): Promise<void> {
  await db
    .collection(execucoesCollection(buscaId))
    .doc(crypto.randomUUID())
    .set({ ...execucao });
  const busca = await getBusca(db, buscaId);
  const atualizada: Busca = {
    ...busca,
    totalCriados: busca.totalCriados + execucao.novos,
    totalExistentes: busca.totalExistentes + execucao.existentes,
  };
  await db.collection(BUSCAS_COLLECTION).doc(buscaId).set(toDoc(atualizada));
}

export interface BuscaPatch {
  cor?: string;
  /** String vazia limpa a mensagem do grupo (volta ao fallback global). */
  mensagemPadrao?: string;
  /** Liga/desliga a re-execução diária pelo cron. */
  recorrente?: boolean;
}

export async function getBusca(db: AppDb, id: string): Promise<Busca> {
  const snap = await db.collection(BUSCAS_COLLECTION).doc(id).get();
  const data = snap.exists ? snap.data() : undefined;
  if (!data) {
    throw new NotFoundError(`Busca "${id}" não encontrada.`);
  }
  return { ...(data as unknown as Busca), id };
}

/** Cacheia a análise de IA do grupo — sobrescrita a cada regeneração. */
export async function salvarAnaliseIA(
  db: AppDb,
  id: string,
  texto: string,
  now: Date = new Date(),
): Promise<Busca> {
  const busca = await getBusca(db, id);
  const atualizada: Busca = { ...busca, analiseIA: { texto, geradaEm: now.toISOString() } };
  await db.collection(BUSCAS_COLLECTION).doc(id).set(toDoc(atualizada));
  return atualizada;
}

/** Cacheia a penetração de site próprio do grupo — sobrescrita a cada recálculo. */
export async function salvarPenetracao(
  db: AppDb,
  id: string,
  penetracao: Busca["penetracao"],
): Promise<Busca> {
  const busca = await getBusca(db, id);
  const atualizada: Busca = { ...busca, penetracao };
  await db.collection(BUSCAS_COLLECTION).doc(id).set(toDoc(atualizada));
  return atualizada;
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
  if (patch.recorrente !== undefined) {
    // false também some do doc — recorrente só existe quando ligado.
    busca.recorrente = patch.recorrente || undefined;
  }
  await ref.set(toDoc(busca));
  return busca;
}
