import { describe, expect, it } from "vitest";

import { formatarPreco, parseImovel } from "../propriedade";

describe("parseImovel — convenção 'Selo • especificações' de descricao", () => {
  it("separa selo e especificações no bullet", () => {
    expect(parseImovel("Casa • 4 suítes · 420 m² · piscina de borda verde")).toEqual({
      selo: "Casa",
      especificacoes: "4 suítes · 420 m² · piscina de borda verde",
    });
  });

  it("sem bullet, tudo vira especificação e não há selo", () => {
    expect(parseImovel("4 suítes · 420 m²")).toEqual({
      selo: undefined,
      especificacoes: "4 suítes · 420 m²",
    });
  });

  it("descricao ausente/vazia não quebra", () => {
    expect(parseImovel(undefined)).toEqual({ selo: undefined, especificacoes: undefined });
    expect(parseImovel("   ")).toEqual({ selo: undefined, especificacoes: undefined });
  });

  it("bullet sem selo antes (string começa com •) não gera selo vazio", () => {
    expect(parseImovel("• só especificação")).toEqual({
      selo: undefined,
      especificacoes: "só especificação",
    });
  });
});

describe("formatarPreco — precoValor/precoPrefixo formatados, fallback semPreco", () => {
  it("precoValor formatado pelo locale/moeda da demo", () => {
    expect(formatarPreco({ preco: "", precoValor: 2980000 }, "pt-BR", "BRL", "Sob consulta")).toBe(
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(2980000),
    );
  });

  it("precoPrefixo some antes do valor formatado", () => {
    expect(
      formatarPreco({ preco: "", precoPrefixo: "A partir de", precoValor: 999 }, "de-CH", "CHF", "Sob consulta"),
    ).toBe(
      `A partir de ${new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(999)}`,
    );
  });

  it("nem prefixo nem valor: cai no preco legado", () => {
    expect(formatarPreco({ preco: "R$ 2.980.000" }, "pt-BR", "BRL", "Sob consulta")).toBe(
      "R$ 2.980.000",
    );
  });

  it("preco vazio/ausente cai no semPreco recebido", () => {
    expect(formatarPreco({ preco: "" }, "pt-BR", "BRL", "Sob consulta")).toBe("Sob consulta");
    expect(formatarPreco({ preco: "   " }, "pt-BR", "BRL", "Sob consulta")).toBe("Sob consulta");
    expect(formatarPreco({ preco: "" }, "en-US", "USD", "Price on request")).toBe(
      "Price on request",
    );
  });
});
