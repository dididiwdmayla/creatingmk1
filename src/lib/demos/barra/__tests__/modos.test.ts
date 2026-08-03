import { describe, expect, it } from "vitest";

import {
  amostraDaBarra,
  barraCorValida,
  barraModoValido,
  corDaBarraPaleta,
} from "../modos";
import type { BarraCorValor } from "../../types";

const PALETA = { fundo: "#1a1411", fundoAlt: "#221b17", destaque: "#c9a227" };

describe("barraModoValido", () => {
  it("aceita só os quatro modos do contrato", () => {
    expect(barraModoValido("automatico")).toBe(true);
    expect(barraModoValido("personalizada")).toBe(true);
    expect(barraModoValido("tema")).toBe(false); // o nome do OUTRO controle
    expect(barraModoValido(undefined)).toBe(false);
  });
});

describe("barraCorValida", () => {
  it("`automatico` é representado pela AUSÊNCIA (o default nunca é persistido)", () => {
    expect(barraCorValida({ modo: "automatico" })).toBeUndefined();
    expect(barraCorValida(undefined)).toBeUndefined();
  });

  it("modo desconhecido cai em automático em vez de quebrar", () => {
    expect(barraCorValida({ modo: "roxo" } as unknown as BarraCorValor)).toBeUndefined();
  });

  it("`personalizada` sem hex válido não é um modo — cai em automático", () => {
    expect(barraCorValida({ modo: "personalizada" })).toBeUndefined();
    expect(barraCorValida({ modo: "personalizada", cor: "vermelho" })).toBeUndefined();
    expect(barraCorValida({ modo: "personalizada", cor: "#0af" })).toEqual({
      modo: "personalizada",
      cor: "#0af",
    });
  });

  it("modos derivados do tema descartam a cor pendurada", () => {
    // Sobra de quando o usuário passou por "personalizada" e voltou: o
    // valor persistido não pode carregar uma cor que ninguém mais lê.
    expect(barraCorValida({ modo: "fundo", cor: "#ff0000" })).toEqual({ modo: "fundo" });
  });
});

describe("corDaBarraPaleta", () => {
  it("automático parte do plano da página (é a cor do HTML do servidor)", () => {
    expect(corDaBarraPaleta(PALETA, undefined)).toBe(PALETA.fundo);
    expect(corDaBarraPaleta(PALETA, { modo: "automatico" })).toBe(PALETA.fundo);
  });

  it("os modos fixos entregam a cor pedida", () => {
    expect(corDaBarraPaleta(PALETA, { modo: "fundo" })).toBe(PALETA.fundo);
    expect(corDaBarraPaleta(PALETA, { modo: "destaque" })).toBe(PALETA.destaque);
    expect(corDaBarraPaleta(PALETA, { modo: "personalizada", cor: "#123456" })).toBe("#123456");
  });

  it("valor inválido nunca deixa a barra sem cor", () => {
    expect(corDaBarraPaleta(PALETA, { modo: "personalizada" })).toBe(PALETA.fundo);
  });
});

describe("amostraDaBarra", () => {
  it("modo fixo mostra UMA cor", () => {
    expect(amostraDaBarra(PALETA, { modo: "destaque" })).toEqual({
      cores: [PALETA.destaque],
      acompanha: false,
    });
  });

  it("automático mostra as duas cores por onde a barra passa", () => {
    expect(amostraDaBarra(PALETA, undefined)).toEqual({
      cores: [PALETA.fundo, PALETA.fundoAlt],
      acompanha: true,
    });
  });

  it("paleta com fundo e fundoAlt iguais mostra UMA cor — sem fingir variação", () => {
    const chapada = { ...PALETA, fundoAlt: PALETA.fundo };
    expect(amostraDaBarra(chapada, undefined)).toEqual({
      cores: [PALETA.fundo],
      acompanha: true,
    });
  });
});
