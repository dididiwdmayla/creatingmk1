import { describe, expect, it } from "vitest";

import { DEFAULT_SKIN, getSkin, SKINS } from "@/lib/demos/registry";
import type { DemoData } from "@/lib/demos/types";
import type { Lead } from "@/lib/leads/types";
import { montarPromptSugestao, schemaSugestao, validarSugestao } from "../sugestao";

/** Campos de IDENTIDADE do lead — a IA nunca pode recebê-los como slot editável. */
const CAMPOS_IDENTIDADE_LEAD = [
  "nome",
  "endereco",
  "cidade",
  "telefone",
  "whatsapp",
  "horarios",
  "instagram",
] as const;

const LEAD: Lead = {
  placeId: "ChIJ001",
  nome: "Barbearia do Zé",
  endereco: "Av. Brasil, 123 - Sarandi, PR",
  status: "novo",
  busca: { nicho: "barbearia", subNicho: "navalha", regiao: "Sarandi PR", em: "2026-07-01" },
  enriquecido: true,
  detalhes: {
    rating: 4.8,
    totalAvaliacoes: 210,
    enriquecidoEm: "2026-07-01T00:00:00.000Z",
  },
  criadoEm: "2026-07-01T00:00:00.000Z",
  atualizadoEm: "2026-07-01T00:00:00.000Z",
};

/** servicos/depoimentos válidos (quantidade == exemplo da skin default). */
function servicosValidos(): Array<{ nome: string; descricao: string }> {
  return DEFAULT_SKIN.demoDataExemplo.servicos.map((_, i) => ({
    nome: `Serviço traduzido ${i + 1}`,
    descricao: `Descrição traduzida ${i + 1}.`,
  }));
}

function depoimentosValidos(): Array<{ autor: string; texto: string }> {
  return DEFAULT_SKIN.demoDataExemplo.depoimentos.map((_, i) => ({
    autor: `Autor ${i + 1}`,
    texto: `Depoimento traduzido ${i + 1}.`,
  }));
}

/** Resposta válida mínima contra a skin default (barbearia). */
function sugestaoValida(): Record<string, unknown> {
  return {
    themeId: "meia-noite",
    destaque: "#8C4A2B",
    fonteDisplay: "playfair",
    animacao: "sutil",
    slogan: "Tradição de navalha desde sempre.",
    descricao: "Cortes clássicos e barba feita com calma, no coração de Sarandi.",
    heroCta: "Agendar horário",
    heroCtaSecundaria: "Ver serviços",
    titulosSecoes: { filosofia: "Nossa filosofia", servicos: "Serviços e preços" },
    idioma: "pt-BR",
  };
}

describe("montarPromptSugestao", () => {
  it("inclui nicho, nome, rating e as escolhas permitidas", () => {
    const prompt = montarPromptSugestao(DEFAULT_SKIN, LEAD);

    expect(prompt).toContain("Barbearia do Zé");
    expect(prompt).toContain("Nicho: barbearia");
    expect(prompt).toContain("Especialidade: navalha");
    expect(prompt).toContain("4.8 (210 avaliações)");
    expect(prompt).toContain('"meia-noite"');
    expect(prompt).toContain('"playfair"');
    expect(prompt).toContain("português do Brasil");
  });

  it("sem enriquecimento, não inventa linha de avaliação", () => {
    const prompt = montarPromptSugestao(DEFAULT_SKIN, { ...LEAD, detalhes: undefined });
    expect(prompt).not.toContain("Avaliação no Google");
  });

  it("idioma não-pt-BR instrui o Gemini a escrever nesse idioma (item 'Idioma da IA na demo')", () => {
    const prompt = montarPromptSugestao(DEFAULT_SKIN, LEAD, "equilibrado", "en-US");

    expect(prompt).toContain("inglês");
    expect(prompt).toContain('"idioma" do JSON com exatamente "en-US"');
    expect(prompt).not.toContain("português do Brasil");
  });
});

describe("schemaSugestao", () => {
  it("restringe enums ao contrato da skin e exclui seções fixas", () => {
    const schema = schemaSugestao(DEFAULT_SKIN) as {
      properties: {
        themeId: { enum: string[] };
        titulosSecoes: { properties: Record<string, unknown> };
      };
      required: string[];
    };

    expect(schema.properties.themeId.enum).toContain("meia-noite");
    expect(schema.required).toContain("titulosSecoes");
    // hero é fixa: o título dela é identidade do negócio, não slot de IA.
    expect(Object.keys(schema.properties.titulosSecoes.properties)).not.toContain("hero");
    expect(Object.keys(schema.properties.titulosSecoes.properties)).toContain("filosofia");
  });

  it("fixa o idioma-alvo como único valor permitido (default pt-BR)", () => {
    const padrao = schemaSugestao(DEFAULT_SKIN) as { properties: { idioma: { enum: string[] } } };
    expect(padrao.properties.idioma.enum).toEqual(["pt-BR"]);

    const ingles = schemaSugestao(DEFAULT_SKIN, "equilibrado", "en-US") as {
      properties: { idioma: { enum: string[] } };
    };
    expect(ingles.properties.idioma.enum).toEqual(["en-US"]);
  });
});

describe("validarSugestao", () => {
  it("aceita resposta dentro do contrato (hex normalizado, textos trim)", () => {
    const bruto = sugestaoValida();
    bruto.slogan = "  Tradição de navalha.  ";

    const resultado = validarSugestao(bruto, DEFAULT_SKIN);

    expect(resultado.problemas).toEqual([]);
    expect(resultado.sugestao).toMatchObject({
      themeId: "meia-noite",
      destaque: "#8c4a2b",
      fonteDisplay: "playfair",
      animacao: "sutil",
      slogan: "Tradição de navalha.",
    });
  });

  it("recorta textos longos em vez de rejeitar", () => {
    const bruto = sugestaoValida();
    bruto.slogan = "x".repeat(500);

    const resultado = validarSugestao(bruto, DEFAULT_SKIN);

    expect(resultado.problemas).toEqual([]);
    expect(resultado.sugestao?.slogan).toHaveLength(120);
  });

  it("rejeita chave desconhecida, enum inválido e hex quebrado", () => {
    const bruto = {
      ...sugestaoValida(),
      themeId: "inexistente",
      destaque: "vermelho",
      animacao: "explosiva",
      extra: 1,
    };

    const { sugestao, problemas } = validarSugestao(bruto, DEFAULT_SKIN);

    expect(sugestao).toBeUndefined();
    expect(problemas).toEqual([
      "chave desconhecida: extra",
      "themeId deve ser um preset da skin: norte, meia-noite, creme, oliva",
      "destaque deve ser cor hex no formato #rrggbb",
      "animacao deve ser um de: nenhuma, sutil, marcante",
    ]);
  });

  it("rejeita título para seção fixa ou fora do contrato da skin", () => {
    const bruto = sugestaoValida();
    bruto.titulosSecoes = { hero: "Novo hero", inventada: "X", filosofia: "Ok" };

    const { sugestao, problemas } = validarSugestao(bruto, DEFAULT_SKIN);

    expect(sugestao).toBeUndefined();
    expect(problemas.some((p) => p.startsWith("titulosSecoes.hero"))).toBe(true);
    expect(problemas.some((p) => p.startsWith("titulosSecoes.inventada"))).toBe(true);
  });

  it("rejeita fonte fora da lista curada de display", () => {
    const bruto = { ...sugestaoValida(), fonteDisplay: "comic-sans" };

    const { sugestao, problemas } = validarSugestao(bruto, DEFAULT_SKIN);

    expect(sugestao).toBeUndefined();
    expect(problemas.some((p) => p.startsWith("fonteDisplay"))).toBe(true);
  });

  it("rejeita resposta que não é objeto", () => {
    expect(validarSugestao("texto solto", DEFAULT_SKIN).problemas).toEqual([
      "resposta deve ser um objeto JSON",
    ]);
  });

  it("idioma divergente do esperado é rejeitado (não aceita pt-BR quando o alvo é outro)", () => {
    const bruto = sugestaoValida();

    const semAjuste = validarSugestao(bruto, DEFAULT_SKIN, "equilibrado", "en-US");
    expect(semAjuste.sugestao).toBeUndefined();
    expect(semAjuste.problemas).toContain('idioma deve ser exatamente "en-US"');

    const ajustado = validarSugestao(
      { ...bruto, idioma: "en-US" },
      DEFAULT_SKIN,
      "equilibrado",
      "en-US",
    );
    expect(ajustado.problemas).toEqual([]);
  });
});

describe("nível de intervenção (toque-leve/equilibrado/completo)", () => {
  it("toque-leve: schema só pede tema, sem nenhum campo de texto", () => {
    const schema = schemaSugestao(DEFAULT_SKIN, "toque-leve") as {
      required: string[];
      properties: Record<string, unknown>;
    };

    expect(schema.required).toEqual(["themeId", "destaque", "fonteDisplay", "animacao"]);
    expect(schema.properties.slogan).toBeUndefined();
    expect(schema.properties.descricao).toBeUndefined();
    expect(schema.properties.titulosSecoes).toBeUndefined();
    expect(schema.properties.textosSecoes).toBeUndefined();
    expect(schema.properties.idioma).toBeUndefined();
  });

  it("toque-leve: aceita resposta só com tema (sem slogan/descricao/idioma)", () => {
    const bruto = {
      themeId: "meia-noite",
      destaque: "#8C4A2B",
      fonteDisplay: "playfair",
      animacao: "sutil",
    };

    const resultado = validarSugestao(bruto, DEFAULT_SKIN, "toque-leve");

    expect(resultado.problemas).toEqual([]);
    expect(resultado.sugestao).toEqual({
      themeId: "meia-noite",
      destaque: "#8c4a2b",
      fonteDisplay: "playfair",
      animacao: "sutil",
    });
  });

  it("toque-leve: rejeita slogan/titulosSecoes como chave desconhecida (nível não pediu texto)", () => {
    const bruto = { ...sugestaoValida() };

    const { sugestao, problemas } = validarSugestao(bruto, DEFAULT_SKIN, "toque-leve");

    expect(sugestao).toBeUndefined();
    expect(problemas).toContain("chave desconhecida: slogan");
    expect(problemas).toContain("chave desconhecida: descricao");
    expect(problemas).toContain("chave desconhecida: titulosSecoes");
    expect(problemas).toContain("chave desconhecida: idioma");
  });

  it("completo: schema pede textosSecoes (não titulosSecoes) para as seções não-fixas", () => {
    const schema = schemaSugestao(DEFAULT_SKIN, "completo") as {
      required: string[];
      properties: {
        textosSecoes: { properties: Record<string, unknown> };
        titulosSecoes?: unknown;
      };
    };

    expect(schema.required).toContain("textosSecoes");
    expect(schema.properties.titulosSecoes).toBeUndefined();
    expect(Object.keys(schema.properties.textosSecoes.properties)).not.toContain("hero");
    expect(Object.keys(schema.properties.textosSecoes.properties)).toContain("filosofia");
  });

  it("completo: aceita textosSecoes com rótulo/título/texto/CTAs por seção", () => {
    const itensFilosofia = [
      { titulo: "CRAFT", subtitulo: "01", texto: "Cada corte é decidido junto ao cliente." },
      { titulo: "RITUAL", subtitulo: "02", texto: "Toalha quente, conversa baixa, café preto." },
      { titulo: "TEMPO", subtitulo: "03", texto: "Sob agendamento. Sem fila, sem pressa." },
    ];
    const bruto = {
      themeId: "meia-noite",
      destaque: "#8C4A2B",
      fonteDisplay: "playfair",
      animacao: "sutil",
      slogan: "Tradição de navalha desde sempre.",
      descricao: "Cortes clássicos no coração de Sarandi.",
      heroCta: "Agendar horário",
      heroCtaSecundaria: "Ver serviços",
      idioma: "pt-BR",
      textosSecoes: {
        filosofia: {
          rotulo: "FILOSOFIA",
          titulo: "Nossa filosofia",
          texto: "O que nos guia.",
          itens: itensFilosofia,
        },
        servicos: { cta: "AGENDAR AGORA" },
      },
      servicos: servicosValidos(),
      depoimentos: depoimentosValidos(),
    };

    const resultado = validarSugestao(bruto, DEFAULT_SKIN, "completo");

    expect(resultado.problemas).toEqual([]);
    expect(resultado.sugestao?.textosSecoes).toEqual({
      filosofia: {
        rotulo: "FILOSOFIA",
        titulo: "Nossa filosofia",
        texto: "O que nos guia.",
        itens: itensFilosofia,
      },
      servicos: { cta: "AGENDAR AGORA" },
    });
    expect(resultado.sugestao?.heroCta).toBe("Agendar horário");
    expect(resultado.sugestao?.heroCtaSecundaria).toBe("Ver serviços");
    expect(resultado.sugestao?.titulosSecoes).toBeUndefined();
    expect(resultado.sugestao?.servicos).toEqual(servicosValidos());
    expect(resultado.sugestao?.depoimentos).toEqual(depoimentosValidos());
  });

  it("completo: rejeita textosSecoes de seção fixa ou fora do contrato", () => {
    const bruto: Record<string, unknown> = {
      ...sugestaoValida(),
      textosSecoes: { hero: { titulo: "Novo hero" }, inventada: { titulo: "X" } },
    };
    delete bruto.titulosSecoes;

    const { sugestao, problemas } = validarSugestao(bruto, DEFAULT_SKIN, "completo");

    expect(sugestao).toBeUndefined();
    expect(problemas.some((p) => p.startsWith("textosSecoes.hero"))).toBe(true);
    expect(problemas.some((p) => p.startsWith("textosSecoes.inventada"))).toBe(true);
  });

  it("completo: rejeita seção sem nenhum campo de texto não vazio", () => {
    const bruto: Record<string, unknown> = {
      ...sugestaoValida(),
      textosSecoes: { filosofia: {} },
    };
    delete bruto.titulosSecoes;

    const { sugestao, problemas } = validarSugestao(bruto, DEFAULT_SKIN, "completo");

    expect(sugestao).toBeUndefined();
    expect(problemas).toContain("textosSecoes.filosofia deve ter ao menos um campo de texto não vazio");
  });

  it("completo: rejeita servicos/depoimentos com quantidade diferente da skin (nunca inventa nem remove item)", () => {
    const bruto: Record<string, unknown> = {
      ...sugestaoValida(),
      textosSecoes: {},
      servicos: servicosValidos().slice(1),
      depoimentos: depoimentosValidos(),
    };
    delete bruto.titulosSecoes;

    const { sugestao, problemas } = validarSugestao(bruto, DEFAULT_SKIN, "completo");

    expect(sugestao).toBeUndefined();
    expect(problemas).toContain(
      `servicos deve ser uma lista com ${DEFAULT_SKIN.demoDataExemplo.servicos.length} item(ns)`,
    );
  });

  it("completo: rejeita item de servicos/depoimentos sem os campos exigidos", () => {
    const bruto: Record<string, unknown> = {
      ...sugestaoValida(),
      textosSecoes: {},
      servicos: servicosValidos().map((s, i) => (i === 0 ? { ...s, nome: "" } : s)),
      depoimentos: depoimentosValidos().map((d, i) => (i === 0 ? { ...d, texto: "" } : d)),
    };
    delete bruto.titulosSecoes;

    const { sugestao, problemas } = validarSugestao(bruto, DEFAULT_SKIN, "completo");

    expect(sugestao).toBeUndefined();
    expect(problemas).toContain("servicos[0].nome deve ser string não vazia");
    expect(problemas).toContain("depoimentos[0].texto deve ser string não vazia");
  });

  it("completo: preço nunca faz parte do schema/validação de servicos (é dado do lead)", () => {
    const schema = schemaSugestao(DEFAULT_SKIN, "completo") as {
      properties: { servicos: { items: { properties: Record<string, unknown> } } };
    };
    expect(Object.keys(schema.properties.servicos.items.properties)).toEqual([
      "nome",
      "descricao",
    ]);
  });
});

describe("schemaSugestao — completude dinâmica por skin (todas as skins do registro)", () => {
  it.each(SKINS.map((skin) => [skin.id, skin] as const))(
    "%s: todo slot de CONTEÚDO da skin ativa está no schema montado (nível completo)",
    (_id, skin) => {
      const schema = schemaSugestao(skin, "completo") as {
        properties: {
          textosSecoes: {
            properties: Record<
              string,
              { properties: { itens?: { minItems: number; maxItems: number } } }
            >;
          };
          heroItens?: { minItems: number; maxItems: number };
          servicos?: { minItems: number; maxItems: number };
          depoimentos?: { minItems: number; maxItems: number };
        };
      };

      // Toda seção NÃO-fixa (rótulo/título/texto/CTA/CTA secundária) — o
      // schema é montado a partir DESTA skin, não de uma união hardcoded.
      const idsNaoFixas = skin.secoes.filter((secao) => !secao.fixa).map((secao) => secao.id);
      for (const id of idsNaoFixas) {
        expect(Object.keys(schema.properties.textosSecoes.properties)).toContain(id);

        // itens[] da seção: array de tamanho FIXO igual ao exemplo (ou
        // ausente quando a seção não tem itens de exemplo).
        const itensExemplo = skin.demoDataExemplo.secoes[id]?.itens;
        const itensSchema = schema.properties.textosSecoes.properties[id].properties.itens;
        if (itensExemplo && itensExemplo.length > 0) {
          expect(itensSchema).toMatchObject({
            minItems: itensExemplo.length,
            maxItems: itensExemplo.length,
          });
        } else {
          expect(itensSchema).toBeUndefined();
        }
      }

      // hero.itens (ex.: chips de avaliação no hero da skin de petshop).
      const heroItensExemplo = skin.demoDataExemplo.secoes.hero?.itens;
      if (heroItensExemplo && heroItensExemplo.length > 0) {
        expect(schema.properties.heroItens).toMatchObject({
          minItems: heroItensExemplo.length,
          maxItems: heroItensExemplo.length,
        });
      } else {
        expect(schema.properties.heroItens).toBeUndefined();
      }

      // Serviços: array de tamanho FIXO igual à quantidade de exemplo desta skin.
      if (skin.demoDataExemplo.servicos.length > 0) {
        expect(schema.properties.servicos?.minItems).toBe(skin.demoDataExemplo.servicos.length);
        expect(schema.properties.servicos?.maxItems).toBe(skin.demoDataExemplo.servicos.length);
      } else {
        expect(schema.properties.servicos).toBeUndefined();
      }

      // Depoimentos: algumas skins (lancheria, barbearia2) não têm nenhum de
      // exemplo — aí a propriedade nem entra no schema (nada pra gerar).
      if (skin.demoDataExemplo.depoimentos.length > 0) {
        expect(schema.properties.depoimentos?.minItems).toBe(
          skin.demoDataExemplo.depoimentos.length,
        );
        expect(schema.properties.depoimentos?.maxItems).toBe(
          skin.demoDataExemplo.depoimentos.length,
        );
      } else {
        expect(schema.properties.depoimentos).toBeUndefined();
      }
    },
  );
});

describe("schemaSugestao — nenhum campo de IDENTIDADE do lead entra no schema", () => {
  it.each(SKINS.map((skin) => [skin.id, skin] as const))(
    "%s: nome/endereço/cidade/telefone/whatsapp/horários/instagram nunca são propriedade do schema (nenhum nível)",
    (_id, skin) => {
      for (const nivel of ["toque-leve", "equilibrado", "completo"] as const) {
        const schema = schemaSugestao(skin, nivel) as { properties: Record<string, unknown> };
        const chavesTopo = Object.keys(schema.properties);
        for (const campo of CAMPOS_IDENTIDADE_LEAD) {
          expect(chavesTopo).not.toContain(campo);
        }
      }
    },
  );

  it.each(SKINS.map((skin) => [skin.id, skin] as const))(
    "%s: o título do hero (seção fixa) nunca é slot da IA, em nenhum nível",
    (_id, skin) => {
      for (const nivel of ["equilibrado", "completo"] as const) {
        const schema = schemaSugestao(skin, nivel) as {
          properties: {
            titulosSecoes?: { properties: Record<string, unknown> };
            textosSecoes?: { properties: Record<string, unknown> };
          };
        };
        const chavesSecoes = Object.keys(
          schema.properties.titulosSecoes?.properties ??
            schema.properties.textosSecoes?.properties ??
            {},
        );
        expect(chavesSecoes).not.toContain("hero");
      }
    },
  );
});

describe("schema dinâmico — secoes.*.itens[] e exceções do hero (secoes.hero.rotulo/cta)", () => {
  const TATUAGEM2 = getSkin("tatuagem-pigmento-vivo")!;

  it("hero.rotulo e hero.cta entram no schema (nível equilibrado e completo) — a fixa não some inteira", () => {
    for (const nivel of ["equilibrado", "completo"] as const) {
      const schema = schemaSugestao(TATUAGEM2, nivel) as {
        required: string[];
        properties: { heroRotulo?: { maxLength: number }; heroCta?: { maxLength: number } };
      };
      expect(schema.properties.heroRotulo).toBeDefined();
      expect(schema.properties.heroCta).toBeDefined();
      expect(schema.required).toContain("heroRotulo");
      expect(schema.required).toContain("heroCta");
    }
  });

  it("hero.rotulo/cta ausentes na skin (toque-leve, ou skin sem esses campos) não entram no schema", () => {
    const toqueLeve = schemaSugestao(TATUAGEM2, "toque-leve") as {
      properties: Record<string, unknown>;
    };
    expect(toqueLeve.properties.heroRotulo).toBeUndefined();
    expect(toqueLeve.properties.heroCta).toBeUndefined();

    // tatuagem-editorial: hero sem rotulo (só texto/cta) — heroRotulo fica de fora.
    const tatuagem1 = schemaSugestao(getSkin("tatuagem-editorial")!, "completo") as {
      properties: Record<string, unknown>;
    };
    expect(tatuagem1.properties.heroRotulo).toBeUndefined();
    expect(tatuagem1.properties.heroCta).toBeDefined();
  });

  it("secoes.*.itens[]: schema de array de tamanho FIXO igual ao exemplo, por seção", () => {
    const schema = schemaSugestao(TATUAGEM2, "completo") as {
      properties: {
        textosSecoes: {
          properties: Record<string, { properties: { itens?: { minItems: number; maxItems: number } } }>;
        };
      };
    };
    const estilos = TATUAGEM2.demoDataExemplo.secoes.estilos.itens!;
    const portfolio = TATUAGEM2.demoDataExemplo.secoes.portfolio.itens!;
    expect(schema.properties.textosSecoes.properties.estilos.properties.itens).toMatchObject({
      minItems: estilos.length,
      maxItems: estilos.length,
    });
    expect(schema.properties.textosSecoes.properties.portfolio.properties.itens).toMatchObject({
      minItems: portfolio.length,
      maxItems: portfolio.length,
    });
    // "investimento" não tem itens de exemplo — a propriedade nem aparece.
    expect(schema.properties.textosSecoes.properties.investimento.properties.itens).toBeUndefined();
  });

  it("validarSugestao aceita hero.rotulo/cta + itens por seção, no formato/quantidade do exemplo", () => {
    const estilos = TATUAGEM2.demoDataExemplo.secoes.estilos.itens!;
    const fonteValida = (
      schemaSugestao(TATUAGEM2, "completo") as {
        properties: { fonteDisplay: { enum: string[] } };
      }
    ).properties.fonteDisplay.enum[0];
    const bruto = {
      themeId: TATUAGEM2.themePresets[0].id,
      destaque: "#ff0055",
      fonteDisplay: fonteValida,
      animacao: "sutil",
      slogan: "Cor que fica.",
      descricao: "Estúdio autoral.",
      heroRotulo: "Studio autoral traduzido",
      heroCta: "Book a session",
      idioma: "pt-BR",
      textosSecoes: {
        estilos: {
          titulo: "Five languages",
          itens: estilos.map((item, i) => ({ titulo: `Style ${i}`, texto: item.texto })),
        },
      },
      servicos: TATUAGEM2.demoDataExemplo.servicos.map((s, i) => ({ nome: `Service ${i}` })),
      depoimentos: TATUAGEM2.demoDataExemplo.depoimentos.map((d, i) => ({
        autor: `Author ${i}`,
        texto: `Testimonial ${i}`,
      })),
    };

    const resultado = validarSugestao(bruto, TATUAGEM2, "completo");

    expect(resultado.problemas).toEqual([]);
    expect(resultado.sugestao?.heroRotulo).toBe("Studio autoral traduzido");
    expect(resultado.sugestao?.heroCta).toBe("Book a session");
    expect(resultado.sugestao?.textosSecoes?.estilos.itens).toHaveLength(estilos.length);
  });

  it("validarSugestao rejeita itens com quantidade diferente do exemplo (nunca inventa nem remove item)", () => {
    const bruto = {
      themeId: TATUAGEM2.themePresets[0].id,
      destaque: "#ff0055",
      fonteDisplay: (schemaSugestao(TATUAGEM2, "completo") as {
        properties: { fonteDisplay: { enum: string[] } };
      }).properties.fonteDisplay.enum[0],
      animacao: "sutil",
      slogan: "Cor que fica.",
      descricao: "Estúdio autoral.",
      heroRotulo: "Studio",
      heroCta: "Book",
      idioma: "pt-BR",
      textosSecoes: {
        estilos: { itens: [{ titulo: "Só um item" }] },
      },
    };

    const { sugestao, problemas } = validarSugestao(bruto, TATUAGEM2, "completo");

    expect(sugestao).toBeUndefined();
    expect(problemas).toContain(
      `textosSecoes.estilos.itens deve ser uma lista com ${TATUAGEM2.demoDataExemplo.secoes.estilos.itens!.length} item(ns)`,
    );
  });
});

/**
 * TESTE DE COBERTURA GENÉRICO — a rede de segurança real contra o bug
 * relatado em produção (itens[] das seções saindo sempre em pt-BR): em vez
 * de checar campos específicos por nome ("titulo", "subtitulo"…), este
 * bloco PERCORRE o `demoDataExemplo` de verdade de cada skin do registro —
 * qualquer profundidade, inclusive dentro de arrays — e monta a resposta
 * "perfeita" que o Gemini deveria devolver a partir do que encontrou.
 *
 * Cada campo de texto de CONTEÚDO descoberto precisa ter um destino
 * conhecido dentro do schema (`caminhoParaBruto`); um campo sem
 * mapeamento — porque `schemaSugestao`/`validarSugestao` nunca aprenderam
 * dele — falha o teste ANTES mesmo de chamar `validarSugestao`. Campos de
 * IDENTIDADE (nome/endereço/telefone/whatsapp/instagram/cidade/horários,
 * `secoes.hero.titulo`) e campos de DADO, não de conteúdo criativo
 * (`servico.preco/categoria/destaques`, `depoimento.nota/contexto` — fatos
 * do estoque do lead, não texto pra IA reescrever) são explicitamente
 * ignorados na varredura, mesmo critério do schema real.
 *
 * Se alguém adicionar um campo novo a `DemoItem`/`DemoSecao` (ex.: uma
 * "legenda") e esquecer de ensinar `schemaSugestao`/`validarSugestao`
 * sobre ele, este teste falha — hoje ele passaria mesmo com o campo
 * inteiramente fora do schema.
 */
describe("teste de cobertura — TODO campo de texto de conteúdo do exemplo real está no schema, em qualquer profundidade (todas as skins)", () => {
  type CaminhoConteudo = { caminho: (string | number)[]; valor: string };

  function ehObjeto(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
  }

  /** Campos de texto de UM item de `DemoSecao.itens` (ou do hero) — genérico, via Object.entries. */
  function camposDeItem(item: Record<string, unknown>): CaminhoConteudo[] {
    const campos: CaminhoConteudo[] = [];
    for (const [chave, valor] of Object.entries(item)) {
      if (typeof valor === "string" && valor.trim()) campos.push({ caminho: [chave], valor });
    }
    return campos;
  }

  /** Campos que existem em DemoSecao mas NÃO são conteúdo de texto (estrutura/apresentação). */
  const CAMPOS_SECAO_ESTRUTURAIS = new Set(["oculta", "alinhamento", "animacaoEntrada"]);

  /** Campos de texto de UMA `DemoSecao` (rotulo/titulo/texto/cta/ctaSecundaria/itens) — genérico. */
  function camposDeSecao(secao: Record<string, unknown>): CaminhoConteudo[] {
    const campos: CaminhoConteudo[] = [];
    for (const [chave, valor] of Object.entries(secao)) {
      if (CAMPOS_SECAO_ESTRUTURAIS.has(chave)) continue;
      if (chave === "itens" && Array.isArray(valor)) {
        valor.forEach((item, i) => {
          if (!ehObjeto(item)) return;
          for (const sub of camposDeItem(item)) {
            campos.push({ caminho: ["itens", i, ...sub.caminho], valor: sub.valor });
          }
        });
        continue;
      }
      if (typeof valor === "string" && valor.trim()) campos.push({ caminho: [chave], valor });
    }
    return campos;
  }

  /**
   * `servico.preco/precoPrefixo/precoValor/categoria/destaques`: dado do
   * lead/estoque, não texto pra IA reescrever — `precoPrefixo` ("A partir
   * de"/"Sob consulta") é conteúdo editável (entra no schema de
   * validação, `validate.ts`), mas segue o MESMO critério de `preco`
   * aqui: preço é fato do negócio, não tom de venda pra IA reescrever.
   */
  const CAMPOS_SERVICO_DADO = new Set(["preco", "precoPrefixo", "precoValor", "categoria", "destaques"]);
  /** `depoimento.nota/contexto`: idem — nota é número, contexto é dado do que foi comprado. */
  const CAMPOS_DEPOIMENTO_DADO = new Set(["nota", "contexto"]);

  /**
   * Todo campo de texto de CONTEÚDO do `DemoData` de exemplo, em qualquer
   * profundidade — nome/endereço/telefone/whatsapp/instagram/cidade/
   * horários (identidade do lead), `imagens`/`videos`/`ordemSecoes`
   * (caminhos/ids, não prosa) e `secoes.hero.titulo` (identidade: nome do
   * negócio) nunca são visitados.
   */
  function camposDeConteudo(exemplo: DemoData): CaminhoConteudo[] {
    const campos: CaminhoConteudo[] = [];

    if (exemplo.slogan?.trim()) campos.push({ caminho: ["slogan"], valor: exemplo.slogan });

    for (const [id, secao] of Object.entries(exemplo.secoes)) {
      if (!secao) continue;
      if (id === "hero") {
        for (const sub of camposDeSecao(secao as Record<string, unknown>)) {
          if (sub.caminho[0] === "titulo") continue; // identidade: nome/wordmark do negócio
          campos.push({ caminho: ["secoes", "hero", ...sub.caminho], valor: sub.valor });
        }
        continue;
      }
      for (const sub of camposDeSecao(secao as Record<string, unknown>)) {
        campos.push({ caminho: ["secoes", id, ...sub.caminho], valor: sub.valor });
      }
    }

    exemplo.servicos.forEach((servico, i) => {
      for (const [chave, valor] of Object.entries(servico)) {
        if (CAMPOS_SERVICO_DADO.has(chave)) continue;
        if (typeof valor === "string" && valor.trim()) {
          campos.push({ caminho: ["servicos", i, chave], valor });
        }
      }
    });

    exemplo.depoimentos.forEach((dep, i) => {
      for (const [chave, valor] of Object.entries(dep)) {
        if (CAMPOS_DEPOIMENTO_DADO.has(chave)) continue;
        if (typeof valor === "string" && valor.trim()) {
          campos.push({ caminho: ["depoimentos", i, chave], valor });
        }
      }
    });

    return campos;
  }

  /**
   * Traduz um caminho de `DemoData` (ex.: `["secoes","estilos","itens",0,"titulo"]`)
   * pro caminho equivalente dentro do `SugestaoDemo` que `validarSugestao`
   * entende. `undefined` = SEM mapeamento conhecido — o chamador trata isso
   * como falha de cobertura (campo fora do schema).
   */
  function caminhoParaBruto(caminho: (string | number)[]): (string | number)[] | undefined {
    const [primeiro, ...resto] = caminho;

    if (primeiro === "slogan") return ["slogan"];

    if (primeiro === "secoes") {
      const [id, campo, ...cauda] = resto;
      if (id === "hero") {
        if (campo === "texto") return ["descricao"];
        if (campo === "rotulo") return ["heroRotulo"];
        if (campo === "cta") return ["heroCta"];
        if (campo === "ctaSecundaria") return ["heroCtaSecundaria"];
        if (campo === "itens") return ["heroItens", cauda[0], cauda[1]];
        return undefined;
      }
      if (["rotulo", "titulo", "texto", "cta", "ctaSecundaria"].includes(campo as string)) {
        return ["textosSecoes", id, campo];
      }
      if (campo === "itens") return ["textosSecoes", id, "itens", cauda[0], cauda[1]];
      return undefined;
    }

    if (primeiro === "servicos") {
      const [idx, campo] = resto;
      if (campo === "nome" || campo === "descricao") return ["servicos", idx, campo];
      return undefined;
    }

    if (primeiro === "depoimentos") {
      const [idx, campo] = resto;
      if (campo === "autor" || campo === "texto") return ["depoimentos", idx, campo];
      return undefined;
    }

    return undefined;
  }

  function setPath(bruto: Record<string, unknown>, caminho: (string | number)[], valor: string): void {
    let alvo: Record<string, unknown> | unknown[] = bruto;
    for (let i = 0; i < caminho.length - 1; i++) {
      const chave = caminho[i];
      const proxima = caminho[i + 1];
      const atual = (alvo as Record<string, unknown>)[chave as never];
      if (atual === undefined) {
        (alvo as Record<string, unknown>)[chave as never] = (
          typeof proxima === "number" ? [] : {}
        ) as never;
      }
      alvo = (alvo as Record<string, unknown>)[chave as never] as Record<string, unknown>;
    }
    (alvo as Record<string, unknown>)[caminho[caminho.length - 1] as never] = valor as never;
  }

  it.each(SKINS.map((skin) => [skin.id, skin] as const))(
    "%s: todo campo de texto de conteúdo do exemplo real tem destino no schema e passa validação sem problemas",
    (_id, skin) => {
      const exemplo = skin.demoDataExemplo;
      const camposConteudo = camposDeConteudo(exemplo);
      // Sanidade do próprio teste: toda skin do registro tem conteúdo de
      // sobra (título/serviços/depoimentos) — uma lista vazia aqui
      // significaria que a varredura está quebrada, não que a skin não tem nada.
      expect(camposConteudo.length).toBeGreaterThan(5);

      const fonteValida = (
        schemaSugestao(skin, "completo") as { properties: { fonteDisplay: { enum: string[] } } }
      ).properties.fonteDisplay.enum[0];
      const bruto: Record<string, unknown> = {
        themeId: skin.themePresets[0].id,
        destaque: "#334455",
        fonteDisplay: fonteValida,
        animacao: "sutil",
        idioma: "pt-BR",
        // slogan/descricao são exigidos incondicionalmente pelo nível
        // "completo" (independente do exemplo ter hero.texto — nem toda
        // skin usa o campo, ex.: barbearia2), então entram com um valor
        // base aqui; a varredura abaixo SOBRESCREVE com o conteúdo real
        // do exemplo quando ele existe.
        descricao: "Descrição base (sem hero.texto no exemplo desta skin).",
        textosSecoes: {},
      };

      const semMapeamento: string[] = [];
      for (const campo of camposConteudo) {
        const caminhoBruto = caminhoParaBruto(campo.caminho);
        if (!caminhoBruto) {
          semMapeamento.push(campo.caminho.join("."));
          continue;
        }
        setPath(bruto, caminhoBruto, campo.valor);
      }

      // Todo campo descoberto no exemplo real tem que ter mapeamento — se
      // não tem, `schemaSugestao`/`validarSugestao` nunca aprenderam dele.
      expect(semMapeamento).toEqual([]);

      const resultado = validarSugestao(bruto, skin, "completo", "pt-BR");
      expect(resultado.problemas).toEqual([]);
    },
  );
});
