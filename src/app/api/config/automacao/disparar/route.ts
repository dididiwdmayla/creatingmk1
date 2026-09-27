import { NextResponse } from "next/server";

import { dispararAutomacao } from "@/lib/github/dispatch";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * POST /api/config/automacao/disparar — o "rodar agora": pede ao GitHub
 * uma execução fora do horário (`repository_dispatch` tipo
 * `automacao-estoque`, pelo mesmo `lib/github/dispatch.ts` das capturas).
 * Admin, atrás da sessão — NÃO é uma das rotas do laço, que ficam fora
 * dela. O workflow cuida do resto: se outra execução estiver com a trava,
 * esta é recusada e fica registrada.
 *
 * 202 disparado · 503 sem token · 502 GitHub recusou.
 */
export async function POST(req: Request) {
  try {
    const usuario = await requireAdmin(getDb(), req);
    await dispararAutomacao({ pedidoPor: usuario.id });
    return NextResponse.json({ disparado: true }, { status: 202 });
  } catch (error) {
    return handleRouteError(error);
  }
}
