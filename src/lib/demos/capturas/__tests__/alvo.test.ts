import { describe, expect, it } from "vitest";

import {
  COLECAO_AVULSAS,
  COLECAO_LEADS,
  caminhoApiDoAlvo,
  caminhoPublicoDoAlvo,
  formatAlvo,
  parseAlvo,
} from "../alvo.mjs";

/**
 * O formato do alvo atravessa quatro processos que não se falam (rota do
 * Radar → repository_dispatch → orquestrador → motor) numa lista de
 * strings separada por vírgula. Se as pontas discordarem do prefixo, a
 * captura vai pro doc errado — ou pra nenhum. Daí este arquivo.
 */
describe("parseAlvo", () => {
  it("id cru é uma demo de lead", () => {
    expect(parseAlvo("ChIJabc")).toEqual({
      id: "ChIJabc",
      avulsa: false,
      colecao: COLECAO_LEADS,
    });
  });

  it("prefixo `avulsa:` aponta pra coleção de avulsas", () => {
    expect(parseAlvo("avulsa:uuid-1")).toEqual({
      id: "uuid-1",
      avulsa: true,
      colecao: COLECAO_AVULSAS,
    });
  });

  it("ignora espaço em volta", () => {
    expect(parseAlvo("  avulsa:uuid-1  ")?.id).toBe("uuid-1");
    expect(parseAlvo("  ChIJabc ")?.id).toBe("ChIJabc");
  });

  it("alvo vazio, só prefixo ou não-string é inválido", () => {
    for (const invalido of ["", "   ", "avulsa:", "avulsa:   ", undefined, null, 42]) {
      expect(parseAlvo(invalido as never), String(invalido)).toBeUndefined();
    }
  });

  it("um Place ID com dois-pontos no meio continua sendo lead", () => {
    expect(parseAlvo("ChIJ:abc")?.avulsa).toBe(false);
  });
});

describe("formatAlvo", () => {
  it("é o inverso de parseAlvo nos dois casos", () => {
    for (const [id, avulsa] of [
      ["ChIJabc", false],
      ["uuid-1", true],
    ] as const) {
      const alvo = formatAlvo(id, avulsa);
      expect(parseAlvo(alvo)).toMatchObject({ id, avulsa });
    }
  });

  it("lead é o default (é como todo alvo já gravado se parece)", () => {
    expect(formatAlvo("ChIJabc")).toBe("ChIJabc");
  });
});

describe("caminhos do alvo", () => {
  it("rota pública de cada família", () => {
    expect(caminhoPublicoDoAlvo("ChIJabc")).toBe("/demo/ChIJabc");
    expect(caminhoPublicoDoAlvo("avulsa:uuid-1")).toBe("/demo/avulsa/uuid-1");
  });

  it("rota de leitura de cada família", () => {
    expect(caminhoApiDoAlvo("ChIJabc")).toBe("/api/leads/ChIJabc");
    expect(caminhoApiDoAlvo("avulsa:uuid-1")).toBe("/api/demos-avulsas/uuid-1");
  });

  it("escapa o id na URL", () => {
    expect(caminhoPublicoDoAlvo("a b")).toBe("/demo/a%20b");
    expect(caminhoApiDoAlvo("avulsa:a b")).toBe("/api/demos-avulsas/a%20b");
  });

  it("alvo inválido não vira caminho", () => {
    expect(caminhoPublicoDoAlvo("")).toBeUndefined();
    expect(caminhoApiDoAlvo("avulsa:")).toBeUndefined();
  });
});
