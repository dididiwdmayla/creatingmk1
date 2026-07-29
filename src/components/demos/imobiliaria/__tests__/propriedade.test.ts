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

describe("formatarPreco — fallback 'Sob consulta'", () => {
  it("preço informado passa direto", () => {
    expect(formatarPreco("R$ 2.980.000")).toBe("R$ 2.980.000");
  });

  it("preço vazio/ausente cai em 'Sob consulta'", () => {
    expect(formatarPreco("")).toBe("Sob consulta");
    expect(formatarPreco("   ")).toBe("Sob consulta");
    expect(formatarPreco(undefined)).toBe("Sob consulta");
  });
});
