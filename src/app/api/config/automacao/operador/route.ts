import { NextResponse } from "next/server";

import { montarOperador } from "@/lib/automacao/operador";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * GET /api/config/automacao/operador — nichos sem skin e pares (nicho,
 * região) saturados (ver `lib/automacao/operador.ts`). Admin, sessão, como
 * todo o painel "Automação".
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    return NextResponse.json(await montarOperador(db));
  } catch (error) {
    return handleRouteError(error);
  }
}
