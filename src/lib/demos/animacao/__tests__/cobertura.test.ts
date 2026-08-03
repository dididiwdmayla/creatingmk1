import { describe, expect, it } from "vitest";

import { coberturaAnimada, type FaixaSecao } from "../cobertura";

const H = 700;

/** Duas seções empilhadas, com a fronteira a `y` px do topo da viewport. */
function fronteira(y: number, primeiraAnimada: boolean): FaixaSecao[] {
  return [
    { topo: -5000, base: y, animada: primeiraAnimada },
    { topo: y, base: 5000, animada: !primeiraAnimada },
  ];
}

describe("coberturaAnimada", () => {
  it("tudo animado = 1; nada animado = 0", () => {
    expect(coberturaAnimada([{ topo: -100, base: 900, animada: true }], H)).toBe(1);
    expect(coberturaAnimada([{ topo: -100, base: 900, animada: false }], H)).toBe(0);
  });

  it("sem seção marcada na viewport, mantém o valor anterior (região neutra)", () => {
    // Rodapé/cabeçalho: nada marcado pesando. O efeito segue como estava,
    // em vez de apagar no fim de toda demo.
    expect(coberturaAnimada([], H, 0.42)).toBe(0.42);
    expect(coberturaAnimada([{ topo: 900, base: 1200, animada: false }], H, 1)).toBe(1);
    // Primeira medição de uma página sem marcador nenhum: 1 (o de sempre).
    expect(coberturaAnimada([], H)).toBe(1);
  });

  it("a transição ocupa MEIA VIEWPORT de rolagem, centrada na tela", () => {
    // Fronteira ainda abaixo da banda de foco: a seção que chega não pesa.
    expect(coberturaAnimada(fronteira(H, true), H)).toBe(1);
    expect(coberturaAnimada(fronteira(H * 0.75, true), H)).toBe(1);
    // Fronteira já acima da banda: a seção que chegou domina por completo.
    expect(coberturaAnimada(fronteira(0, true), H)).toBe(0);
    expect(coberturaAnimada(fronteira(H * 0.25, true), H)).toBe(0);
    // No centro da tela, meio a meio.
    expect(coberturaAnimada(fronteira(H / 2, true), H)).toBeCloseTo(0.5, 5);
  });

  it("uma seção de MEIA TELA de altura zera a camada (não trava num meio-termo)", () => {
    // Era o defeito medido no laço com a banda de foco valendo a viewport
    // inteira: o efeito nunca passava de 0.50 apagado sobre uma seção
    // desse tamanho, e por isso o motor nunca chegava a pausar.
    const meia: FaixaSecao[] = [
      { topo: -3000, base: H * 0.25, animada: true },
      { topo: H * 0.25, base: H * 0.75, animada: false },
      { topo: H * 0.75, base: 3000, animada: true },
    ];
    expect(coberturaAnimada(meia, H)).toBe(0);
  });

  it("é monótona e suave — sem salto entre passos vizinhos de scroll", () => {
    const passos = 140;
    const valores = Array.from({ length: passos + 1 }, (_, i) =>
      coberturaAnimada(fronteira((i / passos) * H, true), H),
    );
    let maiorSalto = 0;
    for (let i = 1; i < valores.length; i++) {
      expect(valores[i]).toBeGreaterThanOrEqual(valores[i - 1] - 1e-9); // sobe de 0 a 1
      maiorSalto = Math.max(maiorSalto, valores[i] - valores[i - 1]);
    }
    expect(valores[0]).toBe(0);
    expect(valores[passos]).toBe(1);
    // Um degrau ("aparece de uma vez") daria salto 1. O núcleo cosseno
    // concentra a mudança no meio da banda e vai a zero nas pontas dela.
    expect(maiorSalto).toBeLessThan(0.04);
    // Passo bem no meio da transição vs. passo logo depois de ela começar.
    const passoMeio = valores[passos / 2] - valores[passos / 2 - 1];
    const inicioBanda = Math.round(passos * 0.26);
    const passoInicial = valores[inicioBanda] - valores[inicioBanda - 1];
    expect(passoInicial).toBeLessThan(passoMeio / 10);
  });

  it("vale nos dois sentidos: a seção sem animação chegando apaga igual", () => {
    expect(coberturaAnimada(fronteira(H * 0.65, true), H)).toBeGreaterThan(0.9);
    expect(coberturaAnimada(fronteira(H * 0.35, true), H)).toBeLessThan(0.1);
  });

  it("uma faixa curta demais no meio da tela não zera a camada sozinha", () => {
    // 60px de seção sem animação no meio de uma animada: a camada baixa
    // um pouco, mas não some — o efeito não pisca por causa dela.
    const faixas: FaixaSecao[] = [
      { topo: -300, base: 320, animada: true },
      { topo: 320, base: 380, animada: false },
      { topo: 380, base: 1000, animada: true },
    ];
    const v = coberturaAnimada(faixas, H);
    expect(v).toBeGreaterThan(0.3);
    expect(v).toBeLessThan(0.95);
  });

  it("encosta nos extremos (0/1) em vez de parar em 0.997", () => {
    // Sem isso a camada nunca chegaria ao estado pausado nem sairia dele.
    expect(coberturaAnimada(fronteira(H * 0.745, true), H)).toBe(1);
    expect(coberturaAnimada(fronteira(H * 0.255, true), H)).toBe(0);
  });

  it("viewport de altura zero não divide por zero", () => {
    expect(coberturaAnimada(fronteira(0, true), 0, 0.3)).toBe(0.3);
  });
});
