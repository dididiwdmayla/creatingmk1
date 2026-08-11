import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { idiomaEfetivoDemo, idiomaPadraoDoLead } from "../idioma";

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: "ChIJ001",
    nome: "Negócio Teste",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("idiomaPadraoDoLead", () => {
  it("sem endereço, cai no padrão", () => {
    expect(idiomaPadraoDoLead(lead())).toBe("pt-BR");
  });

  it("país simples deriva direto (sem cidade envolvida)", () => {
    expect(idiomaPadraoDoLead(lead({ endereco: "Av. Corrientes 123, Buenos Aires, Argentina" }))).toBe(
      "es-AR",
    );
  });

  it("Suíça: a cidade do endereço decide a variante regional", () => {
    expect(
      idiomaPadraoDoLead(lead({ endereco: "Rue du Rhône 10, 1204 Genève, Suíça" })),
    ).toBe("fr-CH");
    expect(
      idiomaPadraoDoLead(lead({ endereco: "Bahnhofstrasse 1, 8001 Zürich, Suíça" })),
    ).toBe("de-CH");
  });

  it("Canadá: Montreal sai em francês, Toronto em inglês", () => {
    expect(
      idiomaPadraoDoLead(lead({ endereco: "123 Rue Sainte-Catherine, Montréal, Canadá" })),
    ).toBe("fr-CA");
    expect(idiomaPadraoDoLead(lead({ endereco: "123 Queen St, Toronto, Canadá" }))).toBe("en-CA");
  });
});

describe("idiomaEfetivoDemo", () => {
  it("sobrescrita salva em LeadDemo.idioma vence o default derivado", () => {
    const l = lead({
      endereco: "Rue du Rhône 10, 1204 Genève, Suíça",
      demo: {
        skinId: "barbearia",
        themeId: "meia-noite",
        dados: {},
        criadoEm: "2026-07-01T00:00:00.000Z",
        atualizadoEm: "2026-07-01T00:00:00.000Z",
        idioma: "de-CH",
      },
    });
    expect(idiomaEfetivoDemo(l)).toBe("de-CH");
  });

  it("sem sobrescrita, usa o default derivado do endereço", () => {
    const l = lead({ endereco: "Rue du Rhône 10, 1204 Genève, Suíça" });
    expect(idiomaEfetivoDemo(l)).toBe("fr-CH");
  });
});
