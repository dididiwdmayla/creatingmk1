import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, appPassword, lerSessaoToken } from "@/lib/auth";

/**
 * Proteção de TODO o app (páginas e API), exceto assets, a página /login,
 * /api/login e as demos públicas em /demo/{leadId}. As rotas gastam
 * dinheiro na API do Google — sem sessão válida, nada passa.
 *
 * Multiusuário: o cookie é um token ASSINADO (HMAC com APP_PASSWORD como
 * segredo — ver lib/auth.ts) carregando id/papel/versão do usuário. O
 * proxy só verifica a assinatura (roda no Edge, sem Firestore); as rotas
 * API ainda conferem o doc do usuário para atribuir ações e escopar
 * respostas. Sem sessão: página redireciona para /login (acesso direto
 * por URL cai no form, não num JSON de erro); rota API responde 401.
 * A página /config é restrita ao admin — membro é mandado de volta ao
 * painel.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/login" || pathname === "/login") {
    return NextResponse.next();
  }

  const secret = appPassword();
  if (!secret) {
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

  // Forja de Demos: /demo/{leadId} é a ÚNICA rota pública além do login —
  // é o link enviado ao lead. Só renderiza dados do Firestore (nunca chama
  // o Google), então não há custo exposto. Fica DEPOIS do check de
  // APP_PASSWORD: sem config, o app inteiro continua fail-closed.
  if (pathname === "/demo" || pathname.startsWith("/demo/")) {
    return NextResponse.next();
  }

  // Vercel Cron chama /api/cron com Bearer CRON_SECRET, sem cookie — a
  // rota valida o segredo ela mesma. Match EXATO: /api/cron/status (widget
  // do dashboard) continua atrás da sessão. Também depois do check de
  // APP_PASSWORD (fail-closed vale para o cron igual).
  if (pathname === "/api/cron") {
    return NextResponse.next();
  }

  const sessao = await lerSessaoToken(request.cookies.get(SESSION_COOKIE)?.value, secret);
  if (sessao) {
    if (pathname === "/config" && sessao.papel !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: {
          code: "unauthorized",
          message:
            "Sessão ausente ou inválida. Faça login em POST /api/login com { nome, senha }.",
        },
      },
      { status: 401 },
    );
  }

  // Página sem sessão (acesso direto por URL, cookie expirado…) → form de
  // login, nunca um JSON de erro.
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Tudo passa pela sessão, menos assets estáticos do Next e arquivos públicos.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};
