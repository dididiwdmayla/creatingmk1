import { NextResponse } from "next/server";

import { executarBuscasRecorrentes } from "@/lib/buscas/cron";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError, jsonError } from "@/lib/http";

/**
 * Gatilho diário do Vercel Cron (ver vercel.json): re-executa as buscas
 * recorrentes de madrugada. ÚNICA rota de API fora da sessão (exceção no
 * proxy) — protegida pelo header `Authorization: Bearer ${CRON_SECRET}`,
 * exatamente o que o Vercel Cron envia. Fail-closed: sem CRON_SECRET
 * configurada, a rota responde 503 e nada roda.
 */
export async function GET(req: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return jsonError(
        503,
        "config_error",
        "CRON_SECRET não configurada no servidor (ver .env.example).",
      );
    }
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return jsonError(401, "unauthorized", "CRON_SECRET inválido ou ausente.");
    }

    const execucao = await executarBuscasRecorrentes(getDb());
    return NextResponse.json({ execucao });
  } catch (error) {
    return handleRouteError(error);
  }
}
