import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { upsertLeads } from "@/lib/leads/repo";
import { searchText } from "@/lib/places/client";

/**
 * Busca leads via Text Search (SKU textSearch) e faz upsert em /leads.
 * nicho/regiao vêm do corpo ou, na ausência, da config.
 */
export async function POST(req: Request) {
  try {
    const body = await readJsonBody(req);
    const problemas: string[] = [];
    for (const key of ["nicho", "regiao"] as const) {
      if (body[key] !== undefined && typeof body[key] !== "string") {
        problemas.push(`${key} deve ser string`);
      }
    }
    if (problemas.length > 0) {
      throw new ValidationError(problemas);
    }

    const db = getDb();
    const config = await loadConfig(db);
    const nicho = (body.nicho as string | undefined) ?? config.nicho;
    const regiao = (body.regiao as string | undefined) ?? config.regiao;
    if (!nicho.trim() || !regiao.trim()) {
      throw new ValidationError([
        "nicho e regiao devem vir no corpo ou estar preenchidos na config",
      ]);
    }

    const places = await searchText(db, `${nicho} em ${regiao}`, config.caps);
    const { criados, existentes, leads } = await upsertLeads(db, places, {
      nicho,
      regiao,
    });
    return NextResponse.json({ criados, existentes, leads });
  } catch (error) {
    return handleRouteError(error);
  }
}
