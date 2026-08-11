import { describe, expect, it } from "vitest";

import type { ConteudoTraduzivel } from "@/lib/ai/traducaoDemo";
import { montarDemoData } from "../montar";
import { DEFAULT_SKIN } from "../registry";
import { aplicarTraducaoDemo, traducaoTemConteudo } from "../traducaoTexto";

const BASE = montarDemoData(DEFAULT_SKIN.demoDataExemplo);

const TRADUCAO_VAZIA: ConteudoTraduzivel = { secoes: {}, servicos: [], depoimentos: [] };

describe("traducaoTemConteudo", () => {
  it("vazia (nada extraído) não tem conteúdo", () => {
    expect(traducaoTemConteudo(TRADUCAO_VAZIA)).toBe(false);
  });

  it("slogan sozinho já conta como conteúdo", () => {
    expect(traducaoTemConteudo({ ...TRADUCAO_VAZIA, slogan: "Novo slogan" })).toBe(true);
  });
});

describe("aplicarTraducaoDemo", () => {
  it("sem conteúdo: devolve os dados como vieram (mesma referência)", () => {
    expect(aplicarTraducaoDemo(TRADUCAO_VAZIA, BASE)).toBe(BASE);
  });

  it("aplica slogan e texto do hero, preservando o título (identidade)", () => {
    const traducao: ConteudoTraduzivel = {
      slogan: "Razor and scissors, always.",
      secoes: { hero: { texto: "Neighborhood barbershop with real craft." } },
      servicos: [],
      depoimentos: [],
    };
    const resultado = aplicarTraducaoDemo(traducao, BASE);
    expect(resultado.slogan).toBe("Razor and scissors, always.");
    expect(resultado.secoes.hero.texto).toBe("Neighborhood barbershop with real craft.");
    expect(resultado.secoes.hero.titulo).toBe(BASE.secoes.hero.titulo);
  });

  it("troca só os campos pedidos da seção, sem apagar os demais", () => {
    const dados = {
      ...BASE,
      secoes: { ...BASE.secoes, filosofia: { ...BASE.secoes.filosofia, rotulo: "FILOSOFIA ORIGINAL" } },
    };
    const traducao: ConteudoTraduzivel = {
      secoes: { filosofia: { titulo: "CRAFT" } },
      servicos: [],
      depoimentos: [],
    };
    const resultado = aplicarTraducaoDemo(traducao, dados);
    expect(resultado.secoes.filosofia.titulo).toBe("CRAFT");
    expect(resultado.secoes.filosofia.rotulo).toBe("FILOSOFIA ORIGINAL");
  });

  it("itens: só o índice traduzido muda, o resto do item permanece intacto", () => {
    const dados = {
      ...BASE,
      secoes: {
        ...BASE.secoes,
        filosofia: {
          ...BASE.secoes.filosofia,
          itens: [
            { titulo: "Passo 1", subtitulo: "detalhe original", texto: "explicação" },
            { titulo: "Passo 2" },
          ],
        },
      },
    };
    const traducao: ConteudoTraduzivel = {
      secoes: { filosofia: { itens: [{ titulo: "Step 1" }, { titulo: "Step 2" }] } },
      servicos: [],
      depoimentos: [],
    };
    const resultado = aplicarTraducaoDemo(traducao, dados);
    expect(resultado.secoes.filosofia.itens).toEqual([
      { titulo: "Step 1", subtitulo: "detalhe original", texto: "explicação" },
      { titulo: "Step 2" },
    ]);
  });

  it("serviços: nome/descrição/precoPrefixo trocam por índice; preço numérico/categoria preservados", () => {
    const dados = {
      ...BASE,
      servicos: [
        {
          nome: "Corte masculino",
          preco: "R$ 60",
          precoPrefixo: "A partir de",
          precoValor: 60,
          categoria: "cabelo",
          descricao: "Na tesoura",
        },
      ],
    };
    const traducao: ConteudoTraduzivel = {
      secoes: {},
      servicos: [{ nome: "Men's haircut", descricao: "With scissors", precoPrefixo: "Starting at" }],
      depoimentos: [],
    };
    const resultado = aplicarTraducaoDemo(traducao, dados);
    expect(resultado.servicos[0]).toEqual({
      nome: "Men's haircut",
      preco: "R$ 60",
      precoPrefixo: "Starting at",
      precoValor: 60,
      categoria: "cabelo",
      descricao: "With scissors",
    });
  });

  it("depoimentos: só o texto muda, autor/nota preservados", () => {
    const dados = { ...BASE, depoimentos: [{ autor: "João Silva", texto: "Ótimo!", nota: 5 }] };
    const traducao: ConteudoTraduzivel = {
      secoes: {},
      servicos: [],
      depoimentos: [{ texto: "Great!" }],
    };
    const resultado = aplicarTraducaoDemo(traducao, dados);
    expect(resultado.depoimentos[0]).toEqual({ autor: "João Silva", texto: "Great!", nota: 5 });
  });

  it("índice sem entrada na tradução mantém o item original intacto", () => {
    const dados = {
      ...BASE,
      servicos: [{ nome: "A", preco: "" }, { nome: "B", preco: "" }],
    };
    const traducao: ConteudoTraduzivel = {
      secoes: {},
      servicos: [{ nome: "A traduzido" }],
      depoimentos: [],
    };
    const resultado = aplicarTraducaoDemo(traducao, dados);
    expect(resultado.servicos[0].nome).toBe("A traduzido");
    expect(resultado.servicos[1].nome).toBe("B");
  });
});
