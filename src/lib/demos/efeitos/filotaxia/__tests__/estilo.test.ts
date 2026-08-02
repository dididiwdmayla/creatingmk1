import { describe, expect, it } from "vitest";

import { pontosFilotaxia } from "../estilo";

describe("pontosFilotaxia", () => {
  it("contagem escala com a intensidade e é determinística (sem Math.random)", () => {
    expect(pontosFilotaxia(1).length).toBeLessThan(pontosFilotaxia(2).length);
    expect(pontosFilotaxia(2).length).toBeLessThan(pontosFilotaxia(3).length);
    expect(pontosFilotaxia(2)).toEqual(pontosFilotaxia(2));
  });

  it("o ponto central (i=0) nasce no centro (deslocamento zero)", () => {
    expect(pontosFilotaxia(2)[0]).toMatchObject({ xVmin: 0, yVmin: 0 });
  });

  it("decaimento por idade: o ponto central (mais velho) é mais desbotado que o da borda (mais novo)", () => {
    const pontos = pontosFilotaxia(3);
    const central = pontos[0];
    const daBorda = pontos[pontos.length - 1];
    expect(central.opacidade).toBeLessThan(daBorda.opacidade);
  });

  it("respeita o teto de 6% de opacidade para forma geométrica", () => {
    for (const i of [1, 2, 3] as const) {
      for (const p of pontosFilotaxia(i)) expect(p.opacidade).toBeLessThanOrEqual(0.06);
    }
  });

  it("o raio máximo cabe em meia viewport (deslocamento medido em vmin)", () => {
    for (const p of pontosFilotaxia(3)) {
      expect(Math.hypot(p.xVmin, p.yVmin)).toBeLessThanOrEqual(45);
    }
  });

  it("tamanho e suavidade variam continuamente — nada de dois carimbos repetidos", () => {
    const pontos = pontosFilotaxia(3);
    expect(new Set(pontos.map((p) => p.raioPx)).size).toBeGreaterThan(10);
    expect(new Set(pontos.map((p) => p.nucleoPercent)).size).toBeGreaterThan(3);
  });
});
