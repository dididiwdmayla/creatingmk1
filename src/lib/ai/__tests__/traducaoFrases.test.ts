import { describe, expect, it } from "vitest";

import { montarPromptTraducao, validarTraducao } from "../traducaoFrases";

describe("montarPromptTraducao", () => {
  it("pede a VARIANTE REGIONAL, não o idioma genérico", () => {
    const prompt = montarPromptTraducao(["Oi {nome}"], "es-AR");

    expect(prompt).toContain("espanhol (Argentina)");
    expect(prompt).toContain("es-AR");
    expect(prompt).toContain("VARIANTE REGIONAL");
  });

  it("proíbe mexer nos marcadores e numera as frases na ordem", () => {
    const prompt = montarPromptTraducao(["Oi {nome}", "Veja {demo}"], "en-GB");

    expect(prompt).toContain("{nome}, {demo}, {penetracao}");
    expect(prompt).toContain("1. Oi {nome}");
    expect(prompt).toContain("2. Veja {demo}");
  });
});

describe("validarTraducao", () => {
  it("aceita a mesma quantidade com os marcadores intactos", () => {
    const { frases, problemas } = validarTraducao(
      { frases: ["Hola {nome}", "Mirá {demo}"] },
      ["Oi {nome}", "Veja {demo}"],
    );

    expect(problemas).toEqual([]);
    expect(frases).toEqual(["Hola {nome}", "Mirá {demo}"]);
  });

  it("rejeita quantidade diferente", () => {
    expect(validarTraducao({ frases: ["Hola"] }, ["Oi", "Tchau"]).problemas).toEqual([
      "frases deve ser uma lista de 2 textos",
    ]);
  });

  it("rejeita marcador perdido na tradução — isso quebraria o link da demo", () => {
    const { frases, problemas } = validarTraducao({ frases: ["Mirá el sitio"] }, ["Veja {demo}"]);

    expect(frases).toBeUndefined();
    expect(problemas[0]).toContain("{demo}");
  });

  it("rejeita marcador traduzido por dentro", () => {
    expect(validarTraducao({ frases: ["Hola {nombre}"] }, ["Oi {nome}"]).problemas).toHaveLength(1);
  });

  it("rejeita frase vazia", () => {
    expect(validarTraducao({ frases: ["  "] }, ["Oi"]).problemas).toEqual(["frases[0] veio vazia"]);
  });

  it("rejeita resposta sem a lista", () => {
    expect(validarTraducao({ outra: "coisa" }, ["Oi"]).problemas).toHaveLength(1);
    expect(validarTraducao(undefined, ["Oi"]).problemas).toHaveLength(1);
  });
});
