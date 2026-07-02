import { DEFAULT_PRICING, SKUS, type PricingTable, type UsageCounts } from "./skus";

/**
 * Custo projetado do mês em USD: soma, por SKU, do excedente além da cota
 * grátis vezes o preço por 1.000 requests. Dentro da cota grátis = 0.
 */
export function projectedCostUSD(
  usage: UsageCounts,
  pricing: PricingTable = DEFAULT_PRICING,
): number {
  let total = 0;
  for (const sku of SKUS) {
    const { usdPer1000, freeQuota } = pricing[sku];
    const billable = Math.max(0, usage[sku] - freeQuota);
    total += (billable / 1000) * usdPer1000;
  }
  return total;
}

/** Custo projetado em R$, dado o câmbio USD→BRL configurado. */
export function projectedCostBRL(
  usage: UsageCounts,
  usdBrl: number,
  pricing: PricingTable = DEFAULT_PRICING,
): number {
  return projectedCostUSD(usage, pricing) * usdBrl;
}
