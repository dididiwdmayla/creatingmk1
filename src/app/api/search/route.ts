import { NextResponse } from "next/server";

import { createBusca } from "@/lib/buscas/repo";
import { loadConfig } from "@/lib/config";
import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { geocodeRegion } from "@/lib/geo/geocode";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { getLead, upsertLeads } from "@/lib/leads/repo";
import { SEARCH_MAX_RESULTS, searchText } from "@/lib/places/client";

function defaultNome(nicho: string, now: Date): string {
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${nicho} ${dd}/${mm}`;
}

/**
 * Busca leads via Text Search (SKU textSearch), faz upsert em /leads e
 * registra a busca em /buscas. nicho/regiao vêm do corpo ou, na ausência,
 * da config; a query enviada ao Google é "{nicho} {subNicho} {regiao}".
 *
 * Localização dura: a região é geocodificada (cache em /geocache, 1
 * request por região na vida) e o viewport vira locationRestriction —
 * resultado de fora da região não entra. "20 = 20 novos": a paginação
 * continua até juntar `quantidade` leads INÉDITOS na base (ou acabarem os
 * resultados), cada página reservando 1 de cota.
 */
export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const problemas: string[] = [];
    for (const key of ["nicho", "subNicho", "regiao", "nome"] as const) {
      if (body[key] !== undefined && typeof body[key] !== "string") {
        problemas.push(`${key} deve ser string`);
      }
    }
    const { quantidade, qualificada } = body;
    if (
      quantidade !== undefined &&
      (typeof quantidade !== "number" ||
        !Number.isInteger(quantidade) ||
        quantidade < 1 ||
        quantidade > SEARCH_MAX_RESULTS)
    ) {
      problemas.push(`quantidade deve ser inteiro entre 1 e ${SEARCH_MAX_RESULTS}`);
    }
    if (qualificada !== undefined && typeof qualificada !== "boolean") {
      problemas.push("qualificada deve ser booleano");
    }
    if (problemas.length > 0) {
      throw new ValidationError(problemas);
    }

    const db = getDb();
    const config = await loadConfig(db);
    const nicho = ((body.nicho as string | undefined) ?? config.nicho).trim();
    const regiao = ((body.regiao as string | undefined) ?? config.regiao).trim();
    const subNicho = ((body.subNicho as string | undefined) ?? "").trim() || undefined;
    if (!nicho || !regiao) {
      throw new ValidationError([
        "nicho e regiao devem vir no corpo ou estar preenchidos na config",
      ]);
    }

    const now = new Date();
    const nome = ((body.nome as string | undefined) ?? "").trim() || defaultNome(nicho, now);
    const query = [nicho, subNicho, regiao].filter(Boolean).join(" ");

    const geo = await geocodeRegion(db, regiao, config.caps);

    const resultado = await searchText(db, query, config.caps, {
      quantidade: quantidade as number | undefined,
      qualificada: qualificada as boolean | undefined,
      locationRestriction: geo.viewport,
      isNovo: async (placeId) => !(await getLead(db, placeId)),
    });

    const buscaId = crypto.randomUUID();
    const { criados, existentes, leads } = await upsertLeads(
      db,
      resultado.places,
      { nicho, subNicho, regiao },
      buscaId,
      now,
    );
    const busca = await createBusca(
      db,
      {
        id: buscaId,
        nome,
        nicho,
        subNicho,
        regiao,
        totalCriados: criados,
        totalExistentes: existentes,
      },
      now,
    );

    return NextResponse.json({
      criados,
      existentes,
      leads,
      busca,
      paginas: resultado.paginas,
      regiaoResolvida: geo.endereco,
      ...(resultado.aviso && { aviso: resultado.aviso }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
