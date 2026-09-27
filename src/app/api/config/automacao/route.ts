import { NextResponse } from "next/server";

import { loadAutomacaoConfig, saveAutomacaoConfig } from "@/lib/automacao/config";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/**
 * `/config/automacao` — a config da automação do estoque (ver
 * `lib/automacao/config.ts`). Admin nas duas pontas, mesmo critério de
 * `/api/config/fila`: é comando sobre algo que gasta cota paga e cria demo
 * em nome do time, não preferência de quem lê.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    return NextResponse.json({ automacao: await loadAutomacaoConfig(db) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const patch = await readJsonBody(req);
    return NextResponse.json({ automacao: await saveAutomacaoConfig(db, patch) });
  } catch (error) {
    return handleRouteError(error);
  }
}
