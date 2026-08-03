import { describe, expect, it } from "vitest";

import { faixasPintadas, type SuperficieMedida } from "../fundo";

const ALT = { r: 0x22, g: 0x1b, b: 0x17 };
const BASE = { r: 0x1a, g: 0x14, b: 0x11 };
const VERDE = { r: 0x2c, g: 0x35, b: 0x24 };
const L = 390;
const A = 800;

/** Uma superfície full-bleed cobrindo a seção inteira. */
function cheia(profundidade: number, cor?: SuperficieMedida["cor"]): SuperficieMedida {
  return { profundidade, topo: 0, base: A, largura: L, cor };
}

describe("faixasPintadas", () => {
  it("acha a cor no <section>, mesmo com wrappers transparentes por cima", () => {
    // O caso comum das 8 skins: SecaoMarcada (div crua) → SectionReveal
    // (motion.div) → <section class="bg-[var(--d-bg-alt)]">.
    expect(faixasPintadas([cheia(0), cheia(1), cheia(2, ALT)], L)).toEqual([
      { topo: 0, base: A, cor: ALT },
    ]);
  });

  it("seção sem fundo próprio não pinta faixa nenhuma", () => {
    expect(faixasPintadas([cheia(0), cheia(1)], L)).toEqual([]);
    expect(faixasPintadas([], L)).toEqual([]);
  });

  it("um CARD colorido dentro da seção não é fundo", () => {
    const card: SuperficieMedida = { profundidade: 3, topo: 100, base: 400, largura: L * 0.3, cor: ALT };
    expect(faixasPintadas([cheia(1, BASE), card], L)).toEqual([{ topo: 0, base: A, cor: BASE }]);
  });

  it("um PAINEL quase da largura da seção não conta (o caso do petshop)", () => {
    // 358px numa seção de 390 = 91,8%. Com a regra antiga ("≥90% da
    // largura") este painel arredondado com o LARANJA do destaque virava
    // o fundo de uma seção creme — a barra do celular ficava laranja no
    // meio da página. Achado pelo laço, comparando barra e pixel da tela.
    const painel: SuperficieMedida = { profundidade: 3, topo: 30, base: A - 30, largura: L * 0.918, cor: ALT };
    expect(faixasPintadas([cheia(1, BASE), painel], L)).toEqual([{ topo: 0, base: A, cor: BASE }]);
  });

  it("um BLOB decorativo MAIS LARGO que a seção não conta (o outro caso do petshop)", () => {
    // Círculo de 560px transbordando uma seção de 390: passa folgado em
    // largura mínima justamente por ser decorativo. Quem o barra é o TETO
    // de largura — fundo de verdade tem a largura da caixa.
    const blob: SuperficieMedida = { profundidade: 3, topo: 60, base: 620, largura: L * 1.44, cor: ALT };
    expect(faixasPintadas([blob], L)).toEqual([]);
  });

  it("um bloco full-bleed DENTRO da seção recorta a faixa de fora", () => {
    // O rodapé da imobiliária: <footer> creme de 1510px com um bloco
    // verde-escuro de 901px dentro, mais alto que a tela de um celular.
    // Uma cor por seção deixava a barra creme durante toda a travessia
    // do verde — o contrário do que a feature promete.
    const bloco: SuperficieMedida = { profundidade: 2, topo: 609, base: A, largura: L, cor: VERDE };
    expect(faixasPintadas([cheia(1, BASE), bloco], L)).toEqual([
      { topo: 0, base: 609, cor: BASE },
      { topo: 609, base: A, cor: VERDE },
    ]);
  });

  it("um bloco no MEIO parte a faixa de fora em duas", () => {
    const meio: SuperficieMedida = { profundidade: 2, topo: 300, base: 500, largura: L, cor: VERDE };
    expect(faixasPintadas([cheia(1, BASE), meio], L)).toEqual([
      { topo: 0, base: 300, cor: BASE },
      { topo: 300, base: 500, cor: VERDE },
      { topo: 500, base: A, cor: BASE },
    ]);
  });

  it("a mais PROFUNDA pinta por cima, venha na ordem que vier", () => {
    expect(faixasPintadas([cheia(2, ALT), cheia(1, BASE)], L)).toEqual([
      { topo: 0, base: A, cor: ALT },
    ]);
  });

  it("empate de profundidade: o último na ordem do documento pinta por cima", () => {
    expect(faixasPintadas([cheia(2, BASE), cheia(2, ALT)], L)).toEqual([
      { topo: 0, base: A, cor: ALT },
    ]);
  });

  it("seção sem largura não devolve faixa (evita divisão por zero na regra)", () => {
    expect(faixasPintadas([cheia(0, ALT)], 0)).toEqual([]);
  });
});
