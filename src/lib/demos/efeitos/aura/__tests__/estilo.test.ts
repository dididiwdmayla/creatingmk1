import { describe, expect, it } from "vitest";

import { fundoMancha, opacidadeAura, perfilMancha } from "../estilo";

describe("perfilMancha (a rampa que substituiu o filter: blur)", () => {
  it("começa no ápice medido e termina em transparente", () => {
    for (const i of [1, 2, 3] as const) {
      const p = perfilMancha(i);
      expect(p[0].parada).toBe(0);
      expect(p[0].cor).toBeGreaterThan(60);
      expect(p[p.length - 1].cor).toBe(0);
    }
  });

  it("cai de forma monotônica — nenhuma parada acende de volta", () => {
    for (const i of [1, 2, 3] as const) {
      const p = perfilMancha(i);
      for (let j = 1; j < p.length; j++) {
        expect(p[j].cor).toBeLessThanOrEqual(p[j - 1].cor);
        expect(p[j].parada).toBeGreaterThan(p[j - 1].parada);
      }
    }
  });

  /**
   * A regra de acabamento: nada pode terminar em aresta. Uma rampa de dois
   * stops tem inclinação constante e o olho lê o fim dela como contorno —
   * a última queda antes do transparente tem que ser a MENOR de todas.
   */
  it("nenhuma aresta no fim: o último degrau é o mais suave da rampa", () => {
    for (const i of [1, 2, 3] as const) {
      const p = perfilMancha(i);
      const degraus = p.slice(1).map((parada, j) => p[j].cor - parada.cor);
      const ultimo = degraus[degraus.length - 1];
      expect(ultimo).toBeLessThan(Math.max(...degraus));
      expect(ultimo).toBeLessThan(6);
    }
  });

  /**
   * O blur escalava com a intensidade (60/80/100px): intensidade maior era
   * mancha mais DIFUSA, não só mais opaca. Sem isso a rampa teria jogado
   * fora metade do controle.
   */
  it("intensidade maior = mancha mais difusa (cauda mais longa, ápice menor)", () => {
    const [p1, p2, p3] = [1, 2, 3].map((i) => perfilMancha(i as 1 | 2 | 3));
    // Onde a mancha ainda tem cor: a última parada com valor > 0.
    const fim = (p: ReturnType<typeof perfilMancha>) =>
      p.filter((parada) => parada.cor > 0).at(-1)!.parada;
    expect(fim(p1)).toBeLessThan(fim(p2));
    expect(fim(p2)).toBeLessThan(fim(p3));
    expect(p1[0].cor).toBeGreaterThan(p2[0].cor);
    expect(p2[0].cor).toBeGreaterThan(p3[0].cor);
  });

  it("opacidade do blob inalterada — 0.38 / 0.48 / 0.58", () => {
    expect(opacidadeAura(1)).toBeCloseTo(0.38);
    expect(opacidadeAura(2)).toBeCloseTo(0.48);
    expect(opacidadeAura(3)).toBeCloseTo(0.58);
  });
});

describe("fundoMancha", () => {
  it("monta um radial-gradient que termina em transparent e usa a cor recebida", () => {
    const css = fundoMancha("var(--d-efeito-c1, #d8a657)", 2);
    expect(css.startsWith("radial-gradient(circle closest-side, ")).toBe(true);
    expect(css).toContain("var(--d-efeito-c1, #d8a657)");
    expect(css.trimEnd().endsWith("%)")).toBe(true);
    expect(css).toContain("transparent");
  });

  /**
   * REGRESSÃO: o blob recebe um `transform` novo a cada quadro (rAF). Com
   * `filter`, o navegador re-rasteriza e re-borra 60vmax de superfície a
   * cada movimento — 12,7 fps medidos contra ~60 sem o filtro. A suavidade
   * mora na rampa; `filter` não pode reaparecer aqui de nenhuma forma.
   */
  it("nunca produz um filter — a suavidade é a rampa, não um blur", () => {
    for (const i of [1, 2, 3] as const) {
      expect(fundoMancha("#d8a657", i)).not.toContain("blur");
      expect(fundoMancha("#d8a657", i)).not.toContain("filter");
    }
  });
});
