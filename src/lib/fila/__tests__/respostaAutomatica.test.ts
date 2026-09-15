import { describe, expect, it } from "vitest";

import { dentroDaJanelaResposta, sortearAtrasoSegundos } from "../respostaAutomatica";

/**
 * O RITMO HUMANO da resposta automática, puro: o atraso sorteado e a janela
 * de horário do OPERADOR. Os dois testes abaixo são sobre a mesma coisa —
 * uma resposta que chega em dois segundos, ou às quatro da manhã, denuncia a
 * automação antes de qualquer análise do texto.
 */

describe("sortearAtrasoSegundos", () => {
  it("cobre a faixa inteira, extremos inclusive", () => {
    expect(sortearAtrasoSegundos(180, 720, () => 0)).toBe(180);
    // 0.999… ainda cai no último segundo da faixa, nunca fora dela.
    expect(sortearAtrasoSegundos(180, 720, () => 0.999999)).toBe(720);
    expect(sortearAtrasoSegundos(180, 720, () => 0.5)).toBe(450);
  });

  it("nunca sai da faixa, seja qual for o sorteio", () => {
    for (const r of [0, 0.01, 0.25, 0.5, 0.75, 0.999999]) {
      const atraso = sortearAtrasoSegundos(60, 90, () => r);
      expect(atraso).toBeGreaterThanOrEqual(60);
      expect(atraso).toBeLessThanOrEqual(90);
      expect(Number.isInteger(atraso)).toBe(true);
    }
  });

  it("faixa de tamanho zero devolve o próprio valor", () => {
    expect(sortearAtrasoSegundos(300, 300, () => 0.7)).toBe(300);
  });

  it("faixa INVERTIDA usa o maior dos dois como teto, em vez de estourar", () => {
    // O painel salva cada campo no próprio blur: existe um instante em que o
    // mínimo já subiu e o máximo ainda não. Esse instante não pode derrubar
    // a fila às duas da manhã.
    expect(sortearAtrasoSegundos(900, 720, () => 0)).toBe(900);
    expect(sortearAtrasoSegundos(900, 720, () => 0.999999)).toBe(900);
  });

  it("valores negativos ou quebrados não produzem atraso negativo", () => {
    expect(sortearAtrasoSegundos(-30, -10, () => 0)).toBe(0);
    expect(sortearAtrasoSegundos(10.9, 11.9, () => 0)).toBe(10);
  });

  it("sorteia de verdade: duas respostas não saem com o mesmo atraso sempre", () => {
    const valores = new Set(
      Array.from({ length: 50 }, () => sortearAtrasoSegundos(180, 720)),
    );
    // Intervalo sempre igual é tão reconhecível quanto responder na hora.
    expect(valores.size).toBeGreaterThan(1);
  });
});

describe("dentroDaJanelaResposta — o relógio do OPERADOR", () => {
  // Todas as horas abaixo são UTC; São Paulo é UTC-3.
  const sp = (hora: number) =>
    new Date(Date.UTC(2026, 2, 10, (hora + 3) % 24, 30, 0));

  it("faixa normal: início inclusive, fim exclusivo", () => {
    expect(dentroDaJanelaResposta(sp(8), 8, 22)).toBe(true);
    expect(dentroDaJanelaResposta(sp(14), 8, 22)).toBe(true);
    // 22h30 ainda é "22" no relógio; o fim exclusivo é 23h00.
    expect(dentroDaJanelaResposta(sp(21), 8, 22)).toBe(true);
    expect(dentroDaJanelaResposta(sp(22), 8, 22)).toBe(false);
    expect(dentroDaJanelaResposta(sp(23), 8, 22)).toBe(false);
  });

  it("o lead que escreve às 4h da manhã não recebe resposta às 4h03", () => {
    expect(dentroDaJanelaResposta(sp(4), 8, 22)).toBe(false);
    expect(dentroDaJanelaResposta(sp(7), 8, 22)).toBe(false);
  });

  it("mede em São Paulo, não em UTC", () => {
    // 2026-03-10T10:00Z = 7h em São Paulo: ainda fechado numa janela 8–22.
    expect(dentroDaJanelaResposta(new Date("2026-03-10T10:00:00Z"), 8, 22)).toBe(false);
    // Uma hora depois, 8h em São Paulo: aberto.
    expect(dentroDaJanelaResposta(new Date("2026-03-10T11:00:00Z"), 8, 22)).toBe(true);
  });

  it("início igual ao fim é o dia inteiro", () => {
    expect(dentroDaJanelaResposta(sp(3), 0, 0)).toBe(true);
    expect(dentroDaJanelaResposta(sp(15), 9, 9)).toBe(true);
  });

  it("início maior que fim atravessa a meia-noite", () => {
    expect(dentroDaJanelaResposta(sp(23), 22, 6)).toBe(true);
    expect(dentroDaJanelaResposta(sp(2), 22, 6)).toBe(true);
    expect(dentroDaJanelaResposta(sp(6), 22, 6)).toBe(false);
    expect(dentroDaJanelaResposta(sp(12), 22, 6)).toBe(false);
  });

  it("hora fora de 0..23 é grampeada em vez de virar janela vazia", () => {
    expect(dentroDaJanelaResposta(sp(12), -5, 30)).toBe(true);
  });
});
