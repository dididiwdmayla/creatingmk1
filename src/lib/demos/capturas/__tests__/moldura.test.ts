import { describe, expect, it } from "vitest";

import {
  enderecoExibido,
  fundoClaro,
  htmlMoldura,
  luminancia,
  medidasMoldura,
  nomeComposto,
  PROPORCAO_APARELHO,
} from "../moldura.mjs";

/**
 * O compositor é HTML, então o que dá pra cobrar dele em teste é o
 * CONTRATO: o que aparece e o que NÃO pode aparecer em cada moldura, as
 * medidas (que o motor usa pra dimensionar a página antes do screenshot) e
 * o tratamento de texto que vem de fora. O acabamento visual em si é
 * verificado por captura, que é o único jeito honesto de olhar desenho.
 */

const UMA_TELA = 844 * 2; // a viewport de celular do motor, em pixel
const CELULAR = {
  tela: "celular" as const,
  src: "./x.png",
  largura: 780,
  altura: 2600,
  alturaTela: UMA_TELA,
};
const DESKTOP = { tela: "desktop" as const, src: "./x.png", largura: 1440, altura: 1100 };

// As medidas voltam discriminadas por tela (as duas molduras não têm as
// mesmas partes). Estes dois estreitam a união para o teste conseguir
// olhar as peças de cada uma.
function medidasCelular(captura: typeof CELULAR) {
  const m = medidasMoldura(captura);
  if (m.tela !== "celular") throw new Error("esperava medidas de celular");
  return m;
}
function medidasDesktop(captura: typeof DESKTOP) {
  const m = medidasMoldura(captura);
  if (m.tela !== "desktop") throw new Error("esperava medidas de desktop");
  return m;
}

/**
 * Só a MOLDURA, sem o `<head>`: o fundo da composição usa gradiente de
 * propósito (é a paleta da demo), e uma asserção sobre a página inteira
 * confundiria o fundo com brilho no aparelho.
 */
function soAMoldura(html: string): string {
  return html.slice(html.indexOf("<body>"));
}

describe("nomeComposto", () => {
  it("põe o sufixo antes da extensão", () => {
    expect(nomeComposto("lead-01-hero-celular.png")).toBe("lead-01-hero-celular-moldura.png");
  });

  it("não mexe em nome sem extensão .png", () => {
    expect(nomeComposto("sem-extensao")).toBe("sem-extensao");
  });
});

describe("medidasMoldura", () => {
  it("a composta é maior que a captura nas duas dimensões", () => {
    const m = medidasCelular({ ...CELULAR, altura: 1200 });
    expect(m.largura).toBeGreaterThan(CELULAR.largura);
    expect(m.altura).toBeGreaterThan(1200);
  });

  it("captura de até uma tela vira APARELHO, em proporção de aparelho real", () => {
    const m = medidasCelular({ ...CELULAR, altura: UMA_TELA });
    expect(m.modo).toBe("aparelho");
    expect(m.cortada).toBe(false);
    // A proporção da TELA é a da viewport do motor, que é a de um aparelho
    // de verdade — não um número inventado aqui.
    expect(m.alturaVisivel / CELULAR.largura).toBeCloseTo(UMA_TELA / CELULAR.largura, 5);
  });

  it("seção CURTA não vira celular atarracado: a tela continua com uma tela", () => {
    const m = medidasCelular({ ...CELULAR, altura: Math.round(UMA_TELA * 0.6) });
    expect(m.modo).toBe("aparelho");
    expect(m.alturaVisivel).toBe(UMA_TELA);
    // A sobra é preenchida com o fundo da demo — a página continuando, não
    // uma tarja preta.
    expect(m.folga).toBe(UMA_TELA - Math.round(UMA_TELA * 0.6));
    expect(m.cortada).toBe(false);
  });

  it("captura mais alta que uma tela NÃO vira aparelho esticado", () => {
    const m = medidasCelular({ ...CELULAR, altura: UMA_TELA * 2 });
    expect(m.modo).toBe("cartao");
    // O defeito que isto impede: um corpo de aparelho com proporção de 1:4.
    expect(m.cortada).toBe(false);
    expect(m.alturaVisivel).toBe(UMA_TELA * 2);
    expect(m.folga).toBe(0);
  });

  it("o cartão mostra a seção INTEIRA — quem corta seria a versão enviada", () => {
    const alta = medidasCelular({ ...CELULAR, altura: 5200 });
    expect(alta.alturaVisivel).toBe(5200);
    expect(alta.cortada).toBe(false);
  });

  it("uma folga de arredondamento não joga a captura para o cartão", () => {
    expect(medidasCelular({ ...CELULAR, altura: UMA_TELA + 4 }).modo).toBe("aparelho");
    expect(medidasCelular({ ...CELULAR, altura: UMA_TELA + 40 }).modo).toBe("cartao");
  });

  it("o aparelho tem canto bem mais arredondado que o cartão", () => {
    const aparelho = medidasCelular({ ...CELULAR, altura: UMA_TELA });
    const cartao = medidasCelular({ ...CELULAR, altura: UMA_TELA * 2 });
    expect(aparelho.raio).toBeGreaterThan(cartao.raio * 2);
  });

  it("sem a altura da tela, cai na proporção de aparelho de reserva", () => {
    const m = medidasCelular({
      tela: "celular",
      src: "./x.png",
      largura: 780,
      altura: Math.round(780 * PROPORCAO_APARELHO),
      alturaTela: undefined as unknown as number,
    });
    expect(m.modo).toBe("aparelho");
  });

  it("a barra do navegador entra na altura da composta de desktop", () => {
    const m = medidasDesktop(DESKTOP);
    expect(m.altura).toBe(DESKTOP.altura + m.barra + 2 * m.margem);
    expect(m.largura).toBe(DESKTOP.largura + 2 * m.margem);
  });

  it("borda e raio saem da LARGURA, nunca da altura", () => {
    const curta = medidasCelular({ ...CELULAR, altura: 3000 });
    const comprida = medidasCelular({ ...CELULAR, altura: 5200 });
    expect(comprida.borda).toBe(curta.borda);
    expect(comprida.raio).toBe(curta.raio);
    expect(comprida.largura).toBe(curta.largura);
  });
});

describe("moldura de celular", () => {
  it("não exibe endereço nenhum — é aparelho, não navegador", () => {
    const html = htmlMoldura({ ...CELULAR, endereco: "https://radar.exemplo.com/demo/abc" });
    expect(html).not.toContain("radar.exemplo.com");
    expect(html).not.toContain("/demo/abc");
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("não estampa relógio, ilha nem botão — a moldura é borda e canto, nada mais", () => {
    const moldura = soAMoldura(htmlMoldura(CELULAR));
    expect(moldura).not.toMatch(/\d{1,2}:\d{2}/);
    // Sem gradiente no corpo: gradiente ali é brilho de fotografia de
    // produto, e o objetivo é ler como site num celular, não como retrato
    // de um aparelho.
    expect(moldura).not.toContain("gradient");
  });

  it("aponta para a captura crua pelo caminho relativo recebido", () => {
    const html = htmlMoldura({ ...CELULAR, src: "./lead-01-hero-celular.png" });
    expect(html).toContain('src="./lead-01-hero-celular.png"');
  });
});

describe("moldura de navegador", () => {
  it("exibe o endereço real da demo", () => {
    const html = htmlMoldura({ ...DESKTOP, endereco: "https://radar.exemplo.com/demo/ChIJ-abc" });
    expect(html).toContain("radar.exemplo.com");
    expect(html).toContain("/demo/ChIJ-abc");
  });

  it("sem endereço configurado, a pastilha sai vazia — nunca um domínio inventado", () => {
    const html = htmlMoldura(DESKTOP);
    expect(html).not.toMatch(/https?:\/\/[a-z]/i);
    // A pastilha continua desenhada: é a janela que fica sem endereço, não
    // o navegador que vira outra coisa.
    expect(html).toContain("border-radius");
  });

  it("endereço ilegível é tratado como ausente, não impresso cru", () => {
    const html = htmlMoldura({ ...DESKTOP, endereco: "isto não é uma url" });
    expect(html).not.toContain("isto não é uma url");
  });

  it("não deixa o endereço injetar marcação (ele carrega o id do lead)", () => {
    const html = htmlMoldura({
      ...DESKTOP,
      endereco: 'https://radar.exemplo.com/demo/a"><script>alert(1)</script>',
    });
    // Duas defesas em série: a `URL` normaliza o caminho para
    // percent-encoding e o `escapar` cuida do resto. Aqui a primeira já
    // resolve — o teste cobra o resultado, não o caminho.
    expect(html).not.toContain("<script>");
    expect(html).toContain("%3Cscript%3E");
  });

  it("escapa o caminho relativo da captura antes de virar atributo", () => {
    const html = htmlMoldura({ ...DESKTOP, src: './x.png" onerror="alert(1)' });
    expect(html).not.toContain('onerror="alert(1)"');
    expect(html).toContain("&quot;");
  });
});

describe("enderecoExibido", () => {
  it("separa esquema, host e caminho como um navegador mostra", () => {
    expect(enderecoExibido("https://radar.exemplo.com/demo/abc?x=1")).toEqual({
      antes: "",
      host: "radar.exemplo.com",
      depois: "/demo/abc?x=1",
    });
  });

  it("mantém http:// visível — esconder o esquema inseguro seria mentir sobre ele", () => {
    expect(enderecoExibido("http://exemplo.com/demo/a")?.antes).toBe("http://");
  });

  it("vazio, indefinido e lixo devolvem null", () => {
    expect(enderecoExibido("")).toBeNull();
    expect(enderecoExibido(undefined)).toBeNull();
    expect(enderecoExibido("nada disso")).toBeNull();
  });
});

describe("luminancia / fundoClaro", () => {
  it("lê hex curto, hex longo e rgb() — que é como o computed style devolve", () => {
    expect(luminancia("#fff")).toBeCloseTo(1, 3);
    expect(luminancia("#000000")).toBeCloseTo(0, 3);
    expect(luminancia("rgb(255, 255, 255)")).toBeCloseTo(1, 3);
    expect(luminancia("rgba(0, 0, 0, 0.5)")).toBeCloseTo(0, 3);
  });

  it("cor que não dá pra ler devolve null, em vez de um preto silencioso", () => {
    expect(luminancia("var(--d-bg)")).toBeNull();
    expect(luminancia(undefined as unknown as string)).toBeNull();
  });

  it("decide o cromo pela paleta da demo, e cai no escuro quando não sabe", () => {
    expect(fundoClaro({ fundo: "#faf7f2", fundoAlt: "#ffffff" })).toBe(true);
    expect(fundoClaro({ fundo: "#0b0b0c", fundoAlt: "#121214" })).toBe(false);
    expect(fundoClaro(undefined)).toBe(false);
  });
});
