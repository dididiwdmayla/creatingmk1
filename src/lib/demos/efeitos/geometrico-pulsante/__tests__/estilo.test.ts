import { describe, expect, it } from "vitest";

import { camadasGeometricoPulsante, opacidadeGeometricoPulsante } from "../estilo";

describe("camadasGeometricoPulsante", () => {
  it("contagem de camadas escala com a intensidade e é determinística", () => {
    expect(camadasGeometricoPulsante(1).length).toBeLessThan(camadasGeometricoPulsante(2).length);
    expect(camadasGeometricoPulsante(2).length).toBeLessThan(camadasGeometricoPulsante(3).length);
    expect(camadasGeometricoPulsante(2)).toEqual(camadasGeometricoPulsante(2));
  });

  it("cada camada tem 6 pontos (hexágono)", () => {
    for (const camada of camadasGeometricoPulsante(3)) {
      expect(camada.points.split(" ")).toHaveLength(6);
    }
  });

  it("atraso escalonado (defasado) e nunca positivo", () => {
    const camadas = camadasGeometricoPulsante(3);
    for (const camada of camadas) {
      expect(camada.atrasoSegundos).toBeLessThanOrEqual(0);
    }
    const atrasos = camadas.map((c) => c.atrasoSegundos);
    expect(new Set(atrasos).size).toBe(atrasos.length);
  });
});

describe("opacidadeGeometricoPulsante", () => {
  it("escala com a intensidade", () => {
    expect(opacidadeGeometricoPulsante(1)).toBeLessThan(opacidadeGeometricoPulsante(2));
    expect(opacidadeGeometricoPulsante(2)).toBeLessThan(opacidadeGeometricoPulsante(3));
  });
});
