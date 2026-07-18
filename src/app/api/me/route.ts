import { NextResponse } from "next/server";

import { UnauthorizedError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { publico, usuarioDaRequest } from "@/lib/usuarios";

/** Quem sou eu — a UI usa para escopar o que mostra (papel, nome). */
export async function GET(req: Request) {
  try {
    const usuario = await usuarioDaRequest(getDb(), req);
    if (!usuario) throw new UnauthorizedError();
    return NextResponse.json({ usuario: publico(usuario) });
  } catch (error) {
    return handleRouteError(error);
  }
}
