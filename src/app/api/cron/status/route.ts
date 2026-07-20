import { NextResponse } from "next/server";

import { getUltimaExecucaoCron } from "@/lib/buscas/cron";
import { listBuscasRecorrentes } from "@/lib/buscas/repo";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";

/**
 * Widget do dashboard: a última rodada do cron (quando rodou, quanto
 * achou) + quantas buscas recorrentes estão ligadas. Rota normal atrás
 * da sessão (a exceção do proxy é só para /api/cron exato).
 */
export async function GET() {
  try {
    const db = getDb();
    const [ultima, recorrentes] = await Promise.all([
      getUltimaExecucaoCron(db),
      listBuscasRecorrentes(db),
    ]);
    return NextResponse.json({ ultima, recorrentes: recorrentes.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
