import { describe, expect, it } from "vitest";

import { DEFAULT_SKIN } from "@/lib/demos/registry";
import type { DemoData } from "@/lib/demos/types";
import {
  conteudoTraduzivelVazio,
  extrairConteudoTraduzivel,
  montarPromptTraducaoDemo,
  schemaTraducaoDemo,
  validarTraducaoDemo,
  type ConteudoTraduzivel,
} from "../traducaoDemo";

function dados(overrides: Partial<DemoData> = {}): Pick<
  DemoData,
  "slogan" | "secoes" | "servicos" | "depoimentos"
> {
  return {
    slogan: undefined,
    secoes: {},
    servicos: [],
    depoimentos: [],
    ...overrides,
  };
}

describe("extrairConteudoTraduzivel", () => {
  it("extrai slogan e campos de seção preenchidos pelo usuário", () => {
    const conteudo = extrairConteudoTraduzivel(
      dados({
        slogan: "Tradição desde 1990",
        secoes: {
          hero: { titulo: "Barbearia do Zé", texto: "O melhor corte da cidade", rotulo: "Bem-vindo" },
          servicos: { titulo: "Nossos serviços" },
        },
      }),
      DEFAULT_SKIN,
    );

    expect(conteudo.slogan).toBe("Tradição desde 1990");
    // hero.titulo é IDENTIDADE (nome/wordmark do negócio) — nunca entra.
    expect(conteudo.secoes.hero).toEqual({ texto: "O melhor corte da cidade", rotulo: "Bem-vindo" });
    expect(conteudo.secoes.servicos).toEqual({ titulo: "Nossos serviços" });
  });

  it("seção sem NENHUM campo de texto preenchido não entra no resultado", () => {
    const conteudo = extrairConteudoTraduzivel(
      dados({ secoes: { hero: { titulo: "Nome do Negócio" } } }),
      DEFAULT_SKIN,
    );
    // Só tinha o título do hero, que é identidade — nada sobra.
    expect(conteudo.secoes).toEqual({});
  });

  it("itens preservam o ÍNDICE — item vazio vira {} no meio da lista", () => {
    const conteudo = extrairConteudoTraduzivel(
      dados({
        secoes: {
          filosofia: {
            titulo: "Filosofia",
            itens: [{ titulo: "Passo 1", texto: "Primeiro" }, { titulo: "" }, { titulo: "Passo 3" }],
          },
        },
      }),
      DEFAULT_SKIN,
    );
    expect(conteudo.secoes.filosofia.itens).toEqual([
      { titulo: "Passo 1", texto: "Primeiro" },
      {},
      { titulo: "Passo 3" },
    ]);
  });

  it("serviços: nome/descrição/precoPrefixo entram, preço numérico e livre nunca", () => {
    const conteudo = extrairConteudoTraduzivel(
      dados({
        servicos: [
          {
            nome: "Corte masculino",
            descricao: "Corte na tesoura",
            preco: "R$ 60",
            precoPrefixo: "A partir de",
            precoValor: 60,
          },
        ],
      }),
      DEFAULT_SKIN,
    );
    expect(conteudo.servicos).toEqual([
      { nome: "Corte masculino", descricao: "Corte na tesoura", precoPrefixo: "A partir de" },
    ]);
  });

  it("depoimentos: só o texto entra — o autor é dado da pessoa, não conteúdo a traduzir", () => {
    const conteudo = extrairConteudoTraduzivel(
      dados({ depoimentos: [{ autor: "João Silva", texto: "Adorei o corte!", nota: 5 }] }),
      DEFAULT_SKIN,
    );
    expect(conteudo.depoimentos).toEqual([{ texto: "Adorei o corte!" }]);
  });

  it("mantém o comprimento/índice de servicos e depoimentos mesmo sem conteúdo", () => {
    const conteudo = extrairConteudoTraduzivel(
      dados({
        servicos: [{ nome: "", preco: "" }, { nome: "Barba", preco: "" }],
        depoimentos: [{ autor: "A", texto: "" }],
      }),
      DEFAULT_SKIN,
    );
    expect(conteudo.servicos).toEqual([{}, { nome: "Barba" }]);
    expect(conteudo.depoimentos).toEqual([{}]);
  });
});

describe("conteudoTraduzivelVazio", () => {
  it("verdadeiro quando não há nenhum campo de conteúdo preenchido", () => {
    expect(
      conteudoTraduzivelVazio(extrairConteudoTraduzivel(dados(), DEFAULT_SKIN)),
    ).toBe(true);
  });

  it("falso quando há ao menos um campo com conteúdo", () => {
    expect(
      conteudoTraduzivelVazio(
        extrairConteudoTraduzivel(dados({ slogan: "Oi" }), DEFAULT_SKIN),
      ),
    ).toBe(false);
  });
});

describe("montarPromptTraducaoDemo", () => {
  it("pede a variante regional e proíbe reescrever/melhorar", () => {
    const conteudo: ConteudoTraduzivel = { slogan: "Tradição de navalha.", secoes: {}, servicos: [], depoimentos: [] };
    const prompt = montarPromptTraducaoDemo(conteudo, "es-AR");

    expect(prompt).toContain("espanhol (Argentina)");
    expect(prompt).toContain("TRADUTOR");
    expect(prompt).toContain("NUNCA reescreva");
    expect(prompt).toContain("Tradição de navalha.");
  });
});

describe("schemaTraducaoDemo", () => {
  it("só inclui as chaves que o conteúdo realmente tem", () => {
    const conteudo: ConteudoTraduzivel = {
      slogan: "Oi",
      secoes: { hero: { texto: "Bem-vindo" } },
      servicos: [],
      depoimentos: [],
    };
    const schema = schemaTraducaoDemo(conteudo) as {
      properties: Record<string, unknown>;
    };
    expect(Object.keys(schema.properties)).toEqual(["slogan", "secoes"]);
  });

  it("omite servicos/depoimentos quando todos os itens estão vazios", () => {
    const conteudo: ConteudoTraduzivel = {
      secoes: {},
      servicos: [{}, {}],
      depoimentos: [{}],
    };
    const schema = schemaTraducaoDemo(conteudo) as { properties: Record<string, unknown> };
    expect(schema.properties.servicos).toBeUndefined();
    expect(schema.properties.depoimentos).toBeUndefined();
  });
});

describe("validarTraducaoDemo", () => {
  const conteudo: ConteudoTraduzivel = {
    slogan: "Tradição de navalha.",
    secoes: {
      hero: { texto: "O melhor corte da cidade." },
      filosofia: { titulo: "Filosofia", itens: [{ titulo: "Passo 1" }, {}] },
    },
    servicos: [{ nome: "Corte masculino", precoPrefixo: "A partir de" }, {}],
    depoimentos: [{ texto: "Adorei!" }],
  };

  it("aceita resposta completa e devolve só os campos pedidos", () => {
    const { traducao, problemas } = validarTraducaoDemo(
      {
        slogan: "Razor tradition.",
        secoes: {
          hero: { texto: "The best haircut in town." },
          filosofia: { titulo: "Philosophy", itens: [{ titulo: "Step 1" }, {}] },
        },
        servicos: [{ nome: "Men's haircut", precoPrefixo: "Starting at" }, {}],
        depoimentos: [{ texto: "Loved it!" }],
      },
      conteudo,
    );

    expect(problemas).toEqual([]);
    expect(traducao).toEqual({
      slogan: "Razor tradition.",
      secoes: {
        hero: { texto: "The best haircut in town." },
        filosofia: { titulo: "Philosophy", itens: [{ titulo: "Step 1" }, {}] },
      },
      servicos: [{ nome: "Men's haircut", precoPrefixo: "Starting at" }, {}],
      depoimentos: [{ texto: "Loved it!" }],
    });
  });

  it("rejeita campo pedido que voltou vazio", () => {
    const { problemas } = validarTraducaoDemo(
      {
        slogan: "",
        secoes: {
          hero: { texto: "The best haircut in town." },
          filosofia: { titulo: "Philosophy", itens: [{ titulo: "Step 1" }, {}] },
        },
        servicos: [{ nome: "Men's haircut", precoPrefixo: "Starting at" }, {}],
        depoimentos: [{ texto: "Loved it!" }],
      },
      conteudo,
    );
    expect(problemas).toContain("slogan deve ser string não vazia");
  });

  it("resposta que não é objeto é rejeitada", () => {
    expect(validarTraducaoDemo("não é json", conteudo).problemas).toEqual([
      "resposta deve ser um objeto JSON",
    ]);
  });

  it("item de índice vazio no original nunca é cobrado, mesmo se a resposta não trouxer nada ali", () => {
    const { traducao, problemas } = validarTraducaoDemo(
      {
        slogan: "Razor tradition.",
        secoes: {
          hero: { texto: "The best haircut in town." },
          filosofia: { titulo: "Philosophy", itens: [{ titulo: "Step 1" }] },
        },
        servicos: [{ nome: "Men's haircut", precoPrefixo: "Starting at" }],
        depoimentos: [{ texto: "Loved it!" }],
      },
      conteudo,
    );
    expect(problemas).toEqual([]);
    expect(traducao?.servicos[1]).toEqual({});
    expect(traducao?.secoes.filosofia.itens?.[1]).toEqual({});
  });
});
