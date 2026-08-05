import { describe, expect, it } from "vitest";

import {
  LIMITE_ENFILEIRADO_MS,
  LIMITE_RODANDO_MS,
  emAndamento,
  escritaAindaVale,
  estadoVisivel,
  mensagemDisparoLote,
  porAncora,
  semNoticia,
  type CapturaImagem,
  type LeadCapturas,
} from "../estado";

const AGORA = Date.parse("2026-08-05T12:00:00.000Z");

function capturas(patch: Partial<LeadCapturas> = {}): LeadCapturas {
  return {
    estado: "enfileirado",
    execucaoId: "exec-1",
    pedidoEm: new Date(AGORA).toISOString(),
    ...patch,
  };
}

describe("semNoticia", () => {
  it("estado terminal nunca fica sem notícia", () => {
    expect(semNoticia(capturas({ estado: "pronto" }), AGORA + 10 * 60 * 60 * 1000)).toBe(false);
    expect(semNoticia(capturas({ estado: "falhou" }), AGORA + 10 * 60 * 60 * 1000)).toBe(false);
  });

  it("enfileirado vira sem notícia depois do limite, contando do pedido", () => {
    expect(semNoticia(capturas(), AGORA + LIMITE_ENFILEIRADO_MS - 1)).toBe(false);
    expect(semNoticia(capturas(), AGORA + LIMITE_ENFILEIRADO_MS + 1)).toBe(true);
  });

  /**
   * O marco muda quando o workflow assume: um run que já começou tem
   * direito ao limite MAIOR, contado de quando começou — senão um lote
   * demorado seria dado como perdido no meio do caminho.
   */
  it("rodando conta do início do run, com o limite maior", () => {
    const c = capturas({
      estado: "rodando",
      iniciadoEm: new Date(AGORA + 9 * 60 * 1000).toISOString(),
    });
    expect(semNoticia(c, AGORA + 9 * 60 * 1000 + LIMITE_RODANDO_MS - 1)).toBe(false);
    expect(semNoticia(c, AGORA + 9 * 60 * 1000 + LIMITE_RODANDO_MS + 1)).toBe(true);
  });

  it("data corrompida não vira falha fantasma", () => {
    expect(semNoticia(capturas({ pedidoEm: "não é data" }), AGORA + 10 ** 9)).toBe(false);
  });

  it("sem capturas não há andamento", () => {
    expect(semNoticia(undefined, AGORA)).toBe(false);
    expect(emAndamento(undefined)).toBe(false);
  });
});

describe("estadoVisivel", () => {
  it("lead que nunca gerou", () => {
    expect(estadoVisivel(undefined, AGORA)).toEqual({
      estado: "nunca",
      rotulo: "Sem capturas",
      acompanhar: false,
    });
  });

  it("em andamento pede acompanhamento; terminal não", () => {
    expect(estadoVisivel(capturas(), AGORA).acompanhar).toBe(true);
    expect(estadoVisivel(capturas({ estado: "rodando" }), AGORA).acompanhar).toBe(true);
    expect(estadoVisivel(capturas({ estado: "pronto" }), AGORA).acompanhar).toBe(false);
    expect(estadoVisivel(capturas({ estado: "falhou" }), AGORA).acompanhar).toBe(false);
  });

  /**
   * O ponto da feature: um disparo que o GitHub nunca pegou não pode
   * deixar o lead "enfileirado" pra sempre — o operador tem que ver falha
   * e poder tentar de novo.
   */
  it("enfileirado sem notícia vira FALHA explícita, com a causa provável", () => {
    const v = estadoVisivel(capturas(), AGORA + LIMITE_ENFILEIRADO_MS + 1);
    expect(v.estado).toBe("falhou");
    expect(v.acompanhar).toBe(false);
    expect(v.detalhe).toContain("workflow não respondeu");
  });

  it("rodando sem notícia também vira falha, com outra causa", () => {
    const c = capturas({ estado: "rodando", iniciadoEm: new Date(AGORA).toISOString() });
    const v = estadoVisivel(c, AGORA + LIMITE_RODANDO_MS + 1);
    expect(v.estado).toBe("falhou");
    expect(v.detalhe).toContain("parou de dar notícia");
  });

  it("pronto conta as imagens e carrega o horário de geração", () => {
    const v = estadoVisivel(
      capturas({
        estado: "pronto",
        geradoEm: "2026-08-05T12:04:00.000Z",
        imagens: [{ ancora: "hero", tela: "celular", ordem: 1, url: "u", largura: 390, altura: 844 }],
      }),
      AGORA,
    );
    expect(v.rotulo).toBe("1 captura");
    expect(v.detalhe).toBe("2026-08-05T12:04:00.000Z");
  });

  it("falha carrega o motivo que o workflow gravou", () => {
    const v = estadoVisivel(capturas({ estado: "falhou", erro: "lead sem demo salva" }), AGORA);
    expect(v.detalhe).toBe("lead sem demo salva");
  });
});

describe("escritaAindaVale", () => {
  /**
   * O caso real: pedir, achar demorado, clicar em refazer. Dois runs vivos
   * — o antigo termina depois e não pode enterrar o resultado do novo.
   */
  it("só aceita escrita da execução vigente", () => {
    const atual = capturas({ execucaoId: "exec-2" });
    expect(escritaAindaVale(atual, "exec-2")).toBe(true);
    expect(escritaAindaVale(atual, "exec-1")).toBe(false);
  });

  it("lead sem capturas não aceita escrita de execução nenhuma", () => {
    expect(escritaAindaVale(undefined, "exec-1")).toBe(false);
  });
});

describe("porAncora", () => {
  const imgs: CapturaImagem[] = [
    { ancora: "servicos", tela: "desktop", ordem: 2, url: "s-d", largura: 1440, altura: 1149 },
    { ancora: "hero", tela: "celular", ordem: 1, url: "h-c", largura: 390, altura: 844 },
    { ancora: "servicos", tela: "celular", ordem: 2, url: "s-c", largura: 390, altura: 1612 },
    { ancora: "hero", tela: "desktop", ordem: 1, url: "h-d", largura: 1440, altura: 900 },
  ];

  it("agrupa as duas telas por âncora, na ordem da marcação", () => {
    const grupos = porAncora(imgs);
    expect(grupos.map((g) => g.ancora)).toEqual(["hero", "servicos"]);
    expect(grupos[0].telas.celular?.url).toBe("h-c");
    expect(grupos[0].telas.desktop?.url).toBe("h-d");
    expect(grupos[1].telas.celular?.url).toBe("s-c");
  });

  it("âncora com uma tela só (a outra reprovou no portão) continua listada", () => {
    const grupos = porAncora([imgs[1]]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].telas.desktop).toBeUndefined();
  });

  it("lista vazia não quebra", () => {
    expect(porAncora([])).toEqual([]);
  });
});

describe("mensagemDisparoLote", () => {
  it("diz o que aconteceu, nunca só some", () => {
    expect(mensagemDisparoLote(5, 0, 0)).toBe("5 leads na fila");
    expect(mensagemDisparoLote(1, 0, 0)).toBe("1 lead na fila");
    expect(mensagemDisparoLote(3, 1, 2)).toBe(
      "3 leads na fila · 2 pulados (sem demo salva) · 1 falhou no disparo",
    );
    expect(mensagemDisparoLote(0, 2, 0)).toBe("0 leads na fila · 2 falharam no disparo");
  });
});
