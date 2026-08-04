import { describe, expect, it } from "vitest";

import { patchCriacaoLote, projecaoChamadasIA, projecaoCotaIA } from "../lote";

describe("patchCriacaoLote", () => {
  it("sem efeito nem modo alternativo: dados vazio, sem tema", () => {
    expect(
      patchCriacaoLote({ skinId: "barbearia-editorial", themeId: "classico", imagensModo: "foto" }),
    ).toEqual({ dados: {} });
  });

  it("modo grafico entra no patch (foto é o default, não precisa escrever)", () => {
    expect(
      patchCriacaoLote({
        skinId: "barbearia-editorial",
        themeId: "classico",
        imagensModo: "grafico",
      }),
    ).toEqual({ dados: { imagensModo: "grafico" } });
  });

  it("efeito escolhido entra em tema.fundoEfeito", () => {
    expect(
      patchCriacaoLote({
        skinId: "barbearia-editorial",
        themeId: "classico",
        efeitoId: "aura",
        imagensModo: "foto",
      }),
    ).toEqual({ dados: {}, tema: { fundoEfeito: "aura" } });
  });

  it('efeitoId "nenhum" não escreve tema', () => {
    expect(
      patchCriacaoLote({
        skinId: "barbearia-editorial",
        themeId: "classico",
        efeitoId: "nenhum",
        imagensModo: "foto",
      }),
    ).toEqual({ dados: {} });
  });

  it("combina modo grafico + efeito", () => {
    expect(
      patchCriacaoLote({
        skinId: "barbearia-editorial",
        themeId: "classico",
        efeitoId: "grao",
        imagensModo: "grafico",
      }),
    ).toEqual({ dados: { imagensModo: "grafico" }, tema: { fundoEfeito: "grao" } });
  });
});

describe("projecaoChamadasIA", () => {
  it("mínimo é 1 por lead, máximo é 2 por lead (retry de resposta inválida)", () => {
    expect(projecaoChamadasIA(5)).toEqual({ minimo: 5, maximo: 10 });
  });

  it("zero leads: zero chamadas", () => {
    expect(projecaoChamadasIA(0)).toEqual({ minimo: 0, maximo: 0 });
  });
});

describe("projecaoCotaIA", () => {
  it("projeta o restante da cota no melhor e no pior caso", () => {
    expect(projecaoCotaIA(10, 50, 5)).toEqual({
      usado: 10,
      teto: 50,
      restanteAntes: 40,
      restanteDepoisMin: 35,
      restanteDepoisMax: 30,
      podeEstourar: false,
    });
  });

  it("marca podeEstourar quando o pior caso ultrapassa o teto, sem números negativos", () => {
    expect(projecaoCotaIA(45, 50, 10)).toEqual({
      usado: 45,
      teto: 50,
      restanteAntes: 5,
      restanteDepoisMin: 0,
      restanteDepoisMax: 0,
      podeEstourar: true,
    });
  });

  it("uso já acima do teto não devolve restante negativo", () => {
    const projecao = projecaoCotaIA(60, 50, 1);
    expect(projecao.restanteAntes).toBe(0);
    expect(projecao.podeEstourar).toBe(true);
  });
});
