import { describe, expect, it } from "vitest";

import {
  deslocarMatiz,
  ehHex,
  hexParaHsl,
  hslCss,
  hslParaRgb,
  limitarLuminancia,
  luminanciaRelativa,
  normalizarMatiz,
} from "../hsl";

describe("hexParaHsl", () => {
  it("converte primárias com matiz e saturação corretos", () => {
    expect(hexParaHsl("#ff0000")).toEqual({ h: 0, s: 1, l: 0.5 });
    expect(hexParaHsl("#00ff00")).toEqual({ h: 120, s: 1, l: 0.5 });
    expect(hexParaHsl("#0000ff")).toEqual({ h: 240, s: 1, l: 0.5 });
  });

  it("aceita a forma curta #rgb", () => {
    expect(hexParaHsl("#f00")).toEqual(hexParaHsl("#ff0000"));
  });

  it("cinza tem saturação zero (e não NaN)", () => {
    const cinza = hexParaHsl("#808080");
    expect(cinza?.s).toBe(0);
    expect(Number.isNaN(cinza?.h)).toBe(false);
  });

  it("devolve undefined para o que não é hex — o sinal que faz o modo cair no tema", () => {
    expect(hexParaHsl("rgba(255,255,255,0.1)")).toBeUndefined();
    expect(hexParaHsl("color-mix(in srgb, red 50%, blue)")).toBeUndefined();
    expect(hexParaHsl(undefined)).toBeUndefined();
    expect(hexParaHsl("#12345")).toBeUndefined();
    expect(ehHex("#abcdef")).toBe(true);
    expect(ehHex("abcdef")).toBe(false);
  });
});

describe("matiz", () => {
  it("normaliza para [0,360) nos dois sentidos", () => {
    expect(normalizarMatiz(370)).toBe(10);
    expect(normalizarMatiz(-30)).toBe(330);
    expect(normalizarMatiz(360)).toBe(0);
  });

  it("deslocar preserva saturação e luminosidade", () => {
    const base = { h: 350, s: 0.4, l: 0.6 };
    const deslocada = deslocarMatiz(base, 30);
    expect(deslocada).toEqual({ h: 20, s: 0.4, l: 0.6 });
  });
});

describe("hslCss", () => {
  it("sai na sintaxe moderna, recortando s/l fora da faixa", () => {
    expect(hslCss({ h: 210, s: 0.5, l: 0.25 })).toBe("hsl(210.0 50.0% 25.0%)");
    expect(hslCss({ h: 0, s: 2, l: -1 })).toBe("hsl(0.0 100.0% 0.0%)");
  });
});

describe("luminanciaRelativa", () => {
  it("bate com os extremos conhecidos", () => {
    expect(luminanciaRelativa({ h: 0, s: 0, l: 0 })).toBeCloseTo(0, 5);
    expect(luminanciaRelativa({ h: 0, s: 0, l: 1 })).toBeCloseTo(1, 5);
    // Primárias sRGB puras: os próprios coeficientes da WCAG.
    expect(luminanciaRelativa({ h: 0, s: 1, l: 0.5 })).toBeCloseTo(0.2126, 4);
    expect(luminanciaRelativa({ h: 120, s: 1, l: 0.5 })).toBeCloseTo(0.7152, 4);
    expect(luminanciaRelativa({ h: 240, s: 1, l: 0.5 })).toBeCloseTo(0.0722, 4);
  });

  /**
   * O motivo de a função existir: um teto escrito no `l` do HSL não segura
   * nada, porque o mesmo `l` é sete vezes mais claro no amarelo do que no
   * azul — e é exatamente o amarelo que apaga o conteúdo sob a camada.
   */
  it("o mesmo `l` do HSL vale luminâncias muito diferentes por matiz", () => {
    const amarelo = luminanciaRelativa({ h: 60, s: 0.8, l: 0.6 });
    const azul = luminanciaRelativa({ h: 240, s: 0.8, l: 0.6 });
    expect(amarelo / azul).toBeGreaterThan(5);
  });

  it("hslParaRgb devolve canais em [0,1] e casa com o hex de volta", () => {
    const [r, g, b] = hslParaRgb({ h: 39, s: 0.6, l: 0.45 });
    for (const canal of [r, g, b]) {
      expect(canal).toBeGreaterThanOrEqual(0);
      expect(canal).toBeLessThanOrEqual(1);
    }
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });
});

describe("limitarLuminancia", () => {
  it("não toca em cor que já cabe no teto", () => {
    const escura = { h: 39, s: 0.6, l: 0.3 };
    expect(limitarLuminancia(escura, 0.45)).toEqual(escura);
  });

  it("baixa só o `l` — matiz e saturação sobrevivem, e a cor continua viva", () => {
    const amarelo = { h: 60, s: 0.85, l: 0.75 };
    const cortado = limitarLuminancia(amarelo, 0.45);
    expect(cortado.h).toBe(amarelo.h);
    expect(cortado.s).toBe(amarelo.s);
    expect(cortado.l).toBeLessThan(amarelo.l);
    expect(luminanciaRelativa(cortado)).toBeLessThanOrEqual(0.45);
    // "sem estourar" não pode virar "sem cor": o corte encosta no teto, não
    // desaba abaixo dele.
    expect(luminanciaRelativa(cortado)).toBeGreaterThan(0.44);
  });

  it("segura qualquer matiz do círculo", () => {
    for (let h = 0; h < 360; h += 15) {
      const cortado = limitarLuminancia({ h, s: 0.95, l: 0.72 }, 0.45);
      expect(luminanciaRelativa(cortado)).toBeLessThanOrEqual(0.4500001);
    }
  });
});
