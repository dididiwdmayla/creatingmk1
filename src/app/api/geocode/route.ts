import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { ValidationError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { geocodeRegion } from "@/lib/geo/geocode";
import { handleRouteError } from "@/lib/http";

/**
 * Resolve a região da busca ("Buscando em: X" na UI, antes de confirmar).
 * Cache em /geocache: cada região só custa 1 request de geocoding na vida.
 * ?regiao= no query string; sem ele, usa a região default da config.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const param = new URL(req.url).searchParams.get("regiao");
    const config = await loadConfig(db);
    const regiao = (param ?? config.regiao).trim();
    if (!regiao) {
      throw new ValidationError([
        "informe ?regiao= ou preencha a região default na config",
      ]);
    }
    const geo = await geocodeRegion(db, regiao, config.caps);
    return NextResponse.json({
      regiao: geo.regiao,
      endereco: geo.endereco,
      location: geo.location,
      viewport: geo.viewport,
      cached: geo.cached,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
