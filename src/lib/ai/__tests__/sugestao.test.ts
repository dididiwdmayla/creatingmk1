import { describe, expect, it } from "vitest";

import { DEFAULT_SKIN } from "@/lib/demos/registry";
import type { Lead } from "@/lib/leads/types";
import { montarPromptSugestao, schemaSugestao, validarSugestao } from "../sugestao";

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

/** Resposta válida mínima contra a skin default (barbearia). */
function sugestaoValida(): Record<string, unknown> {
  return {
    themeId: "meia-noite",
    destaque: "#8C4A2B",
    fonteDisplay: "playfair",
    animacao: "sutil",
    slogan: "Tradição de navalha desde sempre.",
    descricao: "Cortes clássicos e barba feita com calma, no coração de Sarandi.",
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
    const bruto = {
      themeId: "meia-noite",
      destaque: "#8C4A2B",
      fonteDisplay: "playfair",
      animacao: "sutil",
      slogan: "Tradição de navalha desde sempre.",
      descricao: "Cortes clássicos no coração de Sarandi.",
      idioma: "pt-BR",
      textosSecoes: {
        filosofia: { rotulo: "FILOSOFIA", titulo: "Nossa filosofia", texto: "O que nos guia." },
        servicos: { cta: "AGENDAR AGORA" },
      },
    };

    const resultado = validarSugestao(bruto, DEFAULT_SKIN, "completo");

    expect(resultado.problemas).toEqual([]);
    expect(resultado.sugestao?.textosSecoes).toEqual({
      filosofia: { rotulo: "FILOSOFIA", titulo: "Nossa filosofia", texto: "O que nos guia." },
      servicos: { cta: "AGENDAR AGORA" },
    });
    expect(resultado.sugestao?.titulosSecoes).toBeUndefined();
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
});
