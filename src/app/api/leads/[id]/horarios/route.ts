import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { NotFoundError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { getLead, saveHorarios } from "@/lib/leads/repo";
import { placeHours } from "@/lib/places/client";
import { usuarioDaRequest } from "@/lib/usuarios";

type Params = { params: Promise<{ id: string }> };

/**
 * Busca dedicada de horário de funcionamento (SKU detailsProHours), para
 * leads enriquecidos ANTES desta feature (já têm `detalhes` mas não
 * `horarios`) — botão discreto "buscar horários" na ficha. Lead que já tem
 * `horarios` retorna do cache SEMPRE, igual ao enriquecimento principal.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const lead = await getLead(db, id);
    if (!lead) {
      throw new NotFoundError(`Lead "${id}" não encontrado.`);
    }
    if (lead.horarios) {
      return NextResponse.json({ lead });
    }

    const usuario = await usuarioDaRequest(db, req);
    const config = await loadConfig(db);
    const horarios = await placeHours(db, id, config.caps, usuario?.id);
    const updated = await saveHorarios(db, id, horarios);
    return NextResponse.json({ lead: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
