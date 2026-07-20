import { describe, expect, it } from "vitest";

import type { Lead } from "../types";
import { calculaScore } from "../score";

function baseLead(overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: "P1",
    nome: "Lead teste",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("calculaScore", () => {
  it("lead sem nenhum sinal vale 0", () => {
    expect(calculaScore(baseLead())).toBe(0);
  });

  it("sem site próprio: +3", () => {
    expect(calculaScore(baseLead({ siteProprio: false }))).toBe(3);
  });

  it("com site próprio: sem bônus", () => {
    expect(calculaScore(baseLead({ siteProprio: true }))).toBe(0);
  });

  it("só rede social conta como sem site próprio: +3", () => {
    expect(
      calculaScore(baseLead({ temSite: true, siteUrl: "https://instagram.com/negocio" })),
    ).toBe(3);
  });

  it("telefone presente: +2", () => {
    expect(calculaScore(baseLead({ temTelefone: true }))).toBe(2);
  });

  it("telefone presente (lead enriquecido usa detalhes.telefone): +2", () => {
    expect(
      calculaScore(
        baseLead({
          siteProprio: true,
          enriquecido: true,
          detalhes: { telefone: "(44) 1111-1111", enriquecidoEm: "2026-07-01T00:00:00.000Z" },
        }),
      ),
    ).toBe(2);
  });

  it("sem telefone: sem bônus", () => {
    expect(calculaScore(baseLead({ temTelefone: false }))).toBe(0);
  });

  it("rating >= 4.5: +2", () => {
    const detalhes = { rating: 4.5, enriquecidoEm: "2026-07-01T00:00:00.000Z" };
    expect(calculaScore(baseLead({ detalhes }))).toBe(2);
  });

  it("rating abaixo de 4.5: sem bônus", () => {
    const detalhes = { rating: 4.4, enriquecidoEm: "2026-07-01T00:00:00.000Z" };
    expect(calculaScore(baseLead({ detalhes }))).toBe(0);
  });

  it("userRatingCount >= 50: +1", () => {
    const detalhes = { totalAvaliacoes: 50, enriquecidoEm: "2026-07-01T00:00:00.000Z" };
    expect(calculaScore(baseLead({ detalhes }))).toBe(1);
  });

  it("userRatingCount abaixo de 50: sem bônus", () => {
    const detalhes = { totalAvaliacoes: 49, enriquecidoEm: "2026-07-01T00:00:00.000Z" };
    expect(calculaScore(baseLead({ detalhes }))).toBe(0);
  });

  it("descartado: -10, mesmo com outros bônus", () => {
    expect(
      calculaScore(baseLead({ siteProprio: false, temTelefone: true, descartado: true })),
    ).toBe(3 + 2 - 10);
  });

  it("já contactado (status != novo): -5", () => {
    expect(calculaScore(baseLead({ status: "contactado" }))).toBe(-5);
  });

  it("respondeu e fechado também contam como já contactado: -5", () => {
    expect(calculaScore(baseLead({ status: "respondeu" }))).toBe(-5);
    expect(calculaScore(baseLead({ status: "fechado" }))).toBe(-5);
  });

  it("combina todos os bônus e penalidades", () => {
    const lead = baseLead({
      status: "contactado",
      siteProprio: false,
      temTelefone: true,
      detalhes: { rating: 4.8, totalAvaliacoes: 120, enriquecidoEm: "2026-07-01T00:00:00.000Z" },
    });
    // +3 (sem site) +2 (telefone) +2 (rating) +1 (avaliações) -5 (já contactado)
    expect(calculaScore(lead)).toBe(3);
  });
});
