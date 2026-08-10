import {
  DEFAULT_PRICING,
  SKUS,
  type PricingTable,
  type SkuPricing,
  type UsageCounts,
} from "./skus";

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

/**
 * Custo em USD de N chamadas A MAIS de um SKU, dado o quanto dele já foi
 * usado no mês. É a diferença entre a conta depois e a conta agora, e não
 * o preço cheio de N chamadas: dentro da cota grátis o incremento é 0, e
 * atravessando a cota só a parte excedente é cobrada.
 *
 * Existe para a confirmação de uma ação paga poder dizer o custo REAL
 * daquele clique antes de o usuário confirmar (ver a tradução das frases).
 */
export function custoIncrementalUSD(
  usado: number,
  chamadas: number,
  { usdPer1000, freeQuota }: SkuPricing,
): number {
  const cobravel = (total: number) => Math.max(0, total - freeQuota);
  const base = Math.max(0, usado);
  return ((cobravel(base + Math.max(0, chamadas)) - cobravel(base)) / 1000) * usdPer1000;
}

/** Custo projetado em R$, dado o câmbio USD→BRL configurado. */
export function projectedCostBRL(
  usage: UsageCounts,
  usdBrl: number,
  pricing: PricingTable = DEFAULT_PRICING,
): number {
  return projectedCostUSD(usage, pricing) * usdBrl;
}
