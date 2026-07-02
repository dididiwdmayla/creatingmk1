import { describe, expect, it } from "vitest";

import { projectedCostBRL, projectedCostUSD } from "../cost";
import { ZERO_USAGE, type PricingTable } from "../skus";

const PRICING: PricingTable = {
  textSearch: { usdPer1000: 32, freeQuota: 10_000 },
  detailsEssentials: { usdPer1000: 5, freeQuota: 10_000 },
  detailsPro: { usdPer1000: 17, freeQuota: 5_000 },
};

describe("projectedCostUSD", () => {
  it("é 0 sem uso", () => {
    expect(projectedCostUSD(ZERO_USAGE, PRICING)).toBe(0);
  });

  it("é 0 dentro da cota grátis", () => {
    const usage = { textSearch: 9_999, detailsEssentials: 500, detailsPro: 4_000 };
    expect(projectedCostUSD(usage, PRICING)).toBe(0);
  });

  it("é 0 exatamente na cota grátis", () => {
    const usage = { textSearch: 10_000, detailsEssentials: 10_000, detailsPro: 5_000 };
    expect(projectedCostUSD(usage, PRICING)).toBe(0);
  });

  it("cobra só o excedente além da cota grátis", () => {
    const usage = { ...ZERO_USAGE, textSearch: 11_000 };
    // 1.000 excedentes × $32/1000 = $32
    expect(projectedCostUSD(usage, PRICING)).toBe(32);
  });

  it("soma o excedente de múltiplos SKUs", () => {
    const usage = {
      textSearch: 10_500, //   500 × $32/1000 = $16
      detailsEssentials: 12_000, // 2.000 × $5/1000  = $10
      detailsPro: 5_100, //   100 × $17/1000 = $1,70
    };
    expect(projectedCostUSD(usage, PRICING)).toBeCloseTo(27.7, 10);
  });

  it("respeita tabela de preços customizada (override via config)", () => {
    const custom: PricingTable = {
      textSearch: { usdPer1000: 10, freeQuota: 0 },
      detailsEssentials: { usdPer1000: 0, freeQuota: 0 },
      detailsPro: { usdPer1000: 0, freeQuota: 0 },
    };
    expect(projectedCostUSD({ ...ZERO_USAGE, textSearch: 500 }, custom)).toBe(5);
  });
});

describe("projectedCostBRL", () => {
  it("converte pelo câmbio configurado", () => {
    const usage = { ...ZERO_USAGE, textSearch: 11_000 }; // $32
    expect(projectedCostBRL(usage, 5.5, PRICING)).toBeCloseTo(176, 10);
  });

  it("é 0 em R$ quando é 0 em USD", () => {
    expect(projectedCostBRL(ZERO_USAGE, 5.5, PRICING)).toBe(0);
  });
});
