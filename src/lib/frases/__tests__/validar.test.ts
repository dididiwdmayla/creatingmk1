import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/errors";
import { validarAlvoRotacao, validarConjuntoPatch } from "../validar";

const SKIN = "barbearia-editorial";

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
  it("aceita uma skin do registro com três frases", () => {
    expect(problemas(() => validarConjuntoPatch({ skinId: SKIN, frases: ["a", "b", "c"] }))).toEqual(
      [],
    );
  });

  it("aceita slots vazios (é assim que a skin sai da rotação)", () => {
    expect(problemas(() => validarConjuntoPatch({ skinId: SKIN, frases: ["", "", ""] }))).toEqual([]);
  });

  it("rejeita chave desconhecida (pega typo em vez de ignorar)", () => {
    expect(
      problemas(() => validarConjuntoPatch({ skinId: SKIN, frases: [], indice: 2 })),
    ).toContain("chave desconhecida: indice");
  });

  it("rejeita skinId que não é skin do registro — nada de chave por texto livre", () => {
    expect(problemas(() => validarConjuntoPatch({ skinId: "barbearia", frases: [] }))).toEqual([
      'skinId "barbearia" não é uma skin do registro',
    ]);
    expect(problemas(() => validarConjuntoPatch({ skinId: "  ", frases: [] })).length).toBe(1);
    expect(problemas(() => validarConjuntoPatch({ frases: [] })).length).toBe(1);
  });

  it("rejeita mais de três frases e frase longa demais", () => {
    expect(
      problemas(() => validarConjuntoPatch({ skinId: SKIN, frases: ["", "", "", ""] })),
    ).toContain("frases deve ter no máximo 3 itens");
    expect(
      problemas(() => validarConjuntoPatch({ skinId: SKIN, frases: ["x".repeat(1001)] })),
    ).toContain("frases[0] deve ter no máximo 1000 caracteres");
  });

  it("rejeita corpo que não é objeto", () => {
    expect(problemas(() => validarConjuntoPatch("oi"))).toEqual(["corpo deve ser um objeto JSON"]);
  });
});

describe("validarAlvoRotacao", () => {
  it("aceita uma skin do registro", () => {
    expect(problemas(() => validarAlvoRotacao({ skinId: SKIN }))).toEqual([]);
  });

  it("rejeita skin fora do registro, vazia ou não-string", () => {
    expect(problemas(() => validarAlvoRotacao({ skinId: "petshop" })).length).toBe(1);
    expect(problemas(() => validarAlvoRotacao({ skinId: 7 })).length).toBe(1);
    expect(problemas(() => validarAlvoRotacao({ skinId: " " })).length).toBe(1);
  });
});
