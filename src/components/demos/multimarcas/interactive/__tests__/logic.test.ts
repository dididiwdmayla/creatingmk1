import { describe, expect, it } from "vitest";

import {
  categoriasDoEstoque,
  formatarNumeroBR,
  parseNumeroFormatado,
  TODAS_CATEGORIAS,
  waHref,
} from "../logic";

describe("parseNumeroFormatado", () => {
  it("separa prefixo, número e sufixo de um contador com '+' e milhar", () => {
    expect(parseNumeroFormatado("+1.200")).toEqual({
      prefixo: "+",
      sufixo: "",
      alvo: 1200,
      casas: 0,
    });
  });

  it("preserva casas decimais e sufixo de símbolo (nota do Google)", () => {
    expect(parseNumeroFormatado("4,9★")).toEqual({
      prefixo: "",
      sufixo: "★",
      alvo: 4.9,
      casas: 1,
    });
  });

  it("aceita sufixo de palavra com espaço", () => {
    expect(parseNumeroFormatado("15 anos")).toEqual({
      prefixo: "",
      sufixo: " anos",
      alvo: 15,
      casas: 0,
    });
  });

  it("extrai o valor de um preço formatado (R$ + milhar)", () => {
    expect(parseNumeroFormatado("R$ 89.900")).toEqual({
      prefixo: "R$ ",
      sufixo: "",
      alvo: 89900,
      casas: 0,
    });
  });

  it("devolve null para texto sem nenhum dígito", () => {
    expect(parseNumeroFormatado("sem número")).toBeNull();
  });
});

describe("formatarNumeroBR", () => {
  it("formata inteiro com separador de milhar", () => {
    expect(formatarNumeroBR(1200, 0)).toBe("1.200");
  });

  it("formata com casas decimais fixas", () => {
    expect(formatarNumeroBR(4.9, 1)).toBe("4,9");
  });
});

describe("categoriasDoEstoque", () => {
  it("lista categorias únicas na ordem de aparição, com a sentinela 'todas' à frente", () => {
    const servicos = [
      { categoria: "Hatch" },
      { categoria: "Sedan" },
      { categoria: "Hatch" },
      { categoria: "SUV" },
    ];
    expect(categoriasDoEstoque(servicos)).toEqual([
      TODAS_CATEGORIAS,
      "Hatch",
      "Sedan",
      "SUV",
    ]);
  });

  it("ignora itens sem categoria sem quebrar", () => {
    expect(categoriasDoEstoque([{ categoria: undefined }, { categoria: "SUV" }])).toEqual([
      TODAS_CATEGORIAS,
      "SUV",
    ]);
  });
});

describe("waHref", () => {
  it("monta o link wa.me a partir de dígitos livres", () => {
    expect(waHref("(11) 98765-4321", "Olá!")).toBe(
      "https://wa.me/11987654321?text=Ol%C3%A1!",
    );
  });

  it("nunca quebra sem número (dígitos vazios)", () => {
    expect(waHref(undefined, "Olá!")).toBe("https://wa.me/?text=Ol%C3%A1!");
  });
});
