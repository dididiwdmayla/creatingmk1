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
});
