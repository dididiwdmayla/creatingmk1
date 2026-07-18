import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { NotFoundError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { getLead, saveDetails } from "@/lib/leads/repo";
import { placeDetails } from "@/lib/places/client";
import { usuarioDaRequest } from "@/lib/usuarios";

type Params = { params: Promise<{ id: string }> };

/**
 * Enriquecimento sob demanda via Place Details (SKU detailsEnterprise).
 * Lead já enriquecido retorna do cache SEMPRE — nunca re-consulta o Google.
 * Ação-chave: a reserva de cota e o carimbo `enriquecidoPor` registram o
 * usuário logado.
 */
export async function POST(req: Request, { params }: Params) {
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

    const usuario = await usuarioDaRequest(db, req);
    const config = await loadConfig(db);
    const detalhes = await placeDetails(db, id, config.caps, usuario?.id);
    const updated = await saveDetails(db, id, detalhes, undefined, usuario?.id);
    return NextResponse.json({ lead: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
