import { describe, expect, it } from "vitest";

import { apoioCurto, htmlPrevia, PREVIA_ALTURA, PREVIA_LARGURA, tamanhoDoNome } from "../previa.mjs";

/**
 * A prévia existe para UMA coisa: o nome do negócio legível no tamanho em
 * que um cartão de conversa aparece. É isso que estes testes cobram — o
 * nome como texto da composição (nunca pixel do print), o piso do tamanho
 * e o corte da linha de apoio. O acabamento é verificado por captura, na
 * proporção e no tamanho reais do cartão.
 */

const BASE = {
  src: "./topo.png",
  largura: 1440,
  altura: 900,
  nome: "Barbearia Norte",
};

describe("tamanhoDoNome", () => {
  it("encolhe conforme o nome cresce, mas nunca abaixo do piso legível", () => {
    const curto = tamanhoDoNome("Bar do Zé");
    const longo = tamanhoDoNome("Centro Automotivo e Mecânica Especializada Sul");
    expect(curto).toBeGreaterThan(longo);
    expect(longo).toBeGreaterThanOrEqual(46);
  });

  it("nome vazio não quebra o cálculo", () => {
    expect(tamanhoDoNome("")).toBeGreaterThan(0);
  });
});

describe("apoioCurto", () => {
  it("devolve o texto inteiro quando cabe", () => {
    expect(apoioCurto("Tradição de barbearia clássica.")).toBe("Tradição de barbearia clássica.");
  });

  it("corta em espaço e marca com reticências", () => {
    const cortado = apoioCurto("a".repeat(30) + " " + "b".repeat(200), 40);
    expect(cortado?.endsWith("…")).toBe(true);
    expect(cortado).not.toContain("bbbb");
  });

  it("normaliza espaço em branco — texto de demo vem com quebra de linha", () => {
    expect(apoioCurto("  duas\n  linhas  ")).toBe("duas linhas");
  });

  it("vazio e indefinido não viram linha em branco no cartão", () => {
    expect(apoioCurto("   ")).toBeUndefined();
    expect(apoioCurto(undefined)).toBeUndefined();
  });
});

describe("htmlPrevia", () => {
  it("escreve o nome do negócio como TEXTO da composição", () => {
    const html = htmlPrevia(BASE);
    expect(html).toContain("Barbearia Norte");
    expect(html).toContain(`font-size: ${tamanhoDoNome(BASE.nome)}px`);
  });

  it("é deitada na proporção do cartão de conversa", () => {
    const html = htmlPrevia(BASE);
    expect(html).toContain(`width: ${PREVIA_LARGURA}px; height: ${PREVIA_ALTURA}px`);
    expect(PREVIA_LARGURA).toBeGreaterThan(PREVIA_ALTURA);
  });

  it("mostra o topo do site pela captura recebida", () => {
    expect(htmlPrevia({ ...BASE, src: "./lead-previa-topo.png" })).toContain(
      'src="./lead-previa-topo.png"',
    );
  });

  it("escapa o nome — ele vem do cadastro do lead, não do nosso código", () => {
    const html = htmlPrevia({ ...BASE, nome: '<img src=x onerror="alert(1)">' });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("a janela exibe o endereço real quando ele existe, e nada quando não", () => {
    expect(htmlPrevia({ ...BASE, endereco: "https://radar.exemplo.com/demo/abc" })).toContain(
      "radar.exemplo.com",
    );
    expect(htmlPrevia(BASE)).not.toMatch(/https?:\/\/[a-z]/i);
  });

  it("sem linha de apoio, não sobra bloco vazio embaixo do nome", () => {
    expect(htmlPrevia(BASE)).not.toContain('class="apoio"');
    expect(htmlPrevia({ ...BASE, apoio: "Corte e barba com hora marcada." })).toContain(
      'class="apoio"',
    );
  });
});
