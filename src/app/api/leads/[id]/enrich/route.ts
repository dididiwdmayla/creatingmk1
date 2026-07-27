import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/config";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { getLead, saveDetails, saveHorarios } from "@/lib/leads/repo";
import { placeDetails, placeHours } from "@/lib/places/client";
import { usuarioDaRequest } from "@/lib/usuarios";

type Params = { params: Promise<{ id: string }> };

/**
 * Enriquecimento sob demanda via Place Details (SKU detailsEnterprise).
 * Lead já enriquecido retorna do cache SEMPRE — nunca re-consulta o Google.
 * Ação-chave: a reserva de cota e o carimbo `enriquecidoPor` registram o
 * usuário logado.
 *
 * Horário de funcionamento (SKU detailsProHours, contador PRÓPRIO) é
 * buscado JUNTO — 2 requests distintos ao Google. Falha nesse 2º request
 * (teto do Pro estourado, erro do Google) não derruba o enriquecimento
 * principal, que já foi salvo: o lead fica sem horário e o botão dedicado
 * "buscar horários" cobre depois.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    // Ação-chave sujeita a cota INDIVIDUAL: diferente do resto do app,
    // aqui a sessão precisa resolver de verdade — sem usuário não dá pra
    // aplicar o limite dele.
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const lead = await getLead(db, id);
    if (!lead) {
      throw new NotFoundError(`Lead "${id}" não encontrado.`);
    }
    if (lead.enriquecido) {
      return NextResponse.json({ lead });
    }

    const isAdmin = usuario.papel === "admin";
    const config = await loadConfig(db);
    const detalhes = await placeDetails(db, id, config.caps, {
      userId: usuario.id,
      isAdmin,
      limitesUsuario: usuario.limites,
    });
    let updated = await saveDetails(db, id, detalhes, undefined, usuario.id);

    try {
      const horarios = await placeHours(db, id, config.caps, { userId: usuario.id, isAdmin });
      updated = await saveHorarios(db, id, horarios);
    } catch {
      // Enriquecimento principal já persistido — horário fica pendente.
    }

    return NextResponse.json({ lead: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
