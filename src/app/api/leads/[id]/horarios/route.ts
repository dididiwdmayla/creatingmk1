import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
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

    // Mesma exigência de search/enrich: sessão precisa resolver de verdade
    // (mesmo esta rota nunca contando pra cota individual — é consistência
    // de política, e o bypass de admin no teto global depende de saber o
    // papel de quem chama).
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const lead = await getLead(db, id);
    if (!lead) {
      throw new NotFoundError(`Lead "${id}" não encontrado.`);
    }
    if (lead.horarios) {
      return NextResponse.json({ lead });
    }

    const config = await loadConfig(db);
    const horarios = await placeHours(db, id, config.caps, {
      userId: usuario.id,
      isAdmin: usuario.papel === "admin",
    });
    const updated = await saveHorarios(db, id, horarios);
    return NextResponse.json({ lead: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
