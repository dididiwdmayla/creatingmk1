import { describe, expect, it } from "vitest";

import { corHex, lerCor, misturar } from "../srgb";

describe("lerCor", () => {
  it("lê hex de 3 e 6 dígitos", () => {
    expect(lerCor("#1A1411")).toEqual({ r: 0x1a, g: 0x14, b: 0x11 });
    expect(lerCor("#abc")).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc });
  });

  it("lê o que getComputedStyle devolve (rgb/rgba, vírgula ou espaço)", () => {
    expect(lerCor("rgb(26, 20, 17)")).toEqual({ r: 26, g: 20, b: 17 });
    expect(lerCor("rgb(26 20 17)")).toEqual({ r: 26, g: 20, b: 17 });
    expect(lerCor("rgba(26, 20, 17, 1)")).toEqual({ r: 26, g: 20, b: 17 });
    expect(lerCor("rgb(26 20 17 / 100%)")).toEqual({ r: 26, g: 20, b: 17 });
  });

  it("cor NÃO opaca é `undefined` — o sinal de 'esta superfície não pinta fundo'", () => {
    // `rgba(0, 0, 0, 0)` é o que todo elemento sem fundo devolve. Lê-lo
    // como preto puxaria a barra pro preto em toda seção transparente.
    expect(lerCor("rgba(0, 0, 0, 0)")).toBeUndefined();
    expect(lerCor("rgba(26, 20, 17, 0.5)")).toBeUndefined();
    expect(lerCor("transparent")).toBeUndefined();
  });

  it("sintaxe que este módulo não converte cai em `undefined`, não em palpite", () => {
    expect(lerCor("color(srgb 0.1 0.08 0.07)")).toBeUndefined();
    expect(lerCor("oklch(0.2 0.03 60)")).toBeUndefined();
    expect(lerCor(undefined)).toBeUndefined();
    expect(lerCor("")).toBeUndefined();
  });
});

describe("misturar", () => {
  it("peso único devolve a própria cor (ida e volta pelo hex, sem deriva)", () => {
    const cor = { r: 26, g: 20, b: 17 };
    expect(corHex(misturar([{ cor, peso: 1 }])!)).toBe("#1a1411");
  });

  it("normaliza os pesos — só a proporção importa", () => {
    const a = { r: 0, g: 0, b: 0 };
    const b = { r: 255, g: 255, b: 255 };
    expect(misturar([{ cor: a, peso: 1 }, { cor: b, peso: 1 }])).toEqual(
      misturar([{ cor: a, peso: 20 }, { cor: b, peso: 20 }]),
    );
  });

  it("mistura em LUZ LINEAR: o meio do caminho não afunda como a média de bytes", () => {
    // Este é o motivo do módulo existir em vez de um lerp de bytes. A
    // média byte a byte entre preto e branco dá 128 (#808080); a cor a
    // meio caminho em LUZ é bem mais clara (~188), e é ela que a barra
    // precisa mostrar pra transição não escurecer no meio.
    const meio = misturar([
      { cor: { r: 0, g: 0, b: 0 }, peso: 1 },
      { cor: { r: 255, g: 255, b: 255 }, peso: 1 },
    ])!;
    expect(Math.round(meio.r)).toBe(188);
    expect(Math.round(meio.r)).toBeGreaterThan(128);
  });

  it("é monótona: peso crescente de uma ponta caminha sem voltar", () => {
    const escuro = { r: 26, g: 20, b: 17 };
    const claro = { r: 245, g: 240, b: 232 };
    let anterior = -1;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const cor = misturar([{ cor: escuro, peso: 1 - p }, { cor: claro, peso: p }])!;
      expect(cor.r).toBeGreaterThan(anterior);
      anterior = cor.r;
    }
  });

  it("lista vazia (ou de peso zero) é `undefined`, não preto", () => {
    expect(misturar([])).toBeUndefined();
    expect(misturar([{ cor: { r: 1, g: 2, b: 3 }, peso: 0 }])).toBeUndefined();
  });
});

describe("corHex", () => {
  it("recorta e arredonda para bytes válidos", () => {
    expect(corHex({ r: -3, g: 300, b: 127.6 })).toBe("#00ff80");
  });
});
