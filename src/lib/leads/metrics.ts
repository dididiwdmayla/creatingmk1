import { BUSCAS_COLLECTION, type Busca } from "@/lib/buscas/types";
import type { AppDb } from "@/lib/firestore-like";
import { LEADS_COLLECTION, type Lead } from "./types";

export interface Metrics {
  contatosHoje: number;
  contatosSemana: number;
  /** Fração 0..1: leads com respondeuEm ÷ leads com primeiroContatoEm. */
  taxaResposta: number;
  /** Leads com demo salva (campo `demo` presente) — card do dashboard. */
  demosCriadas: number;
  /** Leads fechados (contato.fechadoEm) NESTE mês corrente (UTC) — card "Fechamentos do mês". */
  fechamentosMes: number;
}

/** Rollup de ações-chave de UM usuário (admin vê a lista completa). */
export interface MetricsUsuario {
  buscas: number;
  demos: number;
  contatos: number;
  /** Fechamentos (vendedor do lead, contato.fechadoPor) NESTE mês corrente. */
  fechamentosMes: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Métricas de prospecção (queries em memória sobre /leads — ver
 * ARCHITECTURE.md). "Hoje" usa o dia corrente em UTC, mesma convenção do
 * período de custos; "semana" é uma janela rolante dos últimos 7 dias.
 *
 * `userId` escopa aos carimbos DESSE usuário (membro vê só o próprio):
 * contatos por `contato.primeiroContatoPor`, demos por `demo.criadoPor`.
 * Dados anteriores ao multiusuário (sem carimbo) só aparecem no agregado.
 */
export async function getMetrics(
  db: AppDb,
  now: Date = new Date(),
  userId?: string,
): Promise<Metrics> {
  const startOfDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const startOfMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const sevenDaysAgo = now.getTime() - 7 * DAY_MS;

  const snapshot = await db.collection(LEADS_COLLECTION).get();

  let contatosHoje = 0;
  let contatosSemana = 0;
  let comPrimeiroContato = 0;
  let comResposta = 0;
  let demosCriadas = 0;
  let fechamentosMes = 0;

  for (const doc of snapshot.docs) {
    const lead = doc.data() as unknown as Lead;
    const contatoDoUsuario =
      userId === undefined || lead.contato?.primeiroContatoPor === userId;
    const primeiro = lead.contato?.primeiroContatoEm;
    if (primeiro && contatoDoUsuario) {
      comPrimeiroContato += 1;
      const t = Date.parse(primeiro);
      if (t >= startOfDay) contatosHoje += 1;
      if (t >= sevenDaysAgo) contatosSemana += 1;
      if (lead.contato?.respondeuEm) comResposta += 1;
    }
    if (lead.demo && (userId === undefined || lead.demo.criadoPor === userId)) {
      demosCriadas += 1;
    }
    const fechadoEm = lead.contato?.fechadoEm;
    const fechamentoDoUsuario =
      userId === undefined || lead.contato?.fechadoPor === userId;
    if (fechadoEm && fechamentoDoUsuario && Date.parse(fechadoEm) >= startOfMonth) {
      fechamentosMes += 1;
    }
  }

  return {
    contatosHoje,
    contatosSemana,
    taxaResposta: comPrimeiroContato > 0 ? comResposta / comPrimeiroContato : 0,
    demosCriadas,
    fechamentosMes,
  };
}

/**
 * Rollup por usuário das ações-chave (buscas executadas, demos criadas,
 * leads contactados) — só para o admin. Ações antigas sem carimbo de
 * usuário ficam de fora (aparecem apenas no agregado).
 */
export async function getMetricsPorUsuario(
  db: AppDb,
  now: Date = new Date(),
): Promise<Record<string, MetricsUsuario>> {
  const startOfMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const porUsuario: Record<string, MetricsUsuario> = {};
  const de = (userId: string): MetricsUsuario =>
    (porUsuario[userId] ??= { buscas: 0, demos: 0, contatos: 0, fechamentosMes: 0 });

  const buscas = await db.collection(BUSCAS_COLLECTION).get();
  for (const doc of buscas.docs) {
    const busca = doc.data() as unknown as Busca;
    if (busca.userId) de(busca.userId).buscas += 1;
  }

  const leads = await db.collection(LEADS_COLLECTION).get();
  for (const doc of leads.docs) {
    const lead = doc.data() as unknown as Lead;
    if (lead.demo?.criadoPor) de(lead.demo.criadoPor).demos += 1;
    if (lead.contato?.primeiroContatoPor) de(lead.contato.primeiroContatoPor).contatos += 1;
    const fechadoEm = lead.contato?.fechadoEm;
    if (lead.contato?.fechadoPor && fechadoEm && Date.parse(fechadoEm) >= startOfMonth) {
      de(lead.contato.fechadoPor).fechamentosMes += 1;
    }
  }

  return porUsuario;
}
