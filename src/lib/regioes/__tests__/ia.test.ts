import { describe, expect, it } from "vitest";

import {
  montarPromptIndiceRegiao,
  parseCidadePais,
  schemaIndiceRegiao,
  validarIndiceRegiao,
} from "../ia";

describe("parseCidadePais", () => {
  it("cidade, estado, país → cidade = primeira parte, país = última", () => {
    expect(parseCidadePais("Sarandi, PR, Brasil")).toEqual({
      cidade: "Sarandi",
      pais: "Brasil",
    });
  });

  it("cidade, país (sem estado) → cidade = primeira, país = última", () => {
    expect(parseCidadePais("Zürich, Suíça")).toEqual({ cidade: "Zürich", pais: "Suíça" });
  });

  it("uma única parte → cidade e país iguais", () => {
    expect(parseCidadePais("Brasil")).toEqual({ cidade: "Brasil", pais: "Brasil" });
  });

  it("string vazia → tudo vazio", () => {
    expect(parseCidadePais("")).toEqual({ cidade: "", pais: "" });
  });
});

describe("montarPromptIndiceRegiao", () => {
  it("inclui cidade, país e a referência de escala (não a média do país)", () => {
    const prompt = montarPromptIndiceRegiao("Zürich", "Suíça", "Zurique");
    expect(prompt).toContain("Cidade: Zürich");
    expect(prompt).toContain("País: Suíça");
    expect(prompt).toContain("cidade média do interior do Brasil vale índice 1.0");
    expect(prompt).toContain("não a média do país inteiro");
  });
});

describe("schemaIndiceRegiao", () => {
  it("exige os campos centrais e restringe confianca a um enum fixo", () => {
    const schema = schemaIndiceRegiao() as {
      required: string[];
      properties: { confianca: { enum: string[] } };
    };
    expect(schema.required).toEqual(
      expect.arrayContaining(["indice", "moedaLocal", "faixaMercadoLocal", "justificativa", "confianca"]),
    );
    expect(schema.properties.confianca.enum).toEqual(["alta", "media", "baixa"]);
  });
});

function respostaValida(): Record<string, unknown> {
  return {
    indice: 3.2,
    moedaLocal: "CHF",
    cambioAproxBRL: 6.1,
    faixaMercadoLocal: "300–800 CHF",
    justificativa: "Zurique tem alto custo de vida e forte poder aquisitivo.",
    confianca: "alta",
  };
}

describe("validarIndiceRegiao", () => {
  it("aceita resposta dentro do contrato", () => {
    const resultado = validarIndiceRegiao(respostaValida());
    expect(resultado.problemas).toEqual([]);
    expect(resultado.indice).toMatchObject({ indice: 3.2, moedaLocal: "CHF", confianca: "alta" });
  });

  it("aceita sem cambioAproxBRL (moeda local já é o Real)", () => {
    const bruto = respostaValida();
    delete bruto.cambioAproxBRL;
    const resultado = validarIndiceRegiao(bruto);
    expect(resultado.problemas).toEqual([]);
    expect(resultado.indice?.cambioAproxBRL).toBeUndefined();
  });

  it("rejeita indice <= 0, confianca fora do enum e chave desconhecida", () => {
    const bruto = { ...respostaValida(), indice: 0, confianca: "altíssima", extra: 1 };
    const resultado = validarIndiceRegiao(bruto);
    expect(resultado.indice).toBeUndefined();
    expect(resultado.problemas.some((p) => p.includes("indice"))).toBe(true);
    expect(resultado.problemas.some((p) => p.includes("confianca"))).toBe(true);
    expect(resultado.problemas.some((p) => p.includes("chave desconhecida"))).toBe(true);
  });

  it("cambioAproxBRL inválido (<=0) é rejeitado mesmo sendo opcional", () => {
    const resultado = validarIndiceRegiao({ ...respostaValida(), cambioAproxBRL: -1 });
    expect(resultado.indice).toBeUndefined();
  });

  it("recorta textos longos em vez de rejeitar", () => {
    const resultado = validarIndiceRegiao({
      ...respostaValida(),
      justificativa: "x".repeat(1000),
    });
    expect(resultado.problemas).toEqual([]);
    expect(resultado.indice?.justificativa).toHaveLength(400);
  });

  it("resposta que não é objeto → problema dedicado", () => {
    expect(validarIndiceRegiao("nada").problemas).toEqual(["resposta deve ser um objeto JSON"]);
  });
});
