import { NextResponse, type NextRequest } from "next/server";

import {
  appPassword,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  sessionTokenFor,
} from "@/lib/auth";

/**
 * Proteção por senha única de TODO o app (páginas e API), exceto assets,
 * a página /login e /api/login. As rotas gastam dinheiro na API do Google
 * — sem sessão válida, nada passa. Aceita também o header x-app-password
 * (útil para curl e para a primeira visita antes de existir a página de
 * login); quando correto, já estabelece o cookie de sessão na resposta.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/login" || pathname === "/login") {
    return NextResponse.next();
  }

  const password = appPassword();
  if (!password) {
    return NextResponse.json(
      {
        error: {
          code: "config_error",
          message: "APP_PASSWORD não configurada no servidor (ver .env.example).",
        },
      },
      { status: 503 },
    );
  }

  const expected = await sessionTokenFor(password);
  if (request.cookies.get(SESSION_COOKIE)?.value === expected) {
    return NextResponse.next();
  }

  if (request.headers.get("x-app-password") === password) {
    const res = NextResponse.next();
    res.cookies.set(SESSION_COOKIE, expected, { ...SESSION_COOKIE_OPTIONS });
    return res;
  }

  return NextResponse.json(
    {
      error: {
        code: "unauthorized",
        message:
          "Sessão ausente ou inválida. Faça login em POST /api/login com { senha }.",
      },
    },
    { status: 401 },
  );
}

export const config = {
  // Tudo passa pela senha, menos assets estáticos do Next e arquivos públicos.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};
