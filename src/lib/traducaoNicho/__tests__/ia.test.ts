import { describe, expect, it } from "vitest";

import { montarPromptTermoLocal, schemaTermoLocal, validarTermoLocal } from "../ia";

describe("montarPromptTermoLocal", () => {
  it("inclui o nicho original e o idioma-alvo (rótulo em português)", () => {
    const prompt = montarPromptTermoLocal("barbearia", "en-US");

    expect(prompt).toContain('"barbearia"');
    expect(prompt).toContain("inglês");
  });

  it("idioma desconhecido cai no próprio código (idiomaLabel)", () => {
    const prompt = montarPromptTermoLocal("dentista", "ja-JP");
    expect(prompt).toContain("ja-JP");
  });
});

describe("schemaTermoLocal", () => {
  it("exige só o campo termo", () => {
    const schema = schemaTermoLocal() as { required: string[]; properties: Record<string, unknown> };
    expect(schema.required).toEqual(["termo"]);
    expect(Object.keys(schema.properties)).toEqual(["termo"]);
  });
});

describe("validarTermoLocal", () => {
  it("aceita resposta com termo não vazio (trim aplicado)", () => {
    const resultado = validarTermoLocal({ termo: "  barbershop  " });
    expect(resultado.problemas).toEqual([]);
    expect(resultado.termo).toBe("barbershop");
  });

  it("recorta termo longo em vez de rejeitar", () => {
    const resultado = validarTermoLocal({ termo: "x".repeat(200) });
    expect(resultado.problemas).toEqual([]);
    expect(resultado.termo).toHaveLength(60);
  });

  it("rejeita termo vazio, chave desconhecida e resposta que não é objeto", () => {
    expect(validarTermoLocal({ termo: "" }).problemas).toContain("termo deve ser string não vazia");
    expect(validarTermoLocal({ termo: "x", extra: 1 }).problemas).toContain(
      "chave desconhecida: extra",
    );
    expect(validarTermoLocal("nada").problemas).toEqual(["resposta deve ser um objeto JSON"]);
  });
});
