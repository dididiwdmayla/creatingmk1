import { describe, expect, it } from "vitest";

import { montarFilaDoDia } from "../hoje";
import type { Lead, LeadStatus } from "../types";

const NOW = new Date("2026-07-20T12:00:00.000Z");

function lead(overrides: Partial<Lead> & { placeId: string }): Lead {
  return {
    nome: overrides.placeId,
    status: "novo" as LeadStatus,
    enriquecido: false,
    criadoEm: "2026-07-19T00:00:00.000Z",
    atualizadoEm: "2026-07-19T00:00:00.000Z",
    ...overrides,
  };
}

describe("montarFilaDoDia", () => {
  it("novos = criados depois do carimbo desde, por score desc", () => {
    const antigo = lead({ placeId: "antigo", criadoEm: "2026-07-10T00:00:00.000Z" });
    // siteProprio false (+3) + telefone (+2) > só telefone (+2) > nada (0).
    const quente = lead({
      placeId: "quente",
      criadoEm: "2026-07-19T10:00:00.000Z",
      siteProprio: false,
      temSite: false,
      temTelefone: true,
    });
    const morno = lead({
      placeId: "morno",
      criadoEm: "2026-07-19T11:00:00.000Z",
      temTelefone: true,
    });

    const fila = montarFilaDoDia([antigo, morno, quente], {
      desde: "2026-07-18T00:00:00.000Z",
      followUpDias: 4,
      now: NOW,
    });

    expect(fila.novos.map((l) => l.placeId)).toEqual(["quente", "morno"]);
  });

  it("sem carimbo (primeira visita) todos os leads contam como novos", () => {
    const leads = [
      lead({ placeId: "a", criadoEm: "2026-01-01T00:00:00.000Z" }),
      lead({ placeId: "b" }),
    ];

    const fila = montarFilaDoDia(leads, { followUpDias: 4, now: NOW });

    expect(fila.novos).toHaveLength(2);
  });

  it("empate de score desempata pelo mais recente primeiro", () => {
    const a = lead({ placeId: "a", criadoEm: "2026-07-19T01:00:00.000Z" });
    const b = lead({ placeId: "b", criadoEm: "2026-07-19T02:00:00.000Z" });

    const fila = montarFilaDoDia([a, b], {
      desde: "2026-07-18T00:00:00.000Z",
      followUpDias: 4,
      now: NOW,
    });

    expect(fila.novos.map((l) => l.placeId)).toEqual(["b", "a"]);
  });

  it("followUps = contactados sem resposta há mais de N dias, mais antigo primeiro", () => {
    const vencido = lead({
      placeId: "vencido",
      status: "contactado",
      contato: { primeiroContatoEm: "2026-07-10T00:00:00.000Z" },
    });
    const maisVencido = lead({
      placeId: "mais-vencido",
      status: "contactado",
      contato: { primeiroContatoEm: "2026-07-05T00:00:00.000Z" },
    });
    const recente = lead({
      placeId: "recente",
      status: "contactado",
      contato: { primeiroContatoEm: "2026-07-18T00:00:00.000Z" },
    });
    const respondeu = lead({
      placeId: "respondeu",
      status: "respondeu",
      contato: {
        primeiroContatoEm: "2026-07-01T00:00:00.000Z",
        respondeuEm: "2026-07-02T00:00:00.000Z",
      },
    });

    const fila = montarFilaDoDia([vencido, recente, respondeu, maisVencido], {
      desde: "2026-07-20T00:00:00.000Z",
      followUpDias: 4,
      now: NOW,
    });

    expect(fila.followUps.map((l) => l.placeId)).toEqual(["mais-vencido", "vencido"]);
  });

  it("followUpDias configurável muda o corte", () => {
    const contactado = lead({
      placeId: "x",
      status: "contactado",
      contato: { primeiroContatoEm: "2026-07-18T00:00:00.000Z" }, // há 2 dias
    });

    const com4 = montarFilaDoDia([contactado], { followUpDias: 4, now: NOW });
    const com1 = montarFilaDoDia([contactado], { followUpDias: 1, now: NOW });

    expect(com4.followUps).toHaveLength(0);
    expect(com1.followUps).toHaveLength(1);
  });

  it("demosParadas = demo salva com status ainda novo, demo mais antiga primeiro", () => {
    const demo = (criadoEm: string) =>
      ({ skinId: "s", themeId: "t", dados: {}, criadoEm, atualizadoEm: criadoEm }) as Lead["demo"];
    const parada = lead({ placeId: "parada", demo: demo("2026-07-15T00:00:00.000Z") });
    const paradaVelha = lead({
      placeId: "parada-velha",
      demo: demo("2026-07-10T00:00:00.000Z"),
    });
    const enviada = lead({
      placeId: "enviada",
      status: "contactado",
      demo: demo("2026-07-01T00:00:00.000Z"),
      contato: { primeiroContatoEm: "2026-07-19T00:00:00.000Z" },
    });

    const fila = montarFilaDoDia([parada, enviada, paradaVelha], {
      desde: "2026-07-20T00:00:00.000Z",
      followUpDias: 4,
      now: NOW,
    });

    expect(fila.demosParadas.map((l) => l.placeId)).toEqual(["parada-velha", "parada"]);
  });

  it("descartados ficam fora de todas as seções", () => {
    const descartado = lead({
      placeId: "desc",
      descartado: true,
      status: "contactado",
      contato: { primeiroContatoEm: "2026-07-01T00:00:00.000Z" },
      demo: {
        skinId: "s",
        themeId: "t",
        dados: {},
        criadoEm: "2026-07-01T00:00:00.000Z",
        atualizadoEm: "2026-07-01T00:00:00.000Z",
      },
    });

    const fila = montarFilaDoDia([descartado], { followUpDias: 4, now: NOW });

    expect(fila.novos).toHaveLength(0);
    expect(fila.followUps).toHaveLength(0);
    expect(fila.demosParadas).toHaveLength(0);
  });
});
