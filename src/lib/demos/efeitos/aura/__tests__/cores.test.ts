import { describe, expect, it } from "vitest";

import type { ThemePaleta } from "@/lib/demos/types";

import { FUMACA_COLORIDA, paletaParaAura, resolverCoresAura } from "../cores";

const PALETA: ThemePaleta = {
  fundo: "#111111",
  fundoAlt: "#1c1c1c",
  fundoElevado: "#242424",
  destaque: "#ff6600",
  destaqueInk: "#111111",
  texto: "#f5f5f5",
  textoSuave: "#bbbbbb",
  borda: "rgba(255,255,255,0.1)",
  acentoSecundario: "#22aaff",
  acentoTerciario: "#88cc00",
};

describe("resolverCoresAura", () => {
  it("sem nada escolhido, deriva inteiramente do tema", () => {
    expect(resolverCoresAura(undefined, PALETA)).toEqual({
      primaria: PALETA.destaque,
      secundaria: PALETA.acentoSecundario,
    });
  });

  it("cada campo cai no tema independentemente quando ausente", () => {
    expect(resolverCoresAura({ primaria: "#abcabc" }, PALETA)).toEqual({
      primaria: "#abcabc",
      secundaria: PALETA.acentoSecundario,
    });
    expect(resolverCoresAura({ secundaria: "#123123" }, PALETA)).toEqual({
      primaria: PALETA.destaque,
      secundaria: "#123123",
    });
  });

  it("as duas cores customizadas vencem o tema", () => {
    expect(resolverCoresAura({ primaria: "#abcabc", secundaria: "#123123" }, PALETA)).toEqual({
      primaria: "#abcabc",
      secundaria: "#123123",
    });
  });

  it('preset "fumaca-colorida" é fixo, independente do tema', () => {
    const resolvido = resolverCoresAura("fumaca-colorida", PALETA);
    expect(resolvido).toEqual(FUMACA_COLORIDA);
    expect(resolvido.primaria).not.toBe(PALETA.destaque);
    expect(resolvido.secundaria).not.toBe(PALETA.acentoSecundario);

    // Independente também de QUALQUER tema — não lê a paleta passada.
    const outraPaleta: ThemePaleta = { ...PALETA, destaque: "#000000", acentoSecundario: "#ffffff" };
    expect(resolverCoresAura("fumaca-colorida", outraPaleta)).toEqual(FUMACA_COLORIDA);
  });
});

describe("paletaParaAura", () => {
  it("sem auraCores, devolve a paleta do tema intacta", () => {
    expect(paletaParaAura(PALETA, undefined)).toEqual(PALETA);
  });

  it("substitui só destaque/acentoSecundario, resto da paleta continua igual", () => {
    const resultado = paletaParaAura(PALETA, "fumaca-colorida");
    expect(resultado.destaque).toBe(FUMACA_COLORIDA.primaria);
    expect(resultado.acentoSecundario).toBe(FUMACA_COLORIDA.secundaria);
    expect(resultado.fundo).toBe(PALETA.fundo);
    expect(resultado.texto).toBe(PALETA.texto);
    expect(resultado.acentoTerciario).toBe(PALETA.acentoTerciario);
  });
});
