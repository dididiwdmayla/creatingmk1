import { NextResponse } from "next/server";

import { lerEventosDoPainel } from "@/lib/fila/eventos";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `GET /api/config/fila/eventos` — as respostas de ERRO das rotas do
 * aparelho (ver `lib/fila/eventos.ts`): o total do dia operacional e os
 * últimos eventos de hoje e de ontem.
 *
 * Sob `/api/config/` e restrita ao admin, como todo o painel "Fila de
 * envio": 401 sem sessão, 403 para membro.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    return NextResponse.json(await lerEventosDoPainel(db, new Date()));
  } catch (error) {
    return handleRouteError(error);
  }
}
