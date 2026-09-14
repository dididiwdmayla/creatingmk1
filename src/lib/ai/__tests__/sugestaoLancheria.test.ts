import { describe, expect, it } from "vitest";

import { LANCHERIA2_VARIANTES } from "@/components/demos/lancheria2/variantes";
import { getSkin } from "@/lib/demos/registry";
import { temaCalibrado } from "@/lib/demos/variantes";
import type { Lead } from "@/lib/leads/types";
import {
  montarPromptSugestao,
  schemaSugestao,
  validarSugestao,
  type SugestaoDemo,
} from "../sugestao";

/**
 * Cobertura da `lancheria-2` (skin de tema CALIBRADO — catálogo
 * `DemoLancheria`, cores em quente/frio) no mesmo mecanismo de IA das
 * outras oito skins, mas pelo ramo próprio (`schemaSugestaoLancheria` e
 * companhia em ../sugestao.ts) — ver "IA na Forja" em ARCHITECTURE.md.
 */

const SKIN = getSkin("lancheria-2")!;

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
  placeId: "ChIJ002",
  nome: "Lancheria do Zé",
  endereco: "Av. Brasil, 456 - Centro, Maringá PR",
  status: "novo",
  busca: { nicho: "lancheria", regiao: "Maringá PR", em: "2026-07-01" },
  enriquecido: true,
  detalhes: {
    rating: 4.6,
    totalAvaliacoes: 88,
    enriquecidoEm: "2026-07-01T00:00:00.000Z",
  },
  criadoEm: "2026-07-01T00:00:00.000Z",
  atualizadoEm: "2026-07-01T00:00:00.000Z",
};

describe("lancheria-2 é uma skin de tema calibrado", () => {
  it("temaCalibrado(SKIN) é true — dispara o ramo próprio de schemaSugestao/montarPromptSugestao/validarSugestao", () => {
    expect(temaCalibrado(SKIN)).toBe(true);
  });
});

describe("trava do contrato — as quatro variantes compartilham o mesmo formato de conteúdo", () => {
  it("as quatro variantes têm exatamente as mesmas chaves em lancheria.textos", () => {
    const [primeira, ...resto] = LANCHERIA2_VARIANTES.map((v) =>
      Object.keys(v.exemplo.lancheria!.textos).sort(),
    );
    for (const chaves of resto) expect(chaves).toEqual(primeira);
  });

  it("as quatro variantes têm a mesma quantidade de lanches e de extras", () => {
    const quantidades = LANCHERIA2_VARIANTES.map((v) => ({
      lanches: v.exemplo.lancheria!.lanches.length,
      extras: v.exemplo.lancheria!.extras.length,
    }));
    const [primeira, ...resto] = quantidades;
    for (const q of resto) expect(q).toEqual(primeira);
  });
});

describe("schemaSugestao(lancheria-2) — montado a partir dos slots de CONTEÚDO, nenhuma identidade", () => {
  it.each(["toque-leve", "equilibrado", "completo"] as const)(
    "nível %s: nenhum campo de identidade do lead é propriedade do schema",
    (nivel) => {
      const schema = schemaSugestao(SKIN, nivel) as { properties: Record<string, unknown> };
      const chavesTopo = Object.keys(schema.properties);
      for (const campo of CAMPOS_IDENTIDADE_LEAD) {
        expect(chavesTopo).not.toContain(campo);
      }
    },
  );

  it("toque-leve: só themeId/quente/frio — nenhum destaque/fonteDisplay/animacao genérico, nenhum texto", () => {
    const schema = schemaSugestao(SKIN, "toque-leve") as {
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(Object.keys(schema.properties).sort()).toEqual(["frio", "quente", "themeId"]);
    expect(schema.required.sort()).toEqual(["frio", "quente", "themeId"]);
  });

  it("equilibrado: textos curtos da abertura/história, sem os parágrafos nem o catálogo", () => {
    const schema = schemaSugestao(SKIN, "equilibrado") as {
      properties: {
        lancheriaTextos: { properties: Record<string, unknown> };
        lanches?: unknown;
        extras?: unknown;
      };
    };
    const chaves = Object.keys(schema.properties.lancheriaTextos.properties);
    expect(chaves).toEqual(
      expect.arrayContaining(["heroTitulo", "heroDescricao", "historiaTitulo", "carimbo"]),
    );
    expect(chaves).not.toContain("historia");
    expect(chaves).not.toContain("heroAlt");
    expect(chaves).not.toContain("historiaAlt");
    expect(schema.properties.lanches).toBeUndefined();
    expect(schema.properties.extras).toBeUndefined();
  });

  it("completo: ganha historia[]/heroAlt/historiaAlt + lanches[]/extras[] de tamanho FIXO", () => {
    const schema = schemaSugestao(SKIN, "completo") as {
      properties: {
        lancheriaTextos: {
          properties: { historia: { minItems: number; maxItems: number } };
        };
        lanches: { minItems: number; maxItems: number };
        extras: { minItems: number; maxItems: number };
      };
    };
    const exemplo = SKIN.demoDataExemplo.lancheria!;
    expect(schema.properties.lancheriaTextos.properties.historia).toMatchObject({
      minItems: exemplo.textos.historia.length,
      maxItems: exemplo.textos.historia.length,
    });
    expect(schema.properties.lanches).toMatchObject({
      minItems: exemplo.lanches.length,
      maxItems: exemplo.lanches.length,
    });
    expect(schema.properties.extras).toMatchObject({
      minItems: exemplo.extras.length,
      maxItems: exemplo.extras.length,
    });
  });

  it("preço nunca faz parte do schema de lanches/extras (é dado do lead)", () => {
    const schema = schemaSugestao(SKIN, "completo") as {
      properties: {
        lanches: { items: { properties: Record<string, unknown> } };
        extras: { items: { properties: Record<string, unknown> } };
      };
    };
    expect(Object.keys(schema.properties.lanches.items.properties)).toEqual(["nome"]);
    expect(Object.keys(schema.properties.extras.items.properties)).toEqual(["nome"]);
  });
});

describe("montarPromptSugestao(lancheria-2)", () => {
  it("inclui nicho/nome/rating do lead e as escolhas de tema (variante + quente/frio)", () => {
    const prompt = montarPromptSugestao(SKIN, LEAD, "toque-leve");
    expect(prompt).toContain("Lancheria do Zé");
    expect(prompt).toContain("Nicho: lancheria");
    expect(prompt).toContain("4.6 (88 avaliações)");
    expect(prompt).toContain("quente");
    expect(prompt).toContain("frio");
    expect(prompt).not.toContain("titulosSecoes");
    expect(prompt).not.toContain("textosSecoes");
  });

  it("completo: menciona os lanches/extras do exemplo pelo nome, na mesma ordem", () => {
    const prompt = montarPromptSugestao(SKIN, LEAD, "completo");
    const exemplo = SKIN.demoDataExemplo.lancheria!;
    for (const lanche of exemplo.lanches) expect(prompt).toContain(lanche.nome);
    for (const extra of exemplo.extras) expect(prompt).toContain(extra.nome);
  });
});

describe("validarSugestao(lancheria-2)", () => {
  function sugestaoCompletaValida(): Record<string, unknown> {
    const exemplo = SKIN.demoDataExemplo.lancheria!;
    return {
      themeId: SKIN.themePresets[0].id,
      quente: "#AA3322",
      frio: "#2244AA",
      idioma: "pt-BR",
      lancheriaTextos: {
        heroTitulo: "Sabor de verdade, direto da chapa.",
        heroDescricao: "Pão quentinho, recheio generoso.",
        historiaTitulo: "Uma história de bairro.",
        carimbo: "MARINGÁ / CHAPA / PÃO",
        historia: exemplo.textos.historia.map((_, i) => `Parágrafo traduzido ${i + 1}.`),
        heroAlt: "Lanche saindo da chapa quente.",
        historiaAlt: "Chapa pronta para o próximo pedido.",
      },
      lanches: exemplo.lanches.map((_, i) => ({ nome: `Lanche ${i + 1}` })),
      extras: exemplo.extras.map((_, i) => ({ nome: `Item ${i + 1}` })),
    };
  }

  it("aceita uma resposta completa e válida, sem propriedades genéricas de destaque/fonte/animação", () => {
    const { sugestao, problemas } = validarSugestao(sugestaoCompletaValida(), SKIN, "completo", "pt-BR");
    expect(problemas).toEqual([]);
    expect(sugestao).toBeDefined();
    const s = sugestao as SugestaoDemo;
    expect(s.quente).toBe("#aa3322");
    expect(s.frio).toBe("#2244aa");
    expect(s.destaque).toBeUndefined();
    expect(s.fonteDisplay).toBeUndefined();
    expect(s.animacao).toBeUndefined();
    expect(s.lanches).toHaveLength(SKIN.demoDataExemplo.lancheria!.lanches.length);
    expect(s.extras).toHaveLength(SKIN.demoDataExemplo.lancheria!.extras.length);
  });

  it("rejeita chave de identidade injetada na resposta (nome/endereco/etc. nunca são aceitos)", () => {
    for (const campo of CAMPOS_IDENTIDADE_LEAD) {
      const bruto = { ...sugestaoCompletaValida(), [campo]: "valor invasor" };
      const { sugestao, problemas } = validarSugestao(bruto, SKIN, "completo", "pt-BR");
      expect(sugestao).toBeUndefined();
      expect(problemas).toContain(`chave desconhecida: ${campo}`);
    }
  });

  it("rejeita cor fora do formato hex", () => {
    const { sugestao, problemas } = validarSugestao(
      { ...sugestaoCompletaValida(), quente: "vermelho" },
      SKIN,
      "completo",
      "pt-BR",
    );
    expect(sugestao).toBeUndefined();
    expect(problemas).toContain("quente deve ser cor hex no formato #rrggbb");
  });

  it("rejeita lanches/extras com quantidade diferente do exemplo (não pode inventar nem remover item)", () => {
    const bruto = sugestaoCompletaValida();
    bruto.lanches = (bruto.lanches as unknown[]).slice(1);
    const { sugestao, problemas } = validarSugestao(bruto, SKIN, "completo", "pt-BR");
    expect(sugestao).toBeUndefined();
    expect(problemas.some((p) => p.startsWith("lanches deve ser uma lista com"))).toBe(true);
  });

  it("toque-leve: aceita só themeId/quente/frio", () => {
    const { sugestao, problemas } = validarSugestao(
      { themeId: SKIN.themePresets[0].id, quente: "#112233", frio: "#445566" },
      SKIN,
      "toque-leve",
    );
    expect(problemas).toEqual([]);
    expect(sugestao).toEqual({
      themeId: SKIN.themePresets[0].id,
      quente: "#112233",
      frio: "#445566",
    });
  });
});
