import { NextResponse } from "next/server";

import {
  appPassword,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  sessionTokenFor,
} from "@/lib/auth";
import { handleRouteError, jsonError, readJsonBody } from "@/lib/http";

/**
 * Única rota fora da proteção do proxy: recebe { senha } e estabelece o
 * cookie de sessão. A futura página /login fará POST aqui.
 */
export async function POST(req: Request) {
  try {
    const password = appPassword();
    if (!password) {
      return jsonError(
        503,
        "config_error",
        "APP_PASSWORD não configurada no servidor (ver .env.example).",
      );
    }

    const body = await readJsonBody(req);
    if (body.senha !== password) {
      return jsonError(401, "invalid_password", "Senha incorreta.");
    }

    const res = new NextResponse(null, { status: 204 });
    res.cookies.set(SESSION_COOKIE, await sessionTokenFor(password), {
      ...SESSION_COOKIE_OPTIONS,
    });
    return res;
  } catch (error) {
    return handleRouteError(error);
  }
}
