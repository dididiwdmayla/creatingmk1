import { describe, expect, it } from "vitest";

import { projecaoTraducaoDemo } from "../custoTraducaoDemo";

describe("projecaoTraducaoDemo", () => {
  it("dentro da cota grátis, custo zero e sem estouro", () => {
    const projecao = projecaoTraducaoDemo(0, 50, { usdPer1000: 0, freeQuota: 50 }, 5.5);
    expect(projecao.custoBRL).toBe(0);
    expect(projecao.podeEstourar).toBe(false);
  });

  it("acima da cota grátis, cobra pela chamada incremental", () => {
    const projecao = projecaoTraducaoDemo(1000, 2000, { usdPer1000: 10, freeQuota: 50 }, 5);
    // 1 chamada a mais, já fora da cota grátis: 10/1000 * 1 * 5 = 0.05
    expect(projecao.custoBRL).toBeCloseTo(0.05, 5);
  });

  it("podeEstourar quando usado + 1 > teto", () => {
    expect(projecaoTraducaoDemo(49, 50, { usdPer1000: 0, freeQuota: 50 }, 5).podeEstourar).toBe(
      false,
    );
    expect(projecaoTraducaoDemo(50, 50, { usdPer1000: 0, freeQuota: 50 }, 5).podeEstourar).toBe(
      true,
    );
  });
});
