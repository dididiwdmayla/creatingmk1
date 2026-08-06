import { describe, expect, it } from "vitest";

import {
  LIMITE_ENFILEIRADO_MS,
  LIMITE_RODANDO_MS,
  emAndamento,
  escritaAindaVale,
  estadoVisivel,
  mensagemDisparoLote,
  nomeDoPacote,
  nomeNoPacote,
  porTela,
  semNoticia,
  versaoDaImagem,
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

describe("porTela", () => {
  const imgs: CapturaImagem[] = [
    { ancora: "servicos", tela: "desktop", ordem: 2, url: "s-d", largura: 1440, altura: 1149 },
    { ancora: "hero", tela: "celular", ordem: 1, url: "h-c", largura: 390, altura: 844 },
    { ancora: "servicos", tela: "celular", ordem: 2, url: "s-c", largura: 390, altura: 1612 },
    { ancora: "hero", tela: "desktop", ordem: 1, url: "h-d", largura: 1440, altura: 900 },
  ];

  it("separa as duas telas, cada uma na ordem da marcação", () => {
    const grupos = porTela(imgs);
    expect(grupos.celular.map((i) => i.url)).toEqual(["h-c", "s-c"]);
    expect(grupos.desktop.map((i) => i.url)).toEqual(["h-d", "s-d"]);
  });

  it("grupo vazio é grupo vazio, não chave ausente — a ficha diz qual tela não saiu", () => {
    const grupos = porTela([imgs[1]]);
    expect(grupos.celular).toHaveLength(1);
    expect(grupos.desktop).toEqual([]);
  });

  it("lista vazia não quebra", () => {
    expect(porTela([])).toEqual({ celular: [], desktop: [] });
  });
});

describe("versaoDaImagem", () => {
  const crua: CapturaImagem = {
    ancora: "hero",
    tela: "celular",
    ordem: 1,
    url: "crua.png",
    largura: 780,
    altura: 1688,
  };
  const comMoldura: CapturaImagem = {
    ...crua,
    composta: { url: "moldura.png", largura: 960, altura: 1934 },
  };

  it("devolve a versão pedida com as medidas dela", () => {
    expect(versaoDaImagem(comMoldura, "crua")?.url).toBe("crua.png");
    expect(versaoDaImagem(comMoldura, "moldura")).toEqual({
      url: "moldura.png",
      largura: 960,
      altura: 1934,
    });
  });

  it("sem a versão pedida devolve undefined — NUNCA cai calada na outra", () => {
    expect(versaoDaImagem(crua, "moldura")).toBeUndefined();
  });
});

describe("nomes de download", () => {
  const imagem: CapturaImagem = {
    ancora: "hero",
    tela: "celular",
    ordem: 1,
    url: "x",
    largura: 780,
    altura: 1688,
  };

  it("o nome dentro do pacote é legível, não o id do lugar", () => {
    expect(nomeNoPacote(imagem, "Barbearia Norte", "moldura")).toBe(
      "barbearia-norte-celular-01-hero-moldura.png",
    );
    expect(nomeNoPacote(imagem, "Barbearia Norte", "crua")).toBe(
      "barbearia-norte-celular-01-hero.png",
    );
  });

  it("acento, pontuação e espaço viram nome de arquivo seguro", () => {
    expect(nomeDoPacote("Açaí & Cia. — Sarandi", "celular", "crua")).toBe(
      "acai-cia-sarandi-celular.zip",
    );
  });

  it("nome que some inteiro na limpeza ainda gera um arquivo nomeável", () => {
    expect(nomeDoPacote("!!!", "tudo", "moldura")).toBe("lead-capturas-moldura.zip");
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
