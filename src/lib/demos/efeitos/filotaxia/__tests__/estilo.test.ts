import { describe, expect, it } from "vitest";

import { pontosFilotaxia } from "../estilo";

describe("pontosFilotaxia", () => {
  it("contagem escala com a intensidade e é determinística (sem Math.random)", () => {
    expect(pontosFilotaxia(1).length).toBeLessThan(pontosFilotaxia(2).length);
    expect(pontosFilotaxia(2).length).toBeLessThan(pontosFilotaxia(3).length);
    expect(pontosFilotaxia(2)).toEqual(pontosFilotaxia(2));
  });

  it("o ponto central (i=0) nasce em 50%/50%", () => {
    expect(pontosFilotaxia(2)[0]).toMatchObject({ xPercent: 50, yPercent: 50 });
  });

  it("decaimento por idade: o ponto central (mais velho) é mais desbotado que o da borda (mais novo)", () => {
    const pontos = pontosFilotaxia(3);
    const central = pontos[0];
    const daBorda = pontos[pontos.length - 1];
    expect(central.opacidade).toBeLessThan(daBorda.opacidade);
  });

  it("nenhum ponto passa muito da borda da viewport (raio máximo contido)", () => {
    for (const p of pontosFilotaxia(3)) {
      expect(p.xPercent).toBeGreaterThan(0);
      expect(p.xPercent).toBeLessThan(100);
      expect(p.yPercent).toBeGreaterThan(0);
      expect(p.yPercent).toBeLessThan(100);
    }
  });
});
