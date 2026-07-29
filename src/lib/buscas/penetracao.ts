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

function mesmoGrupo(
  a: Pick<Busca, "nicho" | "regiao">,
  b: Pick<Busca, "nicho" | "regiao">,
): boolean {
  return normalizar(a.nicho) === normalizar(b.nicho) && normalizar(a.regiao) === normalizar(b.regiao);
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
  const idsDoGrupo = new Set(buscas.filter((b) => mesmoGrupo(b, busca)).map((b) => b.id));
  idsDoGrupo.add(busca.id);

  const leads = await listLeads(db);
  const doGrupo = leads.filter((lead) => (lead.buscaId ?? []).some((id) => idsDoGrupo.has(id)));
  return calcularPenetracaoSite(doGrupo);
}

/** Recalcula e cacheia a penetração no doc da busca — chamado toda vez que ela roda de novo. */
export async function recalcularPenetracao(db: AppDb, buscaId: string): Promise<Busca> {
  const busca = await getBusca(db, buscaId);
  const penetracao = await calcularPenetracaoGrupo(db, busca);
  return salvarPenetracao(db, buscaId, penetracao);
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
