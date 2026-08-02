import { describe, expect, it } from "vitest";

import { opacidadeBase, opacidadePulso, veiosTracos } from "../geometria";

describe("veiosTracos", () => {
  it("contagem escala com a intensidade e é determinística (sem Math.random)", () => {
    expect(veiosTracos(1).length).toBeLessThan(veiosTracos(2).length);
    expect(veiosTracos(2).length).toBeLessThan(veiosTracos(3).length);
    expect(veiosTracos(2)).toEqual(veiosTracos(2));
  });

  it("cada traço é uma FITA fechada (M…L…Z), nunca um stroke aberto", () => {
    for (const traco of veiosTracos(3)) {
      expect(traco.d.startsWith("M ")).toBe(true);
      expect(traco.d.endsWith(" Z")).toBe(true);
      // Só M/L/Z: nenhuma curva de comando (a curvatura já está amostrada
      // no contorno) e, principalmente, nenhum resquício de `stroke`.
      expect(traco.d.match(/[A-Za-z]/g)?.every((c) => "MLZ".includes(c))).toBe(true);
      expect(traco.duracaoSegundos).toBeGreaterThan(0);
    }
  });

  it("as pontas do traço são distintas — o veio vai a algum lugar", () => {
    for (const traco of veiosTracos(3)) {
      expect(Math.hypot(traco.ate.x - traco.de.x, traco.ate.y - traco.de.y)).toBeGreaterThan(30);
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

  it("o pulso é mais aceso que a base, mas ambos respeitam o teto de 6%", () => {
    for (const i of [1, 2, 3] as const) {
      expect(opacidadeBase(i)).toBeLessThan(opacidadePulso(i));
      expect(opacidadePulso(i)).toBeLessThanOrEqual(0.06);
    }
  });
});
