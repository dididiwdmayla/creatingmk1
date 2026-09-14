import { NextResponse } from "next/server";

import { loadFilaConfig, saveFilaConfig } from "@/lib/fila/config";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `/config/fila` — mesma divisão de `/api/config`: GET aberto a qualquer
 * sessão (o painel só mostra estado), PUT restrito ao admin (pausa/tetos
 * são decisão de quem opera a fila). Doc PRÓPRIO (ver `lib/fila/config.ts`)
 * — não é o mesmo documento de `/api/config`.
 */
export async function GET() {
  try {
    const fila = await loadFilaConfig(getDb());
    return NextResponse.json({ fila });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const patch = await readJsonBody(req);
    const fila = await saveFilaConfig(db, patch);
    return NextResponse.json({ fila });
  } catch (error) {
    return handleRouteError(error);
  }
}
