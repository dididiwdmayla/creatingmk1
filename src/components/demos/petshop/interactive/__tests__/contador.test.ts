import { describe, expect, it } from "vitest";

import { formatarContador, parseContador } from "../contador";

describe("parseContador", () => {
  it("extrai prefixo, alvo inteiro e sufixo (ex.: '+3.000 pets')", () => {
    const p = parseContador("+3.000");
    expect(p).toEqual({ prefixo: "+", alvo: 3000, casasDecimais: 0, sufixo: "" });
  });

  it("extrai casas decimais com vírgula pt-BR e sufixo (ex.: '4,9★')", () => {
    const p = parseContador("4,9★");
    expect(p).toEqual({ prefixo: "", alvo: 4.9, casasDecimais: 1, sufixo: "★" });
  });

  it("número simples sem prefixo/sufixo", () => {
    expect(parseContador("12")).toEqual({ prefixo: "", alvo: 12, casasDecimais: 0, sufixo: "" });
  });

  it("undefined quando não há número reconhecível", () => {
    expect(parseContador("sem número aqui")).toBeUndefined();
  });
});

describe("formatarContador", () => {
  it("formata inteiro com separador de milhar pt-BR e prefixo", () => {
    const p = parseContador("+3.000")!;
    expect(formatarContador(3000, p)).toBe("+3.000");
    expect(formatarContador(1500, p)).toBe("+1.500");
  });

  it("formata decimal com vírgula e sufixo", () => {
    const p = parseContador("4,9★")!;
    expect(formatarContador(4.9, p)).toBe("4,9★");
    expect(formatarContador(2.34, p)).toBe("2,3★");
  });
});
