import { NextResponse } from "next/server";

import { createBusca } from "@/lib/buscas/repo";
import { loadConfig } from "@/lib/config";
import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { upsertLeads } from "@/lib/leads/repo";
import { searchText } from "@/lib/places/client";

function defaultNome(nicho: string, now: Date): string {
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${nicho} ${dd}/${mm}`;
}

/**
 * Busca leads via Text Search (SKU textSearch), faz upsert em /leads e
 * registra a busca em /buscas. nicho/regiao vêm do corpo ou, na ausência,
 * da config; a query enviada ao Google é "{nicho} {subNicho} {regiao}".
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

    const places = await searchText(db, query, config.caps);

    const buscaId = crypto.randomUUID();
    const { criados, existentes, leads } = await upsertLeads(
      db,
      places,
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

    return NextResponse.json({ criados, existentes, leads, busca });
  } catch (error) {
    return handleRouteError(error);
  }
}
