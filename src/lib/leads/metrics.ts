import type { AppDb } from "@/lib/firestore-like";
import { LEADS_COLLECTION, type Lead } from "./types";

export interface Metrics {
  contatosHoje: number;
  contatosSemana: number;
  /** Fração 0..1: leads com respondeuEm ÷ leads com primeiroContatoEm. */
  taxaResposta: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Métricas de prospecção (queries em memória sobre /leads — ver
 * ARCHITECTURE.md). "Hoje" usa o dia corrente em UTC, mesma convenção do
 * período de custos; "semana" é uma janela rolante dos últimos 7 dias.
 */
export async function getMetrics(db: AppDb, now: Date = new Date()): Promise<Metrics> {
  const startOfDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const sevenDaysAgo = now.getTime() - 7 * DAY_MS;

  const snapshot = await db.collection(LEADS_COLLECTION).get();

  let contatosHoje = 0;
  let contatosSemana = 0;
  let comPrimeiroContato = 0;
  let comResposta = 0;

  for (const doc of snapshot.docs) {
    const lead = doc.data() as unknown as Lead;
    const primeiro = lead.contato?.primeiroContatoEm;
    if (primeiro) {
      comPrimeiroContato += 1;
      const t = Date.parse(primeiro);
      if (t >= startOfDay) contatosHoje += 1;
      if (t >= sevenDaysAgo) contatosSemana += 1;
    }
    if (lead.contato?.respondeuEm) comResposta += 1;
  }

  return {
    contatosHoje,
    contatosSemana,
    taxaResposta: comPrimeiroContato > 0 ? comResposta / comPrimeiroContato : 0,
  };
}
