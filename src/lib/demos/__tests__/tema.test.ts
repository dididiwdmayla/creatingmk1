import { describe, expect, it } from "vitest";

import { DEFAULT_SKIN } from "../registry";
import { TEMA_RAIOS, aplicarTema, inkPara } from "../tema";

const PRESET = DEFAULT_SKIN.themeDefault;

describe("aplicarTema", () => {
  it("sem patch devolve o próprio preset", () => {
    expect(aplicarTema(PRESET, undefined)).toBe(PRESET);
  });

  it("patch vazio não muda nada relevante", () => {
    const tema = aplicarTema(PRESET, {});
    expect(tema.paleta).toEqual(PRESET.paleta);
    expect(tema.fontes).toEqual(PRESET.fontes);
    expect(tema.raio).toBe(PRESET.raio);
    expect(tema.densidade).toBe(PRESET.densidade);
  });

  it("destaque custom troca a cor e recalcula o ink por contraste", () => {
    const claro = aplicarTema(PRESET, { destaque: "#f5e9c9" });
    expect(claro.paleta.destaque).toBe("#f5e9c9");
    expect(claro.paleta.destaqueInk).toBe("#111111");

    const escuro = aplicarTema(PRESET, { destaque: "#1a237e" });
    expect(escuro.paleta.destaqueInk).toBe("#ffffff");
  });

  it("hex inválido é ignorado (preset preservado)", () => {
    const tema = aplicarTema(PRESET, { destaque: "vermelho" });
    expect(tema.paleta).toEqual(PRESET.paleta);
  });

  it("fontes da lista curada substituem display/corpo; id desconhecido é ignorado", () => {
    const tema = aplicarTema(PRESET, { fonteDisplay: "playfair", fonteCorpo: "lora" });
    expect(tema.fontes.display).toContain("--font-demo-playfair");
    expect(tema.fontes.corpo).toContain("--font-demo-lora");
    // Demais papéis intocados.
    expect(tema.fontes.mono).toBe(PRESET.fontes.mono);

    const ignorado = aplicarTema(PRESET, { fonteDisplay: "comic-sans" });
    expect(ignorado.fontes.display).toBe(PRESET.fontes.display);
  });

  it("raio só aceita valores do menu; densidade sobrescreve", () => {
    expect(aplicarTema(PRESET, { raio: "12px" }).raio).toBe("12px");
    expect(aplicarTema(PRESET, { raio: "37px" }).raio).toBe(PRESET.raio);
    expect(aplicarTema(PRESET, { densidade: "arejada" }).densidade).toBe("arejada");
  });

  it("animacao sobrescreve o preset; sem patch mantém o default", () => {
    expect(aplicarTema(PRESET, { animacao: "nenhuma" }).animacao).toBe("nenhuma");
    expect(aplicarTema(PRESET, {}).animacao).toBe(PRESET.animacao);
  });

  it("TEMA_RAIOS cobre do reto ao bem arredondado", () => {
    expect(TEMA_RAIOS).toContain("0px");
    expect(TEMA_RAIOS.length).toBeGreaterThanOrEqual(4);
  });
});

describe("inkPara", () => {
  it("preto sobre cor clara, branco sobre cor escura", () => {
    expect(inkPara("#ffffff")).toBe("#111111");
    expect(inkPara("#000000")).toBe("#ffffff");
    expect(inkPara("#B8862D")).toBe("#111111"); // dourado da skin
  });
});
