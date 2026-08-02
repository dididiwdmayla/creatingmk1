import { describe, expect, it } from "vitest";

import { estiloGradiente } from "../estilo";

describe("estiloGradiente", () => {
  it("prefers-reduced-motion cai no estático: sem @keyframes ligado, mesmo ativo", () => {
    const estatico = estiloGradiente(2, true, true);
    expect(estatico.animationName).toBe("none");
  });

  it("sem reduced motion, anima; pausa via animationPlayState (nunca desliga o keyframe)", () => {
    const rodando = estiloGradiente(2, false, true);
    expect(rodando.animationName).toBe("d-efeito-gradiente-drift");
    expect(rodando.animationPlayState).toBe("running");

    const pausado = estiloGradiente(2, false, false);
    expect(pausado.animationName).toBe("d-efeito-gradiente-drift");
    expect(pausado.animationPlayState).toBe("paused");
  });

  it("opacidade escala com a intensidade", () => {
    const o1 = estiloGradiente(1, false, true).opacity;
    const o2 = estiloGradiente(2, false, true).opacity;
    const o3 = estiloGradiente(3, false, true).opacity;
    expect(o1).toBeLessThan(o2);
    expect(o2).toBeLessThan(o3);
  });

  it("respeita o teto de 6% — o efeito pinta POR CIMA do conteúdo", () => {
    for (const i of [1, 2, 3] as const) {
      expect(estiloGradiente(i, false, true).opacity).toBeLessThanOrEqual(0.06);
    }
  });

  it("filter (blur) nunca muda com intensidade/estado — nunca é a propriedade animada", () => {
    expect(estiloGradiente(1, false, true).filter).toBe(estiloGradiente(3, true, false).filter);
  });
});
