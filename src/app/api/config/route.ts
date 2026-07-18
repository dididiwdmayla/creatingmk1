import { NextResponse } from "next/server";

import { loadConfig, saveConfig } from "@/lib/config";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, readJsonBody } from "@/lib/http";
import { requireAdmin } from "@/lib/usuarios";

/** GET aberto a qualquer sessão (a busca usa nicho/região/mensagem default). */
export async function GET() {
  try {
    const config = await loadConfig(getDb());
    return NextResponse.json({ config });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** PUT restrito ao admin — tetos e preços são decisão de quem paga a conta. */
export async function PUT(req: Request) {
  try {
    const db = getDb();
    await requireAdmin(db, req);
    const patch = await readJsonBody(req);
    const config = await saveConfig(db, patch);
    return NextResponse.json({ config });
  } catch (error) {
    return handleRouteError(error);
  }
}
