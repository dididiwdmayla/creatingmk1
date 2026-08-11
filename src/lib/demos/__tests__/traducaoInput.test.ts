import { describe, expect, it } from "vitest";

import { coagirConteudoParaTraducao } from "../traducaoInput";

describe("coagirConteudoParaTraducao", () => {
  it("entrada não-objeto vira estrutura vazia, sem lançar", () => {
    expect(coagirConteudoParaTraducao(null)).toEqual({ secoes: {}, servicos: [], depoimentos: [] });
    expect(coagirConteudoParaTraducao("texto")).toEqual({ secoes: {}, servicos: [], depoimentos: [] });
    expect(coagirConteudoParaTraducao(undefined)).toEqual({ secoes: {}, servicos: [], depoimentos: [] });
  });

  it("coage um DemoData efetivo típico", () => {
    const resultado = coagirConteudoParaTraducao({
      slogan: "Tradição desde 1990",
      secoes: {
        hero: { titulo: "Barbearia do Zé", texto: "O melhor corte", itens: [{ titulo: "Item 1" }] },
      },
      servicos: [{ nome: "Corte", preco: "R$ 60", precoPrefixo: "A partir de", precoValor: 60 }],
      depoimentos: [{ autor: "João", texto: "Ótimo!", nota: 5 }],
      // Campos fora do escopo da tradução (identidade/imagens/tema) — ignorados, sem erro.
      nome: "Barbearia do Zé",
      endereco: "Rua X, 123",
      imagens: { hero: "https://exemplo/foto.jpg" },
    });

    expect(resultado.slogan).toBe("Tradição desde 1990");
    expect(resultado.secoes.hero).toEqual({
      titulo: "Barbearia do Zé",
      texto: "O melhor corte",
      itens: [{ titulo: "Item 1" }],
    });
    expect(resultado.servicos).toEqual([
      { nome: "Corte", preco: "R$ 60", precoPrefixo: "A partir de" },
    ]);
    expect(resultado.depoimentos).toEqual([{ autor: "João", texto: "Ótimo!" }]);
  });

  it("campo com tipo errado vira ausente, não lança nem quebra o resto", () => {
    const resultado = coagirConteudoParaTraducao({
      slogan: 123,
      secoes: { hero: { titulo: ["não é string"] } },
      servicos: "não é lista",
      depoimentos: null,
    });
    expect(resultado.slogan).toBeUndefined();
    expect(resultado.secoes.hero).toEqual({});
    expect(resultado.servicos).toEqual([]);
    expect(resultado.depoimentos).toEqual([]);
  });

  it("item de dentro de uma lista que não é objeto vira entrada vazia", () => {
    const resultado = coagirConteudoParaTraducao({
      servicos: ["string solta", 42, null],
      depoimentos: [{}],
    });
    expect(resultado.servicos).toEqual([
      { nome: "", preco: "" },
      { nome: "", preco: "" },
      { nome: "", preco: "" },
    ]);
    expect(resultado.depoimentos).toEqual([{ autor: "", texto: "" }]);
  });

  it("limita o tamanho de listas e de strings, sem quebrar", () => {
    const servicosGrandes = Array.from({ length: 50 }, (_, i) => ({ nome: `S${i}` }));
    const resultado = coagirConteudoParaTraducao({
      slogan: "x".repeat(5000),
      servicos: servicosGrandes,
    });
    expect(resultado.slogan?.length).toBe(2000);
    expect(resultado.servicos.length).toBe(30);
  });
});
