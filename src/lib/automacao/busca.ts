import { recalcularPenetracao } from "@/lib/buscas/penetracao";
import { createBusca, registrarExecucao } from "@/lib/buscas/repo";
import { BUSCAS_COLLECTION } from "@/lib/buscas/types";
import type { UsageCounts } from "@/lib/costs";
import type { AppDb } from "@/lib/firestore-like";
import { geocodeRegion } from "@/lib/geo/geocode";
import { getLead, upsertLeads } from "@/lib/leads/repo";
import type { Lead } from "@/lib/leads/types";
import { SEARCH_MAX_RESULTS, searchText } from "@/lib/places/client";

import { AUTOMACAO_USER_ID } from "./autor";
import { idBuscaAutomacao, type ParBusca } from "./pares";

/**
 * Uma busca da automação — o MESMO pipeline da busca recorrente do cron
 * (`lib/buscas/cron.ts#executarBusca`): geocode com cache, `searchText` com
 * `reserveQuota` por página, upsert que não rebaixa, execução registrada e
 * penetração recalculada. O que muda são os parâmetros, fixos:
 * qualificada, só sem site, só com telefone, `quantidade` = o que falta.
 *
 * Atribuição e cota: o pseudo-usuário da automação, nunca admin (ver
 * `autor.ts`) — o teto global vale para ela como para qualquer um.
 */

export interface ResultadoBuscaAutomacao {
  buscaId: string;
  /** Páginas de Text Search efetivamente pagas. */
  paginas: number;
  novos: number;
  existentes: number;
  /** Os leads que a busca CRIOU agora (os já existentes ficam de fora). */
  leadsNovos: Lead[];
  aviso?: string;
}

async function garantirDocDoPar(db: AppDb, par: ParBusca, quantidade: number, now: Date): Promise<string> {
  const id = idBuscaAutomacao(par.chave);
  const snap = await db.collection(BUSCAS_COLLECTION).doc(id).get();
  if (!snap.exists) {
    // Nasce zerado: TODA execução, a primeira inclusive, entra pela
    // subcoleção `execucoes` (via `registrarExecucao`, que soma os totais) —
    // a série histórica do par começa completa.
    await createBusca(
      db,
      {
        id,
        nome: `Automação · ${par.nicho} · ${par.regiao}`,
        nicho: par.nicho,
        regiao: par.regiao,
        qualificada: true,
        soSemSite: true,
        quantidade,
        totalCriados: 0,
        totalExistentes: 0,
        userId: AUTOMACAO_USER_ID,
        origem: "automacao",
      },
      now,
    );
  }
  return id;
}

export async function executarBuscaAutomacao(
  db: AppDb,
  par: ParBusca,
  opcoes: { quantidade: number; maxPaginas: number; caps: UsageCounts; now: Date },
): Promise<ResultadoBuscaAutomacao> {
  const quantidade = Math.min(Math.max(Math.floor(opcoes.quantidade), 1), SEARCH_MAX_RESULTS);
  const buscaId = await garantirDocDoPar(db, par, quantidade, opcoes.now);
  const ctx = { userId: AUTOMACAO_USER_ID, isAdmin: false };

  const geo = await geocodeRegion(db, par.regiao, opcoes.caps, ctx);
  const resultado = await searchText(db, `${par.nicho} ${par.regiao}`, opcoes.caps, {
    quantidade,
    qualificada: true,
    soSemSite: true,
    soComTelefone: true,
    maxPaginas: opcoes.maxPaginas,
    locationRestriction: geo.viewport,
    isNovo: async (placeId) => !(await getLead(db, placeId)),
    ...ctx,
  });

  // Quem é novo, decidido ANTES do upsert (depois dele, todos existem).
  const novosIds = new Set<string>();
  for (const place of resultado.places) {
    if (!(await getLead(db, place.placeId))) novosIds.add(place.placeId);
  }
  const { criados, existentes, leads } = await upsertLeads(
    db,
    resultado.places,
    { nicho: par.nicho, regiao: par.regiao, idioma: geo.idioma },
    buscaId,
    opcoes.now,
  );
  await registrarExecucao(db, buscaId, { em: opcoes.now.toISOString(), novos: criados, existentes });
  await recalcularPenetracao(db, buscaId);

  return {
    buscaId,
    paginas: resultado.paginas,
    novos: criados,
    existentes,
    leadsNovos: leads.filter((lead) => novosIds.has(lead.placeId)),
    ...(resultado.aviso && { aviso: resultado.aviso }),
  };
}
