import { NextResponse } from "next/server";

import { loadConfig, pricingFromConfig } from "@/lib/config";
import { ZERO_USAGE, getUsage, projectedCostUSD } from "@/lib/costs";
import { getDb } from "@/lib/firebase/admin";
import { handleRouteError } from "@/lib/http";
import { listUsuarios, usuarioDaRequest } from "@/lib/usuarios";

/**
 * Uso do mês vs teto/cota grátis + custo projetado (dashboard), escopado
 * por papel: membro vê SÓ os próprios requests (quebra dele no doc de
 * uso); admin vê o agregado E a quebra `porUsuario` (requests por SKU,
 * com nome). O custo projetado é sempre calculado sobre o `usage`
 * devolvido — para o membro, o custo do uso DELE.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const usuario = await usuarioDaRequest(db, req);
    const config = await loadConfig(db);
    const { period, usage, porUsuario } = await getUsage(db);
    const pricing = pricingFromConfig(config);

    const proprio =
      usuario && usuario.papel !== "admin"
        ? (porUsuario[usuario.id] ?? { ...ZERO_USAGE })
        : usage;
    const usd = projectedCostUSD(proprio, pricing);

    const base = {
      period,
      usage: proprio,
      caps: config.caps,
      cotaGratis: config.precos.cotaGratis,
      custoProjetado: { usd, brl: usd * config.precos.usdBrl },
    };
    if (!usuario || usuario.papel !== "admin") {
      return NextResponse.json(base);
    }

    const nomes = new Map((await listUsuarios(db)).map((u) => [u.id, u.nome]));
    const quebra = Object.entries(porUsuario)
      .map(([userId, counts]) => ({
        userId,
        nome: nomes.get(userId) ?? userId,
        usage: counts,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return NextResponse.json({ ...base, porUsuario: quebra });
  } catch (error) {
    return handleRouteError(error);
  }
}
