import { describe, expect, it } from "vitest";

import { pontosParticulas } from "../../particulas/estilo";
import { faiscas, opacidadeContainer } from "../estilo";

describe("faiscas", () => {
  it("contagem escala com a intensidade e é determinística", () => {
    expect(faiscas(1).length).toBeLessThan(faiscas(2).length);
    expect(faiscas(2).length).toBeLessThan(faiscas(3).length);
    expect(faiscas(2)).toEqual(faiscas(2));
  });

  it("reaproveita as posições do motor de partículas (mesmo `left` dos primeiros pontos)", () => {
    const base = pontosParticulas(2);
    const geradas = faiscas(2);
    for (let i = 0; i < geradas.length; i++) {
      expect(geradas[i].left).toBe(base[i].left);
    }
  });

  it("vida curta: bem menor que a duração de particulas (14-23s)", () => {
    for (const f of faiscas(3)) {
      expect(f.duracaoSegundos).toBeLessThan(2);
      expect(f.duracaoSegundos).toBeGreaterThan(0);
    }
  });
});

describe("opacidadeContainer", () => {
  it("escala com a intensidade", () => {
    expect(opacidadeContainer(1)).toBeLessThan(opacidadeContainer(2));
    expect(opacidadeContainer(2)).toBeLessThan(opacidadeContainer(3));
  });
});
