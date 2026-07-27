import { NextResponse } from "next/server";

import { getUsoUsuario } from "@/lib/costs";
import { UnauthorizedError } from "@/lib/errors";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { usuarioDaRequest } from "@/lib/usuarios";

/**
 * Cota individual do usuário LOGADO (dia/semana/mês × buscas/
 * enriquecimentos) — alimenta o indicador permanente na tela de busca e na
 * ficha do lead. Admin nunca tem limite aplicado; a rota ainda responde
 * (útil pra conferir o próprio uso), só que `limite` vem sempre ausente.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    if (!usuario) throw new UnauthorizedError();

    const now = new Date();
    const limites = usuario.papel === "admin" ? undefined : usuario.limites;
    const [buscas, enriquecimentos] = await Promise.all([
      getUsoUsuario(db, usuario.id, "buscas", limites, now),
      getUsoUsuario(db, usuario.id, "enriquecimentos", limites, now),
    ]);

    return NextResponse.json({ buscas, enriquecimentos });
  } catch (error) {
    return handleRouteError(error);
  }
}
