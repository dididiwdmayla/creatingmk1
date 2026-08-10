import { describe, expect, it } from "vitest";

import { custoIncrementalUSD, projectedCostBRL, projectedCostUSD } from "../cost";
import { ZERO_USAGE, type PricingTable } from "../skus";

const PRICING: PricingTable = {
  textSearch: { usdPer1000: 32, freeQuota: 5_000 },
  textSearchEnterprise: { usdPer1000: 35, freeQuota: 1_000 },
  detailsEssentials: { usdPer1000: 5, freeQuota: 10_000 },
  detailsEnterprise: { usdPer1000: 20, freeQuota: 1_000 },
  detailsProHours: { usdPer1000: 17, freeQuota: 5_000 },
  geocoding: { usdPer1000: 5, freeQuota: 10_000 },
  aiGeneration: { usdPer1000: 0, freeQuota: 50 },
  aiTraducao: { usdPer1000: 0, freeQuota: 30 },
};

describe("projectedCostUSD", () => {
  it("é 0 sem uso", () => {
    expect(projectedCostUSD(ZERO_USAGE, PRICING)).toBe(0);
  });

  it("é 0 dentro da cota grátis", () => {
    const usage = {
      textSearch: 4_999,
      textSearchEnterprise: 500,
      detailsEssentials: 500,
      detailsEnterprise: 900,
      detailsProHours: 4_999,
      geocoding: 100,
      aiGeneration: 10,
      aiTraducao: 0,
    };
    expect(projectedCostUSD(usage, PRICING)).toBe(0);
  });

  it("é 0 exatamente na cota grátis", () => {
    const usage = {
      textSearch: 5_000,
      textSearchEnterprise: 1_000,
      detailsEssentials: 10_000,
      detailsEnterprise: 1_000,
      detailsProHours: 5_000,
      geocoding: 10_000,
      aiGeneration: 50,
      aiTraducao: 0,
    };
    expect(projectedCostUSD(usage, PRICING)).toBe(0);
  });

  it("cobra só o excedente além da cota grátis", () => {
    const usage = { ...ZERO_USAGE, textSearch: 6_000 };
    // 1.000 excedentes × $32/1000 = $32
    expect(projectedCostUSD(usage, PRICING)).toBe(32);
  });

  it("soma o excedente de múltiplos SKUs", () => {
    const usage = {
      textSearch: 5_500, //   500 × $32/1000 = $16
      textSearchEnterprise: 1_200, //   200 × $35/1000 = $7
      detailsEssentials: 12_000, // 2.000 × $5/1000  = $10
      detailsEnterprise: 1_100, //   100 × $20/1000 = $2
      detailsProHours: 5_100, //   100 × $17/1000 = $1,7
      geocoding: 12_000, // 2.000 × $5/1000  = $10
      aiGeneration: 200, //   preço 0: excedente não custa nada
      aiTraducao: 0,
    };
    expect(projectedCostUSD(usage, PRICING)).toBeCloseTo(46.7, 10);
  });

  it("respeita tabela de preços customizada (override via config)", () => {
    const custom: PricingTable = {
      textSearch: { usdPer1000: 10, freeQuota: 0 },
      textSearchEnterprise: { usdPer1000: 0, freeQuota: 0 },
      detailsEssentials: { usdPer1000: 0, freeQuota: 0 },
      detailsEnterprise: { usdPer1000: 0, freeQuota: 0 },
      detailsProHours: { usdPer1000: 0, freeQuota: 0 },
      geocoding: { usdPer1000: 0, freeQuota: 0 },
      aiGeneration: { usdPer1000: 0, freeQuota: 0 },
      aiTraducao: { usdPer1000: 0, freeQuota: 30 },
    };
    expect(projectedCostUSD({ ...ZERO_USAGE, textSearch: 500 }, custom)).toBe(5);
  });
});

describe("projectedCostBRL", () => {
  it("converte pelo câmbio configurado", () => {
    const usage = { ...ZERO_USAGE, textSearch: 6_000 }; // $32
    expect(projectedCostBRL(usage, 5.5, PRICING)).toBeCloseTo(176, 10);
  });

  it("é 0 em R$ quando é 0 em USD", () => {
    expect(projectedCostBRL(ZERO_USAGE, 5.5, PRICING)).toBe(0);
  });
});

describe("custoIncrementalUSD", () => {
  const sku = { usdPer1000: 20, freeQuota: 1_000 };

  it("é 0 quando as chamadas cabem na cota grátis", () => {
    expect(custoIncrementalUSD(990, 2, sku)).toBe(0);
  });

  it("cobra só a parte que atravessa a cota grátis", () => {
    // 999 usadas + 3 chamadas = 1.002 → 2 cobráveis × US$20/1.000.
    expect(custoIncrementalUSD(999, 3, sku)).toBeCloseTo(0.04);
  });

  it("já fora da cota, cobra as chamadas inteiras", () => {
    expect(custoIncrementalUSD(2_000, 2, sku)).toBeCloseTo(0.04);
  });

  it("nenhuma chamada não custa nada, mesmo fora da cota", () => {
    expect(custoIncrementalUSD(2_000, 0, sku)).toBe(0);
  });

  it("SKU de graça (IA) é sempre 0", () => {
    expect(custoIncrementalUSD(100, 2, { usdPer1000: 0, freeQuota: 30 })).toBe(0);
  });
});
