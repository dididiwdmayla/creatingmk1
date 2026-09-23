import { describe, expect, it } from "vitest";

import { microcopiaDemo } from "@/lib/demos/microcopy";

import {
  categoriasDoEstoque,
  faixaDoHash,
  faixasDePreco,
  faixaDoSimulador,
  formatarNumeroBR,
  linhaDeApoio,
  linhasDoNome,
  parcelaMensal,
  parseNumeroFormatado,
  rotuloFaixa,
  TODAS_CATEGORIAS,
  valorNaFaixa,
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

  // Antes desta correção, sem número saía `https://wa.me/?text=…` — um
  // link que abre o WhatsApp em branco. O laço visual da demo AVULSA
  // (`qa-visual.mjs --so=avulsa`) mostrou o resultado: a skin publicava
  // "Chamar no WhatsApp" e um botão flutuante fixo levando a lugar
  // nenhum. Sem número não há link, e quem chama esconde o CTA.
  it("não devolve link sem número — o CTA some em vez de virar link morto", () => {
    expect(waHref(undefined, "Olá!")).toBeUndefined();
    expect(waHref("", "Olá!")).toBeUndefined();
    expect(waHref("   ", "Olá!")).toBeUndefined();
    expect(waHref("sem dígitos aqui", "Olá!")).toBeUndefined();
  });
});

describe("linhaDeApoio (§6.1 do plano)", () => {
  it("título digitado pelo operador vira a linha de apoio, sem espaços extras", () => {
    expect(linhaDeApoio("  Seminovos com garantia\nde fábrica ", "Auto Center Silva")).toBe(
      "Seminovos com garantia de fábrica",
    );
  });

  it("vazio ou só espaço: não há linha (o `??` antigo desenhava vazio)", () => {
    expect(linhaDeApoio(undefined, "Auto Center Silva")).toBeUndefined();
    expect(linhaDeApoio("", "Auto Center Silva")).toBeUndefined();
    expect(linhaDeApoio("   \n ", "Auto Center Silva")).toBeUndefined();
  });

  it("igual ao nome (sem caixa, com a quebra de quebrarTitulo): não há linha", () => {
    expect(linhaDeApoio("AUTO CENTER\nsilva", "Auto Center Silva")).toBeUndefined();
    expect(linhaDeApoio(" auto center silva ", "Auto Center Silva")).toBeUndefined();
  });
});

describe("linhasDoNome", () => {
  it("parte o nome ao meio por palavras, a primeira linha com a sobra", () => {
    expect(linhasDoNome("Auto Center Silva")).toEqual([["Auto", "Center"], ["Silva"]]);
    expect(linhasDoNome("Vórtice")).toEqual([["Vórtice"], []]);
    expect(linhasDoNome(" Garagem\n77 ")).toEqual([["Garagem"], ["77"]]);
  });
});

describe("faixasDePreco (busca por faixa — §5 do plano)", () => {
  const estoque = [39900, 49900, 59900, 69900, 79900, 89900, 99900, 119900, 149900].map((precoValor) => ({
    precoValor,
  }));

  it("quatro faixas a partir de oito carros, cortes arredondados, nenhuma vazia", () => {
    expect(faixasDePreco(estoque)).toEqual([
      { id: "faixa-1", max: 60000 },
      { id: "faixa-2", min: 60000, max: 80000 },
      { id: "faixa-3", min: 80000, max: 100000 },
      { id: "faixa-4", min: 100000 },
    ]);
  });

  it("cada carro cai em exatamente uma faixa", () => {
    const faixas = faixasDePreco(estoque);
    for (const { precoValor } of estoque) {
      expect(faixas.filter((f) => valorNaFaixa(precoValor, f))).toHaveLength(1);
    }
  });

  it("três faixas abaixo de oito carros; derivadas do estoque, não de tabela fixa", () => {
    const faixas = faixasDePreco([{ precoValor: 380000 }, { precoValor: 520000 }, { precoValor: 690000 }, { precoValor: 900000 }]);
    expect(faixas.length).toBeGreaterThanOrEqual(2);
    expect(faixas.length).toBeLessThanOrEqual(3);
    expect(faixas[0].max).toBeGreaterThan(380000);
  });

  it("menos de três preços distintos (ou sem precoValor): sem busca", () => {
    expect(faixasDePreco([{ precoValor: 50000 }, { precoValor: 50000 }, { precoValor: 90000 }])).toEqual([]);
    expect(faixasDePreco([{}, {}, {}])).toEqual([]);
  });

  it("rótulo pelo locale/moeda da demo, sem centavos", () => {
    const [ate, meio, , acima] = faixasDePreco(estoque);
    const pt = microcopiaDemo("pt-BR");
    const en = microcopiaDemo("en-US");
    expect(rotuloFaixa(ate, pt, "pt-BR", "BRL").replace(/\s/g, " ")).toBe("Até R$ 60.000");
    expect(rotuloFaixa(meio, pt, "pt-BR", "BRL").replace(/\s/g, " ")).toBe("R$ 60.000 a R$ 80.000");
    expect(rotuloFaixa(acima, en, "en-US", "USD")).toBe("Over $100,000");
  });

  it("o hash só escolhe faixa que existe", () => {
    const faixas = faixasDePreco(estoque);
    expect(faixaDoHash("#faixa-2", faixas)).toBe("faixa-2");
    expect(faixaDoHash("#faixa-9", faixas)).toBeUndefined();
    expect(faixaDoHash("#estoque", faixas)).toBeUndefined();
  });
});

describe("faixaDoSimulador (o simulador alcança o estoque — §5)", () => {
  const estoque = [39900, 49900, 59900, 69900, 79900, 89900, 99900, 119900, 149900].map((precoValor) => ({
    precoValor,
  }));

  it("cerca o carro mais barato e o mais caro; parte da mediana", () => {
    expect(faixaDoSimulador(estoque)).toEqual({ min: 38000, max: 150000, passo: 2000, inicial: 80000 });
  });

  it("todo carro do estoque é simulável (dentro da faixa)", () => {
    for (const lista of [estoque, [{ precoValor: 19 }, { precoValor: 26 }], [{ precoValor: 389000 }, { precoValor: 1250000 }]]) {
      const f = faixaDoSimulador(lista);
      for (const { precoValor } of lista) {
        expect(precoValor).toBeGreaterThanOrEqual(f.min);
        expect(precoValor).toBeLessThanOrEqual(f.max);
      }
      expect(f.inicial).toBeGreaterThanOrEqual(f.min);
      expect(f.inicial).toBeLessThanOrEqual(f.max);
    }
  });

  it("estoque sem preço: a faixa histórica", () => {
    expect(faixaDoSimulador([{}, {}])).toEqual({ min: 60000, max: 400000, passo: 5000, inicial: 120000 });
  });
});

describe("parcelaMensal", () => {
  it("tabela Price; zero financiado é zero; taxa zero divide igual", () => {
    expect(Math.round(parcelaMensal(96000, 1.49, 48))).toBe(2814);
    expect(parcelaMensal(0, 1.49, 48)).toBe(0);
    expect(parcelaMensal(4800, 0, 48)).toBe(100);
  });
});
