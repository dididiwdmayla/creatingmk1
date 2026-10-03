import { describe, expect, it } from "vitest";

import { printParaEntrega, vereditoDaMensagem } from "../entrega";
import type { Lead } from "@/lib/leads/types";

/**
 * O veredito sobre o doc FRESCO — o que `/api/fila/proximo` reconfere depois
 * de reservar, e o que a agenda da fila aplica sem reservar nada.
 */

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: "ChIJa",
    nome: "Barbearia A",
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    busca: { nicho: "barbearia", regiao: "Maringá", em: "2026-03-01T00:00:00.000Z" },
    demo: { skinId: "barbearia-editorial" },
    horarios: { faixas: [], utcOffsetMinutes: 0, obtidoEm: "2026-03-01T00:00:00.000Z" },
    capturas: {
      estado: "pronto",
      execucaoId: "exec-1",
      pedidoEm: "2026-03-01T00:00:00.000Z",
      imagens: [
        { ancora: "hero", tela: "celular", ordem: 1, url: "https://storage/hero-cel.png", largura: 780, altura: 1688 },
      ],
    },
    criadoEm: "2026-03-01T00:00:00.000Z",
    atualizadoEm: "2026-03-01T00:00:00.000Z",
    ...overrides,
  } as Lead;
}

describe("printParaEntrega", () => {
  it("lead que ainda serve: o print de celular", () => {
    expect(printParaEntrega(lead(), "2000-01-01")).toBe("https://storage/hero-cel.png");
  });

  it("lead que sumiu, saiu dos critérios estáveis, é legado ou perdeu o print: undefined", () => {
    expect(printParaEntrega(undefined, "2000-01-01")).toBeUndefined();
    expect(printParaEntrega(lead({ status: "contactado" }), "2000-01-01")).toBeUndefined();
    expect(printParaEntrega(lead(), "2026-08-10")).toBeUndefined();
    expect(
      printParaEntrega(lead({ capturas: { estado: "pronto", execucaoId: "e", pedidoEm: "", imagens: [] } }), "2000-01-01"),
    ).toBeUndefined();
  });
});

describe("vereditoDaMensagem", () => {
  it("telefone e texto limpo: sai, com o telefone", () => {
    expect(vereditoDaMensagem({ texto: "Oi Barbearia A", telefone: "5544991543803" })).toEqual({
      telefone: "5544991543803",
    });
  });

  it("sem telefone: barra", () => {
    expect(vereditoDaMensagem({ texto: "Oi", telefone: undefined })).toEqual({ barreira: "sem_telefone" });
  });

  it("marcador sobrando: barra, nomeando o marcador", () => {
    expect(vereditoDaMensagem({ texto: "Veja {demo} e {link}", telefone: "55" })).toEqual({
      barreira: "marcador",
      marcador: "{demo}",
    });
  });
});
