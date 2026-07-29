import { describe, expect, it } from "vitest";

import {
  calcularIndiceEfetivo,
  calcularPrecoSugerido,
  converterMoedaLocal,
  multiplicadorParaNicho,
} from "../calc";

describe("calcularIndiceEfetivo", () => {
  it("indiceAjustado vence o gerado quando presente", () => {
    expect(calcularIndiceEfetivo(1.5, 0.9, 0.7)).toBe(0.9);
  });

  it("sem ajustado, usa o gerado", () => {
    expect(calcularIndiceEfetivo(1.5, undefined, 0.7)).toBe(1.5);
  });

  it("fator mínimo: região barata reduz no máximo (1 - fatorMinimo)", () => {
    expect(calcularIndiceEfetivo(0.3, undefined, 0.7)).toBe(0.7);
    expect(calcularIndiceEfetivo(0.3, 0.2, 0.7)).toBe(0.7);
  });

  it("região cara (índice > 1) sobe sem teto", () => {
    expect(calcularIndiceEfetivo(3.2, undefined, 0.7)).toBe(3.2);
  });
});

describe("calcularPrecoSugerido", () => {
  it("multiplica base × índice efetivo × multiplicador do nicho", () => {
    expect(calcularPrecoSugerido(2000, 1.2, 1.5, 900)).toBe(3600);
  });

  it("piso: nunca abaixo do valor configurado (default R$900)", () => {
    expect(calcularPrecoSugerido(700, 0.7, 1, 900)).toBe(900);
  });

  it("acima do piso, o bruto vale como está", () => {
    expect(calcularPrecoSugerido(1000, 1, 1, 900)).toBe(1000);
  });
});

describe("multiplicadorParaNicho", () => {
  it("nicho sem multiplicador configurado → default 1.0", () => {
    expect(multiplicadorParaNicho("dentista", {})).toBe(1);
    expect(multiplicadorParaNicho("dentista", { barbearia: 1.3 })).toBe(1);
  });

  it("casa por nicho normalizado (case/espaços)", () => {
    expect(multiplicadorParaNicho("  Dentista  ", { dentista: 1.4 })).toBe(1.4);
    expect(multiplicadorParaNicho("dentista", { "Dentista ": 1.4 })).toBe(1.4);
  });
});

describe("converterMoedaLocal", () => {
  it("converte BRL → moeda local via o câmbio aproximado", () => {
    expect(converterMoedaLocal(3600, 6)).toBe(600);
  });

  it("câmbio ausente → undefined (mostra só BRL)", () => {
    expect(converterMoedaLocal(3600, undefined)).toBeUndefined();
  });

  it("câmbio zero ou negativo (dado sujo) → undefined", () => {
    expect(converterMoedaLocal(3600, 0)).toBeUndefined();
    expect(converterMoedaLocal(3600, -1)).toBeUndefined();
  });
});
