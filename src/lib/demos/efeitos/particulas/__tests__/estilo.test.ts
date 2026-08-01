import { describe, expect, it } from "vitest";

import { estiloPonto, opacidadeContainer, pontosParticulas } from "../estilo";

describe("estiloPonto", () => {
  it("prefers-reduced-motion cai no estático: sem @keyframes ligado, mesmo ativo", () => {
    expect(estiloPonto(true, true).animationName).toBe("none");
  });

  it("sem reduced motion, anima; pausa via animationPlayState", () => {
    expect(estiloPonto(false, true)).toEqual({
      animationName: "d-efeito-particulas-flutua",
      animationPlayState: "running",
    });
    expect(estiloPonto(false, false)).toEqual({
      animationName: "d-efeito-particulas-flutua",
      animationPlayState: "paused",
    });
  });
});

describe("pontosParticulas", () => {
  it("contagem escala com a intensidade e posições são determinísticas", () => {
    expect(pontosParticulas(1).length).toBeLessThan(pontosParticulas(2).length);
    expect(pontosParticulas(2).length).toBeLessThan(pontosParticulas(3).length);
    expect(pontosParticulas(2)).toEqual(pontosParticulas(2)); // sem Math.random
  });
});

describe("opacidadeContainer", () => {
  it("escala com a intensidade", () => {
    expect(opacidadeContainer(1)).toBeLessThan(opacidadeContainer(2));
    expect(opacidadeContainer(2)).toBeLessThan(opacidadeContainer(3));
  });
});
