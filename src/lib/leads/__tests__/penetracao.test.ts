import { describe, expect, it } from "vitest";

import {
  PENETRACAO_BASE_MINIMA,
  argumentoForte,
  argumentoPenetracao,
  calcularPenetracaoSite,
} from "../penetracao";
import type { Lead } from "../types";

function lead(over: Partial<Lead>): Lead {
  return {
    placeId: "id",
    nome: "Lead",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

describe("calcularPenetracaoSite", () => {
  it("mistos: classifica com site próprio, só rede social e sem nada, e reporta desconhecidos à parte", () => {
    const leads = [
      lead({ placeId: "1", siteProprio: true }),
      lead({ placeId: "2", siteProprio: true }),
      lead({ placeId: "3", siteProprio: false, temSite: true, siteUrl: "https://instagram.com/x" }),
      lead({ placeId: "4", siteProprio: false, temSite: false }),
      lead({ placeId: "5", siteProprio: false, temSite: false }),
      lead({ placeId: "6" }), // siteProprio ausente = desconhecido
    ];

    const r = calcularPenetracaoSite(leads);

    expect(r).toMatchObject({
      total: 5,
      comSiteProprio: 2,
      soRedeSocial: 1,
      semNada: 2,
      desconhecidos: 1,
    });
    expect(r.percentuais).toEqual({ comSiteProprio: 40, soRedeSocial: 20, semNada: 40 });
  });

  it("todos desconhecidos: total 0, percentuais ausentes, desconhecidos contados", () => {
    const leads = [lead({ placeId: "1" }), lead({ placeId: "2" }), lead({ placeId: "3" })];

    const r = calcularPenetracaoSite(leads);

    expect(r).toMatchObject({ total: 0, comSiteProprio: 0, soRedeSocial: 0, semNada: 0, desconhecidos: 3 });
    expect(r.percentuais).toBeUndefined();
  });

  it("base pequena (<5 conhecidos) não exibe percentual, mesmo com contagens", () => {
    const leads = Array.from({ length: PENETRACAO_BASE_MINIMA - 1 }, (_, i) =>
      lead({ placeId: `id-${i}`, siteProprio: true }),
    );

    const r = calcularPenetracaoSite(leads);

    expect(r.total).toBe(PENETRACAO_BASE_MINIMA - 1);
    expect(r.percentuais).toBeUndefined();
  });

  it("base exatamente no mínimo já exibe percentual", () => {
    const leads = Array.from({ length: PENETRACAO_BASE_MINIMA }, (_, i) =>
      lead({ placeId: `id-${i}`, siteProprio: i % 2 === 0 }),
    );

    const r = calcularPenetracaoSite(leads);

    expect(r.total).toBe(PENETRACAO_BASE_MINIMA);
    expect(r.percentuais).toBeDefined();
  });

  it("lista vazia: tudo zero, sem percentual", () => {
    const r = calcularPenetracaoSite([]);
    expect(r).toEqual({
      total: 0,
      comSiteProprio: 0,
      soRedeSocial: 0,
      semNada: 0,
      desconhecidos: 0,
      percentuais: undefined,
    });
  });
});

describe("argumentoForte", () => {
  it(">60% de site próprio = argumento forte", () => {
    const leads = Array.from({ length: 10 }, (_, i) => lead({ placeId: `id-${i}`, siteProprio: i < 7 }));
    expect(argumentoForte(calcularPenetracaoSite(leads))).toBe(true);
  });

  it("60% exato não é forte (estritamente maior que 60)", () => {
    const leads = Array.from({ length: 10 }, (_, i) => lead({ placeId: `id-${i}`, siteProprio: i < 6 }));
    expect(argumentoForte(calcularPenetracaoSite(leads))).toBe(false);
  });

  it("sem percentual (base pequena) nunca é forte", () => {
    const leads = [lead({ placeId: "1", siteProprio: true })];
    expect(argumentoForte(calcularPenetracaoSite(leads))).toBe(false);
  });
});

describe("argumentoPenetracao", () => {
  it("monta a linha de argumento com o percentual de site próprio", () => {
    const leads = Array.from({ length: 10 }, (_, i) => lead({ placeId: `id-${i}`, siteProprio: i < 7 }));
    const texto = argumentoPenetracao("barbearia", "Maringá", calcularPenetracaoSite(leads), "Corte & Estilo");
    expect(texto).toBe(
      "70% dos estabelecimentos de barbearia em Maringá que mapeamos já têm site — " +
        "a Corte & Estilo está entre os que ainda não têm.",
    );
  });

  it("base pequena → undefined (não exibe percentual)", () => {
    const leads = [lead({ placeId: "1", siteProprio: true })];
    const texto = argumentoPenetracao("barbearia", "Maringá", calcularPenetracaoSite(leads), "Corte & Estilo");
    expect(texto).toBeUndefined();
  });
});
