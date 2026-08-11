import { describe, expect, it } from "vitest";

import { idiomaDoPais } from "@/lib/idioma";
import {
  bandeiraDoPais,
  DEFAULT_PAISES_PROSPECCAO,
  normalizarPais,
  validarPaisesProspeccao,
  type PaisProspeccao,
} from "../paises";

function problemasDe(valor: unknown): string[] {
  const problemas: string[] = [];
  validarPaisesProspeccao(valor, "paisesProspeccao", problemas);
  return problemas;
}

const PAIS_OK: PaisProspeccao = {
  codigo: "PT",
  nome: "Portugal",
  utcOffsetMinutos: 0,
  idiomas: ["pt-PT"],
  indice: 1.6,
};

describe("DEFAULT_PAISES_PROSPECCAO", () => {
  it("traz os 15 países onde o WhatsApp é canal comercial — sem EUA e Canadá", () => {
    const nomes = DEFAULT_PAISES_PROSPECCAO.map((p) => p.nome);
    expect(nomes).toEqual([
      "Brasil",
      "Portugal",
      "Espanha",
      "Itália",
      "Suíça",
      "México",
      "Colômbia",
      "Argentina",
      "Chile",
      "Peru",
      "Uruguai",
      "Paraguai",
      "Bolívia",
      "Equador",
      "Costa Rica",
    ]);
    expect(nomes).not.toContain("Estados Unidos");
    expect(nomes).not.toContain("Canadá");
  });

  it("o default é válido pela própria validação", () => {
    expect(problemasDe(DEFAULT_PAISES_PROSPECCAO)).toEqual([]);
  });

  it("fuso e idioma saem dos mapas que já existem — sem tabela paralela", () => {
    const argentina = DEFAULT_PAISES_PROSPECCAO.find((p) => p.nome === "Argentina");
    expect(argentina?.utcOffsetMinutos).toBe(-180);
    expect(argentina?.idiomas).toEqual([idiomaDoPais("Argentina")]);
  });

  it("Suíça é o único caso multi-idioma: alemão manda, francês e italiano vêm junto", () => {
    const suica = DEFAULT_PAISES_PROSPECCAO.find((p) => p.nome === "Suíça");
    expect(suica?.idiomas).toEqual(["de-CH", "fr-CH", "it-CH"]);
    // O nome do país é a chave que casa com o endereço do lead (pt-BR).
    expect(normalizarPais("  SUÍÇA ")).toBe(normalizarPais(suica!.nome));
  });
});

describe("bandeiraDoPais", () => {
  it("monta a bandeira a partir do código ISO", () => {
    expect(bandeiraDoPais("BR")).toBe("🇧🇷");
    expect(bandeiraDoPais("pt")).toBe("🇵🇹");
  });
});

describe("validarPaisesProspeccao", () => {
  it("aceita uma lista bem formada", () => {
    expect(problemasDe([PAIS_OK])).toEqual([]);
  });

  it("recusa o que não é lista", () => {
    expect(problemasDe({ PT: PAIS_OK })).toEqual([
      "paisesProspeccao deve ser uma lista de países",
    ]);
  });

  it("recusa código fora do ISO alpha-2", () => {
    expect(problemasDe([{ ...PAIS_OK, codigo: "por" }])).toEqual([
      expect.stringContaining("paisesProspeccao[0].codigo"),
    ]);
  });

  it("recusa campo desconhecido (typo não passa calado)", () => {
    expect(problemasDe([{ ...PAIS_OK, fuso: -180 }])).toEqual([
      "paisesProspeccao[0].fuso não é um campo conhecido",
    ]);
  });

  it("recusa fuso impossível e índice ≤ 0", () => {
    expect(problemasDe([{ ...PAIS_OK, utcOffsetMinutos: 5_000, indice: 0 }])).toHaveLength(2);
  });

  it("recusa idioma fora do BCP-47 e lista de idiomas vazia", () => {
    expect(problemasDe([{ ...PAIS_OK, idiomas: [] }])).toHaveLength(1);
    expect(problemasDe([{ ...PAIS_OK, idiomas: ["portugues"] }])).toEqual([
      expect.stringContaining("paisesProspeccao[0].idiomas[0]"),
    ]);
  });

  it("recusa país repetido — a tela mostraria a linha (e os leads) em dobro", () => {
    expect(problemasDe([PAIS_OK, { ...PAIS_OK, codigo: "PT", nome: "portugal" }])).toEqual([
      expect.stringContaining("aparece mais de uma vez"),
    ]);
  });
});
