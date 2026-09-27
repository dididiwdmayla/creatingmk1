import { NextResponse } from "next/server";

import { desfazerDisparo, registrarDisparo } from "@/lib/automacao/disparo";
import { dispararAutomacao } from "@/lib/github/dispatch";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * POST /api/config/automacao/disparar — o "rodar agora": pede ao GitHub
 * uma execução fora do horário (`repository_dispatch` tipo
 * `automacao-estoque`, pelo mesmo `lib/github/dispatch.ts` das capturas).
 * Admin, atrás da sessão — NÃO é uma das rotas do laço, que ficam fora
 * dela.
 *
 * **Recusa com execução ativa** (409, sem chamar o GitHub): trava viva OU
 * um pedido anterior que ainda não virou execução (ver
 * `lib/automacao/disparo.ts` — sem a segunda metade, dois cliques seguidos
 * dariam duas execuções em fila). O pedido é registrado ANTES do dispatch,
 * na mesma transação da checagem; o GitHub recusando, o registro é desfeito.
 *
 * 202 disparado · 409 execução ativa · 503 sem token · 502 GitHub recusou.
 */
export async function POST(req: Request) {
  try {
    const db = getDb();
    const usuario = await requireAdmin(db, req);
    const em = await registrarDisparo(db, usuario.id);
    try {
      await dispararAutomacao({ pedidoPor: usuario.id });
    } catch (erro) {
      await desfazerDisparo(db, em);
      throw erro;
    }
    return NextResponse.json({ disparado: true, em }, { status: 202 });
  } catch (error) {
    return handleRouteError(error);
  }
}
