import { describe, expect, it } from "vitest";

import {
  mensagemResultadoLote,
  patchCriacaoLote,
  projecaoChamadasIA,
  projecaoCotaIA,
  relatorioVazio,
  type RelatorioLote,
} from "../lote";

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

function relatorio(sucessos: number, falhas: number, cancelado = false): RelatorioLote {
  const r = relatorioVazio();
  for (let i = 0; i < sucessos; i++) r.sucessos.push({ placeId: `s${i}`, nome: `S${i}`, ok: true });
  for (let i = 0; i < falhas; i++) {
    r.falhas.push({ placeId: `f${i}`, nome: `F${i}`, ok: false, erro: "erro" });
  }
  r.cancelado = cancelado;
  return r;
}

describe("mensagemResultadoLote", () => {
  it("todas criadas, nenhuma pulada, sem falha: sem menção a falha", () => {
    expect(mensagemResultadoLote(relatorio(5, 0), 5)).toBe("5 demos criadas · 0 puladas");
  });

  it("puladas = total do grupo menos criadas menos falhas (não só os selecionados)", () => {
    // grupo de 10, só 5 foram tentados (3 criados, 2 falharam) — 5 nunca tentados.
    expect(mensagemResultadoLote(relatorio(3, 2), 10)).toBe(
      "3 demos criadas · 5 puladas · 2 falharam",
    );
  });

  it("singular correto pra 1 criada/1 pulada/1 falha", () => {
    expect(mensagemResultadoLote(relatorio(1, 1), 3)).toBe("1 demo criada · 1 pulada · 1 falhou");
  });

  it("cancelado aparece como sufixo informativo", () => {
    expect(mensagemResultadoLote(relatorio(2, 0, true), 5)).toBe(
      "2 demos criadas · 3 puladas · cancelado antes do fim",
    );
  });

  it("nunca reporta pulada negativa mesmo com dado inconsistente", () => {
    expect(mensagemResultadoLote(relatorio(5, 5), 3)).toBe("5 demos criadas · 0 puladas · 5 falharam");
  });
});
