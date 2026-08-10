import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/errors";
import { CHAVE_GENERICAS } from "../types";
import { validarAlvoRotacao, validarConjuntoPatch } from "../validar";

function problemas(fn: () => void): string[] {
  try {
    fn();
  } catch (error) {
    if (error instanceof ValidationError) return error.problemas;
    throw error;
  }
  return [];
}

describe("validarConjuntoPatch", () => {
  it("aceita um nicho com três frases", () => {
    expect(problemas(() => validarConjuntoPatch({ nicho: "dentista", frases: ["a", "b", "c"] }))).toEqual([]);
  });

  it("aceita o conjunto genérico (nicho null) e slots vazios", () => {
    expect(problemas(() => validarConjuntoPatch({ nicho: null, frases: ["", "", ""] }))).toEqual([]);
  });

  it("rejeita chave desconhecida (pega typo em vez de ignorar)", () => {
    expect(problemas(() => validarConjuntoPatch({ nicho: "a", frases: [], indice: 2 }))).toContain(
      "chave desconhecida: indice",
    );
  });

  it("rejeita nicho vazio — o genérico se pede com null", () => {
    expect(problemas(() => validarConjuntoPatch({ nicho: "  ", frases: [] })).length).toBe(1);
  });

  it("rejeita o nicho que colidiria com o doc do conjunto genérico", () => {
    const encontrados = problemas(() =>
      validarConjuntoPatch({ nicho: CHAVE_GENERICAS, frases: [] }),
    );

    expect(encontrados[0]).toContain("reservado");
  });

  it("rejeita mais de três frases e frase longa demais", () => {
    expect(problemas(() => validarConjuntoPatch({ nicho: "a", frases: ["", "", "", ""] }))).toContain(
      "frases deve ter no máximo 3 itens",
    );
    expect(
      problemas(() => validarConjuntoPatch({ nicho: "a", frases: ["x".repeat(1001)] })),
    ).toContain("frases[0] deve ter no máximo 1000 caracteres");
  });

  it("rejeita corpo que não é objeto", () => {
    expect(problemas(() => validarConjuntoPatch("oi"))).toEqual(["corpo deve ser um objeto JSON"]);
  });
});

describe("validarAlvoRotacao", () => {
  it("aceita nicho e null", () => {
    expect(problemas(() => validarAlvoRotacao({ nicho: "dentista" }))).toEqual([]);
    expect(problemas(() => validarAlvoRotacao({ nicho: null }))).toEqual([]);
  });

  it("rejeita nicho não-string e vazio", () => {
    expect(problemas(() => validarAlvoRotacao({ nicho: 7 })).length).toBe(1);
    expect(problemas(() => validarAlvoRotacao({ nicho: " " })).length).toBe(1);
  });
});
