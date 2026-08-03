import { describe, expect, it } from "vitest";

import { corEmFoco, type FaixaCor } from "../foco";
import { corHex, type Rgb } from "../srgb";

const H = 700;
const BASE: Rgb = { r: 0x1a, g: 0x14, b: 0x11 }; // paleta.fundo
const ALT: Rgb = { r: 0xf5, g: 0xf0, b: 0xe8 }; // paleta.fundoAlt (claro, pra a rampa ficar legível)

/** A cor resultante como hex — comparar bytes evita ruído de ponto flutuante. */
function hex(faixas: FaixaCor[]): string {
  return corHex(corEmFoco(faixas, H, BASE));
}

/** Duas faixas empilhadas, com a fronteira a `y` px do topo da viewport. */
function fronteira(y: number): FaixaCor[] {
  return [
    { topo: -5000, base: y, cor: BASE },
    { topo: y, base: 5000, cor: ALT },
  ];
}

describe("corEmFoco", () => {
  it("uma faixa dominando a tela devolve a cor DELA", () => {
    expect(hex([{ topo: -100, base: 900, cor: ALT }])).toBe(corHex(ALT));
  });

  it("faixa sem cor vale o plano da página", () => {
    expect(hex([{ topo: -100, base: 900 }])).toBe(corHex(BASE));
  });

  it("sem faixa pintada na viewport, a barra é o plano da página", () => {
    // Cabeçalho/rodapé: o peso que sobra é todo da base. Sem isso a barra
    // congelaria na cor da última faixa até o fim da página.
    expect(hex([])).toBe(corHex(BASE));
    expect(hex([{ topo: 900, base: 1200, cor: ALT }])).toBe(corHex(BASE));
  });

  it("a troca é uma RAMPA, nunca um degrau: monótona e longa", () => {
    // Este é o requisito do produto ("nunca troca seca") escrito como
    // teste. Duas propriedades, medidas varrendo a fronteira pela tela em
    // passos de 1px: a cor nunca volta, e ir de 5% a 95% do caminho custa
    // uma distância de ROLAGEM de verdade — não um punhado de pixels.
    const amostras: number[] = [];
    for (let y = H; y >= 0; y--) amostras.push(corEmFoco(fronteira(y), H, BASE).r);
    for (let i = 1; i < amostras.length; i++) {
      expect(amostras[i]).toBeGreaterThanOrEqual(amostras[i - 1]);
    }
    expect(amostras[0]).toBeCloseTo(BASE.r, 0);
    expect(amostras[amostras.length - 1]).toBeCloseTo(ALT.r, 0);

    const span = ALT.r - BASE.r;
    const inicio = amostras.findIndex((v) => v > BASE.r + span * 0.05);
    const fim = amostras.findIndex((v) => v > BASE.r + span * 0.95);
    // Meia viewport é 350px aqui, e o miolo de 5–95% mede 220px deles: as
    // pontas da rampa são de propósito quase planas (o núcleo vale zero
    // nas bordas da banda), e a mistura em luz linear não é simétrica em
    // bytes. O piso abaixo é a garantia de que a troca custa rolagem de
    // verdade, não um punhado de pixels.
    expect(fim - inicio).toBeGreaterThan(200);
  });

  it("a rampa ocupa MEIA VIEWPORT, centrada — o mesmo núcleo da cobertura", () => {
    // Fora da banda de foco (o quarto de cima e o quarto de baixo da
    // tela) a fronteira não move a cor: as duas leis de transição da
    // página (barra e camada decorativa) são a MESMA, calibrada uma vez.
    expect(corHex(corEmFoco(fronteira(H * 0.76), H, BASE))).toBe(
      corHex(corEmFoco(fronteira(H), H, BASE)),
    );
    expect(corHex(corEmFoco(fronteira(H * 0.24), H, BASE))).toBe(
      corHex(corEmFoco(fronteira(0), H, BASE)),
    );
    // No centro exato, meio a meio.
    const meio = corEmFoco(fronteira(H / 2), H, BASE);
    expect(meio.r).toBeGreaterThan(BASE.r);
    expect(meio.r).toBeLessThan(ALT.r);
  });

  it("é função da POSIÇÃO, não do tempo: rolar de volta desfaz pelo mesmo caminho", () => {
    // Descer até o meio da rampa e voltar tem que devolver a MESMA cor de
    // antes — é o que separa esta transição de uma animação com estado.
    const descendo = [H * 0.7, H * 0.6, H * 0.5, H * 0.4].map((y) => hex(fronteira(y)));
    const subindo = [H * 0.4, H * 0.5, H * 0.6, H * 0.7].map((y) => hex(fronteira(y)));
    expect(subindo).toEqual([...descendo].reverse());
  });

  it("viewport de altura zero não quebra (devolve o plano da página)", () => {
    expect(corHex(corEmFoco(fronteira(0), 0, BASE))).toBe(corHex(BASE));
  });
});
