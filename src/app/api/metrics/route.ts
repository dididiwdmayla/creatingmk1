import { NextResponse } from "next/server";

import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { getMetrics } from "@/lib/leads/metrics";

/** Métricas de prospecção: contatos hoje/semana e taxa de resposta. */
export async function GET() {
  try {
    const metrics = await getMetrics(getDb());
    return NextResponse.json(metrics);
  } catch (error) {
    return handleRouteError(error);
  }
}
