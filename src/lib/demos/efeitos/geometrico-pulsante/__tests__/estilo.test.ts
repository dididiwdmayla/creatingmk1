import { describe, expect, it } from "vitest";

import { arcosGeometricoPulsante, opacidadeGeometricoPulsante } from "../estilo";

describe("arcosGeometricoPulsante", () => {
  it("contagem escala com a intensidade e é determinística", () => {
    expect(arcosGeometricoPulsante(1).length).toBeLessThan(arcosGeometricoPulsante(2).length);
    expect(arcosGeometricoPulsante(2).length).toBeLessThan(arcosGeometricoPulsante(3).length);
    expect(arcosGeometricoPulsante(2)).toEqual(arcosGeometricoPulsante(2));
  });

  it("cada arco é uma fita FECHADA (path que termina em Z), nunca um stroke aberto", () => {
    for (const arco of arcosGeometricoPulsante(3)) {
      expect(arco.d.startsWith("M ")).toBe(true);
      expect(arco.d.endsWith(" Z")).toBe(true);
      expect(arco.d).not.toMatch(/[^MLZ\d\s.,-]/);
    }
  });

  it("nenhum arco fecha sobre si mesmo — é arco, não anel", () => {
    for (const arco of arcosGeometricoPulsante(3)) {
      const distancia = Math.hypot(arco.ate.x - arco.de.x, arco.ate.y - arco.de.y);
      expect(distancia).toBeGreaterThan(3);
    }
  });

  it("atraso escalonado, sempre negativo e nunca repetido (pulso defasado)", () => {
    const arcos = arcosGeometricoPulsante(3);
    for (const arco of arcos) expect(arco.atrasoSegundos).toBeLessThan(0);
    const atrasos = arcos.map((a) => a.atrasoSegundos);
    expect(new Set(atrasos).size).toBe(atrasos.length);
  });
});

describe("opacidadeGeometricoPulsante", () => {
  it("escala com a intensidade", () => {
    expect(opacidadeGeometricoPulsante(1)).toBeLessThan(opacidadeGeometricoPulsante(2));
    expect(opacidadeGeometricoPulsante(2)).toBeLessThan(opacidadeGeometricoPulsante(3));
  });

  it("respeita o teto de 6% de opacidade para forma geométrica", () => {
    for (const i of [1, 2, 3] as const) {
      expect(opacidadeGeometricoPulsante(i)).toBeLessThanOrEqual(0.06);
    }
  });
});
