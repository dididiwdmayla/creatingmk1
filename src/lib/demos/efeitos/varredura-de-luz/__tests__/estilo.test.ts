import { describe, expect, it } from "vitest";

import { estiloVarredura } from "../estilo";

describe("estiloVarredura", () => {
  it("prefers-reduced-motion cai no estático: sem @keyframes ligado, mesmo ativo", () => {
    expect(estiloVarredura(2, true, true).animationName).toBe("none");
  });

  it("sem reduced motion, anima; pausa via animationPlayState (nunca desliga o keyframe)", () => {
    expect(estiloVarredura(2, false, true).animationPlayState).toBe("running");
    expect(estiloVarredura(2, false, false).animationPlayState).toBe("paused");
    expect(estiloVarredura(2, false, true).animationName).toBe("d-efeito-varredura-sweep");
  });

  it("largura, opacidade e velocidade do ciclo escalam com a intensidade", () => {
    expect(estiloVarredura(1, false, true).larguraPercent).toBeLessThan(
      estiloVarredura(3, false, true).larguraPercent,
    );
    expect(estiloVarredura(1, false, true).opacidade).toBeLessThan(
      estiloVarredura(3, false, true).opacidade,
    );
    // intensidade maior = ciclo mais rápido (duração menor)
    expect(estiloVarredura(3, false, true).duracaoSegundos).toBeLessThan(
      estiloVarredura(1, false, true).duracaoSegundos,
    );
  });

  it("respeita o teto de 6% — o feixe passa POR CIMA do título hero", () => {
    for (const i of [1, 2, 3] as const) {
      expect(estiloVarredura(i, false, true).opacidade).toBeLessThanOrEqual(0.06);
    }
  });
});
