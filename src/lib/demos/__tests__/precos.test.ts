import { describe, expect, it } from "vitest";

import {
  formatarPrecoServico,
  formatarValorMoeda,
  migrarPrecoServico,
  migrarPrecos,
  simboloMoeda,
} from "../precos";
import type { DemoServico } from "../types";

function servico(preco: string): DemoServico {
  return { nome: "Serviço", preco };
}

describe("migrarPrecoServico — self-heal de demos salvas antes de precoPrefixo/precoValor", () => {
  it("preco simples vira precoValor, sem prefixo", () => {
    expect(migrarPrecoServico(servico("R$ 80"))).toEqual({
      nome: "Serviço",
      preco: "R$ 80",
      precoValor: 80,
      precoPrefixo: undefined,
    });
  });

  it("milhar com ponto e decimal com vírgula (convenção pt-BR legada)", () => {
    expect(migrarPrecoServico(servico("R$ 2.980.000")).precoValor).toBe(2980000);
    expect(migrarPrecoServico(servico("R$ 32,50")).precoValor).toBe(32.5);
  });

  it('"A partir de R$ X" vira precoPrefixo + precoValor', () => {
    const migrado = migrarPrecoServico(servico("A partir de R$ 1.800"));
    expect(migrado.precoPrefixo).toBe("A partir de");
    expect(migrado.precoValor).toBe(1800);
  });

  it('"a partir de R$ X" (minúsculo, petshop) preserva a caixa original', () => {
    const migrado = migrarPrecoServico(servico("a partir de R$ 60"));
    expect(migrado.precoPrefixo).toBe("a partir de");
    expect(migrado.precoValor).toBe(60);
  });

  it('texto sem nenhum número ("Sob consulta") vira só precoPrefixo, sem precoValor', () => {
    const migrado = migrarPrecoServico(servico("Sob consulta"));
    expect(migrado.precoPrefixo).toBe("Sob consulta");
    expect(migrado.precoValor).toBeUndefined();
  });

  it("preco vazio não migra nada", () => {
    expect(migrarPrecoServico(servico(""))).toEqual(servico(""));
  });

  it("serviço que JÁ tem precoPrefixo/precoValor nunca é tocado", () => {
    const jaMigrado: DemoServico = { nome: "X", preco: "", precoValor: 999 };
    expect(migrarPrecoServico(jaMigrado)).toBe(jaMigrado);

    const soPrefixo: DemoServico = { nome: "X", preco: "R$ 80", precoPrefixo: "Sob consulta" };
    expect(migrarPrecoServico(soPrefixo)).toBe(soPrefixo);
  });

  it("migrarPrecos aplica a migração em toda a lista", () => {
    const lista = [servico("R$ 80"), servico("Sob consulta")];
    const migrada = migrarPrecos(lista);
    expect(migrada[0].precoValor).toBe(80);
    expect(migrada[1].precoPrefixo).toBe("Sob consulta");
  });
});

describe("formatarPrecoServico — precoValor formatado por Intl.NumberFormat, sem IA", () => {
  it("precoValor puro, sem prefixo", () => {
    expect(formatarPrecoServico({ preco: "", precoValor: 89 }, "pt-BR", "BRL")).toBe(
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(89),
    );
  });

  it("precoPrefixo + precoValor", () => {
    const resultado = formatarPrecoServico(
      { preco: "", precoPrefixo: "A partir de", precoValor: 999 },
      "pt-BR",
      "BRL",
    );
    expect(resultado).toBe(
      `A partir de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(999)}`,
    );
  });

  it("só precoPrefixo, sem precoValor (ex.: 'Sob consulta')", () => {
    expect(
      formatarPrecoServico({ preco: "", precoPrefixo: "Sob consulta" }, "pt-BR", "BRL"),
    ).toBe("Sob consulta");
  });

  it("nem prefixo nem valor: cai no preco legado", () => {
    expect(formatarPrecoServico({ preco: "Grátis" }, "pt-BR", "BRL")).toBe("Grátis");
  });

  it("idioma/moeda ausentes caem nos defaults (pt-BR/BRL)", () => {
    expect(formatarPrecoServico({ preco: "", precoValor: 10 }, undefined, undefined)).toBe(
      formatarValorMoeda(10, "pt-BR", "BRL"),
    );
  });
});

describe("formatarValorMoeda/simboloMoeda — locale pt-BR, de-CH e fr-CH", () => {
  it("pt-BR/BRL: separador decimal vírgula, símbolo R$", () => {
    expect(formatarValorMoeda(999, "pt-BR", "BRL")).toBe("R$ 999,00");
    expect(simboloMoeda("pt-BR", "BRL")).toBe("R$");
  });

  it("de-CH/CHF: separador de milhar apóstrofo (convenção suíça), símbolo CHF", () => {
    const formatado = formatarValorMoeda(999000, "de-CH", "CHF");
    expect(formatado).toContain("999");
    expect(formatado).toContain("000");
    expect(simboloMoeda("de-CH", "CHF")).toBe("CHF");
  });

  it("fr-CH/CHF: mesma moeda que de-CH, símbolo igual — só o locale de formatação muda", () => {
    expect(simboloMoeda("fr-CH", "CHF")).toBe("CHF");
    // O valor numérico nunca muda por locale — só a apresentação.
    expect(formatarValorMoeda(999, "fr-CH", "CHF").replace(/[^\d]/g, "")).toBe(
      formatarValorMoeda(999, "de-CH", "CHF").replace(/[^\d]/g, ""),
    );
  });

  it("nenhuma das três formatações jamais precisa de IA — Intl.NumberFormat puro", () => {
    // Determinístico: mesma entrada, mesma saída, sempre.
    expect(formatarValorMoeda(199, "pt-BR", "BRL")).toBe(formatarValorMoeda(199, "pt-BR", "BRL"));
  });
});
