import { describe, expect, it } from "vitest";

import {
  enderecoExibido,
  fundoClaro,
  htmlMoldura,
  luminancia,
  medidasMoldura,
  nomeComposto,
} from "../moldura.mjs";

/**
 * O compositor é HTML, então o que dá pra cobrar dele em teste é o
 * CONTRATO: o que aparece e o que NÃO pode aparecer em cada moldura, as
 * medidas (que o motor usa pra dimensionar a página antes do screenshot) e
 * o tratamento de texto que vem de fora. O acabamento visual em si é
 * verificado por captura, que é o único jeito honesto de olhar desenho.
 */

const CELULAR = { tela: "celular" as const, src: "./x.png", largura: 780, altura: 2600 };
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
    const m = medidasCelular(CELULAR);
    expect(m.largura).toBeGreaterThan(CELULAR.largura);
    expect(m.altura).toBeGreaterThan(CELULAR.altura);
  });

  it("a faixa de status entra na altura — a ilha não pousa sobre a captura", () => {
    const m = medidasCelular(CELULAR);
    expect(m.faixa).toBeGreaterThan(0);
    expect(m.altura).toBe(CELULAR.altura + m.faixa + 2 * (m.borda + m.bisel) + 2 * m.margem);
  });

  it("a barra do navegador entra na altura da composta de desktop", () => {
    const m = medidasDesktop(DESKTOP);
    expect(m.altura).toBe(DESKTOP.altura + m.barra + 2 * m.margem);
    expect(m.largura).toBe(DESKTOP.largura + 2 * m.margem);
  });

  it("bisel e raio saem da LARGURA, nunca da altura: seção comprida vira aparelho comprido", () => {
    const curta = medidasCelular({ ...CELULAR, altura: 900 });
    const comprida = medidasCelular({ ...CELULAR, altura: 5200 });
    expect(comprida.bisel).toBe(curta.bisel);
    expect(comprida.raioCorpo).toBe(curta.raioCorpo);
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

  it("não estampa relógio nem barras de sinal (dado inventado na foto do lead)", () => {
    const html = htmlMoldura(CELULAR);
    expect(html).not.toMatch(/\d{1,2}:\d{2}/);
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
