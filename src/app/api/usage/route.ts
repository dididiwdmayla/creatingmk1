import { NextResponse } from "next/server";

import { loadConfig, pricingFromConfig } from "@/lib/config";
import { getUsage, projectedCostUSD } from "@/lib/costs";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";

/** Uso do mês vs teto/cota grátis + custo projetado (dashboard). */
export async function GET() {
  try {
    const db = getDb();
    const config = await loadConfig(db);
    const { period, usage } = await getUsage(db);
    const usd = projectedCostUSD(usage, pricingFromConfig(config));
    return NextResponse.json({
      period,
      usage,
      caps: config.caps,
      cotaGratis: config.precos.cotaGratis,
      custoProjetado: { usd, brl: usd * config.precos.usdBrl },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
