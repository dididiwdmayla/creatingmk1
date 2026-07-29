import { NextResponse } from "next/server";

import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { getLead, registrarSeloContato } from "@/lib/leads/repo";
import { usuarioDaRequest } from "@/lib/usuarios";

type Params = { params: Promise<{ id: string }> };

/**
 * Selo "já contatou este lead": chamado ao clicar no botão WhatsApp, à
 * parte da transição de status. Primeiro clique prevalece — chamadas
 * seguintes (mesmo usuário, ou outro depois de confirmar o modal de
 * "já contatado") são idempotentes.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const lead = await getLead(db, id);
    if (!lead) {
      throw new NotFoundError(`Lead "${id}" não encontrado.`);
    }

    const updated = await registrarSeloContato(db, id, usuario.id);
    return NextResponse.json({ lead: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
