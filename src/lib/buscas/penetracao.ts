import type { AppDb } from "@/lib/firestore-like";
import { calcularPenetracaoSite, type PenetracaoSite } from "@/lib/leads/penetracao";
import { listLeads } from "@/lib/leads/repo";
import type { Lead } from "@/lib/leads/types";
import { getBusca, listBuscas, salvarPenetracao } from "./repo";
import type { Busca } from "./types";

/**
 * Penetração de site por nicho+região: "neste nicho nesta cidade" é maior
 * que uma única execução de busca — várias buscas manuais/recorrentes
 * podem mirar o mesmo nicho+região ao longo do tempo, e todas contam para
 * o agregado. Só lê dados já salvos em /buscas e /leads — nenhum request
 * ao Google.
 */

/** Normaliza pra comparar "mesmo nicho+região" entre buscas (minúsculas, espaços colapsados). */
function normalizar(texto: string): string {
  return texto.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Chave do par nicho+região — duas buscas com a mesma chave são o mesmo grupo. */
function chaveDoGrupo(busca: Pick<Busca, "nicho" | "regiao">): string {
  return `${normalizar(busca.nicho)}\u0000${normalizar(busca.regiao)}`;
}

/**
 * Núcleo puro: penetração do grupo nicho+região de `busca`, sobre listas
 * de buscas e leads JÁ LIDAS. Os dois caminhos (uma busca por vez e o lote
 * do fim da rodada do cron) passam por aqui — o cálculo é um só.
 */
function penetracaoDoGrupo(
  buscas: Busca[],
  leads: Lead[],
  busca: Pick<Busca, "id" | "nicho" | "regiao">,
): PenetracaoSite {
  const chave = chaveDoGrupo(busca);
  const idsDoGrupo = new Set(buscas.filter((b) => chaveDoGrupo(b) === chave).map((b) => b.id));
  idsDoGrupo.add(busca.id);

  const doGrupo = leads.filter((lead) => (lead.buscaId ?? []).some((id) => idsDoGrupo.has(id)));
  return calcularPenetracaoSite(doGrupo);
}

/**
 * Reúne os leads de TODAS as buscas com o mesmo nicho+região da busca dada
 * (não só ela) e agrega a penetração de site próprio sobre eles.
 */
export async function calcularPenetracaoGrupo(
  db: AppDb,
  busca: Pick<Busca, "id" | "nicho" | "regiao">,
): Promise<PenetracaoSite> {
  const buscas = await listBuscas(db);
  const leads = await listLeads(db);
  return penetracaoDoGrupo(buscas, leads, busca);
}

/** Recalcula e cacheia a penetração no doc da busca — chamado toda vez que ela roda de novo. */
export async function recalcularPenetracao(db: AppDb, buscaId: string): Promise<Busca> {
  const busca = await getBusca(db, buscaId);
  const penetracao = await calcularPenetracaoGrupo(db, busca);
  return salvarPenetracao(db, buscaId, penetracao);
}

/**
 * Lote do fim da rodada do cron: recalcula e cacheia a penetração de várias
 * buscas lendo /buscas e /leads UMA vez só (não uma por busca — as duas são
 * varreduras da coleção inteira), e calcula cada par nicho+região uma vez,
 * gravando o mesmo valor em cada busca do lote que pertence a ele. Só grava
 * nas buscas pedidas — irmãs do mesmo par que não rodaram ficam como
 * estavam, igual a `recalcularPenetracao`. Busca que sumiu de /buscas no
 * meio da rodada é ignorada.
 */
export async function recalcularPenetracaoBuscas(db: AppDb, buscaIds: string[]): Promise<Busca[]> {
  const ids = [...new Set(buscaIds)];
  if (ids.length === 0) return [];

  const buscas = await listBuscas(db);
  const leads = await listLeads(db);
  const porId = new Map(buscas.map((b) => [b.id, b]));
  const porPar = new Map<string, PenetracaoSite>();

  const salvas: Busca[] = [];
  for (const id of ids) {
    const busca = porId.get(id);
    if (!busca) continue;
    const chave = chaveDoGrupo(busca);
    let penetracao = porPar.get(chave);
    if (!penetracao) {
      penetracao = penetracaoDoGrupo(buscas, leads, busca);
      porPar.set(chave, penetracao);
    }
    salvas.push(await salvarPenetracao(db, id, penetracao));
  }
  return salvas;
}

/** Forma mínima de busca aceita por `penetracaoParaLead` (Busca inteira ou o resumo de /api/hoje). */
export interface BuscaPenetracaoRef {
  id: string;
  nicho: string;
  regiao: string;
  penetracao?: PenetracaoSite;
}

/**
 * Penetração relevante para um lead: entre as buscas em que ele apareceu
 * (mais recente primeiro), a primeira que já tem penetração cacheada — o
 * nicho+região dela é o contexto usado no argumento ("neste nicho nesta
 * cidade").
 */
export function penetracaoParaLead(
  lead: Pick<Lead, "buscaId">,
  buscas: BuscaPenetracaoRef[],
): { nicho: string; regiao: string; penetracao: PenetracaoSite } | undefined {
  const porId = new Map(buscas.map((b) => [b.id, b]));
  for (const id of [...(lead.buscaId ?? [])].reverse()) {
    const busca = porId.get(id);
    if (busca?.penetracao) {
      return { nicho: busca.nicho, regiao: busca.regiao, penetracao: busca.penetracao };
    }
  }
  return undefined;
}
