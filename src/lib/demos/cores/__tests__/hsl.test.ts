import { describe, expect, it } from "vitest";

import { deslocarMatiz, ehHex, hexParaHsl, hslCss, normalizarMatiz } from "../hsl";

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
