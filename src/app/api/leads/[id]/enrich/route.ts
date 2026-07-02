import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { NotFoundError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { getLead, saveDetails } from "@/lib/leads/repo";
import { placeDetails } from "@/lib/places/client";

type Params = { params: Promise<{ id: string }> };

/**
 * Enriquecimento sob demanda via Place Details (SKU detailsPro).
 * Lead já enriquecido retorna do cache SEMPRE — nunca re-consulta o Google.
 */
export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const lead = await getLead(db, id);
    if (!lead) {
      throw new NotFoundError(`Lead "${id}" não encontrado.`);
    }
    if (lead.enriquecido) {
      return NextResponse.json({ lead });
    }

    const config = await loadConfig(db);
    const detalhes = await placeDetails(db, id, config.caps);
    const updated = await saveDetails(db, id, detalhes);
    return NextResponse.json({ lead: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
