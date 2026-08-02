import { describe, expect, it } from "vitest";

import { opacidadeBase, opacidadePulso, veiosTracos } from "../geometria";

describe("veiosTracos", () => {
  it("contagem escala com a intensidade e é determinística (sem Math.random)", () => {
    expect(veiosTracos(1).length).toBeLessThan(veiosTracos(2).length);
    expect(veiosTracos(2).length).toBeLessThan(veiosTracos(3).length);
    expect(veiosTracos(2)).toEqual(veiosTracos(2));
  });

  it("cada traço é um path SVG válido (M ... Q ...)", () => {
    for (const traco of veiosTracos(3)) {
      expect(traco.d).toMatch(/^M -?\d+(\.\d+)? -?\d+(\.\d+)? Q -?\d+(\.\d+)? -?\d+(\.\d+)? -?\d+(\.\d+)? -?\d+(\.\d+)?$/);
      expect(traco.duracaoSegundos).toBeGreaterThan(0);
    }
  });
});

describe("opacidadeBase / opacidadePulso", () => {
  it("escalam com a intensidade", () => {
    expect(opacidadeBase(1)).toBeLessThan(opacidadeBase(2));
    expect(opacidadeBase(2)).toBeLessThan(opacidadeBase(3));
    expect(opacidadePulso(1)).toBeLessThan(opacidadePulso(2));
    expect(opacidadePulso(2)).toBeLessThan(opacidadePulso(3));
  });
});
