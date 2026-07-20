import { NextResponse } from "next/server";

import { UnauthorizedError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { contarNaoLidas } from "@/lib/mensagens";
import { usuarioDaRequest } from "@/lib/usuarios";

/** Badge de não-lidas do menu (polling leve, resposta mínima). */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();
    return NextResponse.json({ total: await contarNaoLidas(db, usuario.id) });
  } catch (error) {
    return handleRouteError(error);
  }
}
