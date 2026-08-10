import { describe, expect, it } from "vitest";

import { estadoTraducao, montarTraducao, slotsATraduzir, textoDoSlot } from "../traducao";
import type { FrasesProspeccao } from "../types";

const EM = "2026-08-01T00:00:00.000Z";

function conjunto(
  frases: string[],
  traduzidas?: string[],
  origem?: string[],
): Pick<FrasesProspeccao, "frases" | "traducoes"> {
  return {
    frases,
    ...(traduzidas && {
      traducoes: { "es-AR": { frases: traduzidas, origem: origem ?? frases, em: EM } },
    }),
  };
}

describe("estadoTraducao", () => {
  it("pt-BR é nativa — não há o que traduzir", () => {
    expect(estadoTraducao(conjunto(["Oi"]), "pt-BR", 0)).toBe("nativa");
  });

  it("sem tradução daquele idioma, é ausente", () => {
    expect(estadoTraducao(conjunto(["Oi"]), "es-AR", 0)).toBe("ausente");
  });

  it("traduzido a partir do texto atual, é aplicada", () => {
    expect(estadoTraducao(conjunto(["Oi"], ["Hola"]), "es-AR", 0)).toBe("aplicada");
  });

  it("português editado depois, é desatualizada", () => {
    expect(estadoTraducao(conjunto(["Oi, mudei"], ["Hola"], ["Oi"]), "es-AR", 0)).toBe(
      "desatualizada",
    );
  });

  it("diferença só de espaço não invalida a tradução", () => {
    expect(estadoTraducao(conjunto([" Oi "], ["Hola"], ["Oi"]), "es-AR", 0)).toBe("aplicada");
  });

  it("slot sem tradução dentro de um idioma já traduzido é ausente", () => {
    expect(estadoTraducao(conjunto(["Oi", "Olá"], ["Hola", ""]), "es-AR", 1)).toBe("ausente");
  });

  it("cada idioma é independente", () => {
    expect(estadoTraducao(conjunto(["Oi"], ["Hola"]), "en-US", 0)).toBe("ausente");
  });
});

describe("textoDoSlot", () => {
  it("manda a tradução quando ela está aplicada", () => {
    expect(textoDoSlot(conjunto(["Oi {nome}"], ["Hola {nome}"]), "es-AR", 0)).toBe("Hola {nome}");
  });

  it("manda o português quando não há tradução", () => {
    expect(textoDoSlot(conjunto(["Oi {nome}"]), "es-AR", 0)).toBe("Oi {nome}");
  });

  it("tradução desatualizada NÃO é enviada — o português vence", () => {
    expect(textoDoSlot(conjunto(["Oi, mudei"], ["Hola"], ["Oi"]), "es-AR", 0)).toBe("Oi, mudei");
  });

  it("lead brasileiro nunca vê tradução, mesmo com uma gravada", () => {
    expect(textoDoSlot(conjunto(["Oi"], ["Hola"]), "pt-BR", 0)).toBe("Oi");
  });
});

describe("montarTraducao", () => {
  it("guarda a origem junto, e slot vazio continua vazio", () => {
    const traducao = montarTraducao(["Oi", "", "Tchau"], ["Hola", "lixo", "Chau"], EM);

    expect(traducao).toEqual({
      frases: ["Hola", "", "Chau"],
      origem: ["Oi", "", "Tchau"],
      em: EM,
    });
  });
});

describe("slotsATraduzir", () => {
  it("são os slots preenchidos, pelo índice do campo", () => {
    expect(slotsATraduzir({ frases: ["a", "  ", "c"] })).toEqual([0, 2]);
    expect(slotsATraduzir({ frases: ["", "", ""] })).toEqual([]);
  });
});
