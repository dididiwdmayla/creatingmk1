import { describe, expect, it } from "vitest";

import { opacidadeAura, paradasMancha, perfilMancha } from "../estilo";

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

describe("paradasMancha (a transparência PRÉ-CALCULADA do canvas)", () => {
  /**
   * As três peças que a esfera tinha no CSS — a rampa do `radial-gradient`,
   * a `opacity` do elemento e o `mix-blend-mode: screen` — viraram UMA:
   * o alfa que sai daqui já é o valor final que vai pra tela. É o que
   * permite desenhar num canvas com composição normal (source-over), sem
   * blend nenhum, e é por isso que o alfa tem que ser exatamente
   * perfil × opacidade.
   */
  it("o alfa de cada parada é o perfil medido vezes a opacidade da intensidade", () => {
    for (const i of [1, 2, 3] as const) {
      const perfil = perfilMancha(i);
      const paradas = paradasMancha(i);
      expect(paradas).toHaveLength(perfil.length);
      for (const [j, parada] of paradas.entries()) {
        expect(parada.alfa).toBeCloseTo((perfil[j].cor / 100) * opacidadeAura(i), 10);
      }
    }
  });

  it("as paradas vão de 0 a 1 (fração do raio), em ordem, e terminam transparentes", () => {
    for (const i of [1, 2, 3] as const) {
      const paradas = paradasMancha(i);
      expect(paradas[0].parada).toBe(0);
      expect(paradas.at(-1)!.alfa).toBe(0);
      for (const { parada } of paradas) {
        expect(parada).toBeGreaterThanOrEqual(0);
        expect(parada).toBeLessThanOrEqual(1);
      }
      for (let j = 1; j < paradas.length; j++) {
        expect(paradas[j].parada).toBeGreaterThan(paradas[j - 1].parada);
        expect(paradas[j].alfa).toBeLessThanOrEqual(paradas[j - 1].alfa);
      }
    }
  });

  /**
   * REGRESSÃO do ápice: a esfera nunca pode ficar MAIS opaca do que era
   * quando a rampa morava no CSS — `opacity` do elemento (0,58 no máximo)
   * vezes o ápice medido do perfil (63,5% na intensidade 3).
   */
  it("o ápice na intensidade 3 é o mesmo de antes: 0,635 × 0,58", () => {
    expect(paradasMancha(3)[0].alfa).toBeCloseTo(0.635 * 0.58, 3);
    expect(Math.max(...paradasMancha(3).map((p) => p.alfa))).toBeLessThan(0.38);
  });
});
