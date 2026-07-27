import { NextResponse } from "next/server";

import { zerarCotaDia } from "@/lib/costs";
import { NotFoundError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { getUsuario, requireAdmin } from "@/lib/usuarios";

type Params = { params: Promise<{ id: string }> };

/**
 * "Zerar dia" do painel admin: sobrescreve o doc do dia corrente do
 * usuário com os contadores em zero. Não afeta outros dias — reduz de
 * quebra a soma da semana/mês corrente (são agregações puras sobre os
 * dias, sem doc próprio pra zerar).
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    await requireAdmin(db, req);

    const usuario = await getUsuario(db, id);
    if (!usuario) {
      throw new NotFoundError(`Usuário "${id}" não encontrado.`);
    }

    await zerarCotaDia(db, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
