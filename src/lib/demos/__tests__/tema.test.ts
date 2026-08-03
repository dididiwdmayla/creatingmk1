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

  it("intro liga/desliga por cima do preset (default ligada)", () => {
    expect(PRESET.intro).toBe(true);
    expect(aplicarTema(PRESET, { intro: false }).intro).toBe(false);
    expect(aplicarTema(PRESET, {}).intro).toBe(true);
  });

  it("hover/clique/fundoEfeito sobrescrevem; valores fora do menu caem no preset", () => {
    const tema = aplicarTema(PRESET, {
      hover: "brilho",
      clique: "pressao",
      fundoEfeito: "particulas",
    });
    expect(tema.hover).toBe("brilho");
    expect(tema.clique).toBe("pressao");
    expect(tema.fundoEfeito).toBe("particulas");

    const sujo = aplicarTema(PRESET, {
      hover: "girar" as never,
      fundoEfeito: "chuva" as never,
    });
    expect(sujo.hover).toBe(PRESET.hover);
    expect(sujo.fundoEfeito).toBe(PRESET.fundoEfeito);
  });
});

describe("aplicarTema — heroTitulo e led", () => {
  it("sem patch de heroTitulo, mantém o do preset", () => {
    const tema = aplicarTema(PRESET, {});
    expect(tema.heroTitulo).toEqual(PRESET.heroTitulo);
    expect(tema.led).toBe(PRESET.led);
  });

  it("fonte do heroTitulo vem da lista curada (papel display); id desconhecido ignora", () => {
    const tema = aplicarTema(PRESET, { heroTitulo: { fonte: "playfair" } });
    expect(tema.heroTitulo.fonte).toContain("--font-demo-playfair");

    const ignorado = aplicarTema(PRESET, { heroTitulo: { fonte: "nao-existe" } });
    expect(ignorado.heroTitulo.fonte).toBe(PRESET.heroTitulo.fonte);
  });

  it("escala é recortada pelos limites da skin", () => {
    const limites = { min: 0.8, max: 1.2 };
    expect(aplicarTema(PRESET, { heroTitulo: { escala: 1.05 } }, limites).heroTitulo.escala).toBe(
      1.05,
    );
    expect(aplicarTema(PRESET, { heroTitulo: { escala: 5 } }, limites).heroTitulo.escala).toBe(
      1.2,
    );
    expect(aplicarTema(PRESET, { heroTitulo: { escala: -1 } }, limites).heroTitulo.escala).toBe(
      0.8,
    );
  });

  it("alinhamento do heroTitulo sobrescreve; valor fora do menu cai no preset", () => {
    expect(aplicarTema(PRESET, { heroTitulo: { alinhamento: "direita" } }).heroTitulo.alinhamento).toBe(
      "direita",
    );
    expect(
      aplicarTema(PRESET, { heroTitulo: { alinhamento: "no-meio" as never } }).heroTitulo
        .alinhamento,
    ).toBe(PRESET.heroTitulo.alinhamento);
  });

  it("led sobrescreve o preset; valor fora do menu cai no preset", () => {
    expect(aplicarTema(PRESET, { led: "marcante" }).led).toBe("marcante");
    expect(aplicarTema(PRESET, { led: "piscando" as never }).led).toBe(PRESET.led);
  });

  it("modos de cor do efeito e do LED passam pro tema; 'tema'/desconhecido não deixam sobra", () => {
    const tema = aplicarTema(PRESET, {
      efeitoCores: { modo: "transicao", cores: ["#ff0000", "#00ff00"] },
      ledCores: { modo: "iridescente" },
    });
    expect(tema.efeitoCores).toEqual({ modo: "transicao", cores: ["#ff0000", "#00ff00"] });
    expect(tema.ledCores).toEqual({ modo: "iridescente" });

    // "tema" é o default: some do Theme em vez de virar um objeto vazio
    // circulando pelo postMessage do preview.
    expect(aplicarTema(PRESET, { efeitoCores: { modo: "tema" } }).efeitoCores).toBeUndefined();
    expect(
      aplicarTema(PRESET, { ledCores: { modo: "neon" as never } }).ledCores,
    ).toBeUndefined();
    expect(aplicarTema(PRESET, {}).efeitoCores).toBeUndefined();
  });
});

describe("inkPara", () => {
  it("preto sobre cor clara, branco sobre cor escura", () => {
    expect(inkPara("#ffffff")).toBe("#111111");
    expect(inkPara("#000000")).toBe("#ffffff");
    expect(inkPara("#B8862D")).toBe("#111111"); // dourado da skin
  });
});
