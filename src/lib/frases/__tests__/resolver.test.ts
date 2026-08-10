import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import {
  conjuntoDoNicho,
  nichoDoLead,
  resolverMensagem,
  rotuloOrigem,
} from "../resolver";
import type { FrasesProspeccao } from "../types";

function conjunto(nicho: string, frases: string[], indice = 0): FrasesProspeccao {
  return { nicho, frases, indice };
}

function lead(extra: Partial<Lead> = {}): Pick<Lead, "busca" | "buscaId" | "demo"> {
  return {
    busca: { nicho: "dentista", regiao: "Sarandi PR", em: "2026-08-01T00:00:00.000Z" },
    buscaId: ["b1"],
    ...extra,
  } as Pick<Lead, "busca" | "buscaId" | "demo">;
}

const BUSCAS = [{ id: "b1", mensagemPadrao: "Mensagem do grupo" }];
const GLOBAL = "Mensagem global";

describe("nichoDoLead", () => {
  it("usa o nicho da busca que originou o lead", () => {
    expect(nichoDoLead(lead())).toBe("dentista");
  });

  it("a skin da demo só desempata quando o nicho da busca está vazio", () => {
    const semNicho = lead({
      busca: { nicho: "  ", regiao: "x", em: "2026-08-01T00:00:00.000Z" },
      demo: { skinId: "petshop-focinho-feliz" } as Lead["demo"],
    });

    expect(nichoDoLead(semNicho)).toBe("petshop");
  });

  it("com nicho na busca, a skin não interfere", () => {
    const comAmbos = lead({ demo: { skinId: "petshop-focinho-feliz" } as Lead["demo"] });

    expect(nichoDoLead(comAmbos)).toBe("dentista");
  });

  it("sem busca e sem demo, não há nicho", () => {
    expect(nichoDoLead({ busca: undefined, demo: undefined })).toBeUndefined();
  });
});

describe("conjuntoDoNicho", () => {
  it("casa ignorando caixa e espaços", () => {
    const achado = conjuntoDoNicho("  DENTISTA ", [conjunto("Dentista", ["a"])]);

    expect(achado?.nicho).toBe("Dentista");
  });
});

describe("precedência: nicho → genéricas → grupo → global", () => {
  it("1º as frases do nicho", () => {
    const resolvida = resolverMensagem({
      lead: lead(),
      buscas: BUSCAS,
      conjuntos: [conjunto("dentista", ["N1", "N2", "N3"], 1)],
      genericas: conjunto("", ["G1"]),
      global: GLOBAL,
    });

    expect(resolvida).toEqual({
      texto: "N2",
      origem: "nicho",
      rotacao: { nicho: "dentista", posicao: 2, total: 3 },
    });
  });

  it("2º as genéricas, quando o nicho não tem nenhuma frase preenchida", () => {
    const resolvida = resolverMensagem({
      lead: lead(),
      buscas: BUSCAS,
      conjuntos: [conjunto("dentista", ["", "", ""])],
      genericas: conjunto("", ["G1", "G2"], 1),
      global: GLOBAL,
    });

    expect(resolvida).toEqual({
      texto: "G2",
      origem: "genericas",
      rotacao: { nicho: null, posicao: 2, total: 2 },
    });
  });

  it("2º as genéricas também quando o nicho não tem conjunto nenhum", () => {
    const resolvida = resolverMensagem({
      lead: lead(),
      buscas: BUSCAS,
      conjuntos: [],
      genericas: conjunto("", ["G1"]),
      global: GLOBAL,
    });

    expect(resolvida.origem).toBe("genericas");
  });

  it("3º a mensagem do grupo, quando nicho e genéricas estão vazios", () => {
    const resolvida = resolverMensagem({
      lead: lead(),
      buscas: BUSCAS,
      conjuntos: [conjunto("dentista", ["", "", ""])],
      genericas: conjunto("", ["", "", ""]),
      global: GLOBAL,
    });

    expect(resolvida).toEqual({ texto: "Mensagem do grupo", origem: "grupo" });
  });

  it("4º a global — e ela continua sendo o último caso", () => {
    const resolvida = resolverMensagem({
      lead: lead({ buscaId: [] }),
      buscas: BUSCAS,
      conjuntos: [],
      genericas: undefined,
      global: GLOBAL,
    });

    expect(resolvida).toEqual({ texto: GLOBAL, origem: "global" });
  });

  it("sem nenhuma frase cadastrada, o comportamento antigo é idêntico", () => {
    const semFrases = { conjuntos: [], genericas: undefined, global: GLOBAL };

    expect(resolverMensagem({ lead: lead(), buscas: BUSCAS, ...semFrases }).texto).toBe(
      "Mensagem do grupo",
    );
    expect(
      resolverMensagem({ lead: lead(), buscas: [{ id: "b1" }], ...semFrases }).texto,
    ).toBe(GLOBAL);
  });

  it("entre grupos, vence a busca MAIS RECENTE com mensagem própria", () => {
    const resolvida = resolverMensagem({
      lead: lead({ buscaId: ["b1", "b2"] }),
      buscas: [
        { id: "b1", mensagemPadrao: "antiga" },
        { id: "b2", mensagemPadrao: "recente" },
      ],
      conjuntos: [],
      genericas: undefined,
      global: GLOBAL,
    });

    expect(resolvida.texto).toBe("recente");
  });

  it("lead sem nicho nenhum pula direto para as genéricas", () => {
    const resolvida = resolverMensagem({
      lead: { busca: undefined, buscaId: ["b1"], demo: undefined },
      buscas: BUSCAS,
      conjuntos: [conjunto("dentista", ["N1"])],
      genericas: conjunto("", ["G1"]),
      global: GLOBAL,
    });

    expect(resolvida.origem).toBe("genericas");
  });
});

describe("rotuloOrigem", () => {
  it("diz de onde veio o texto, com a posição na rotação", () => {
    expect(
      rotuloOrigem({
        texto: "x",
        origem: "nicho",
        rotacao: { nicho: "dentista", posicao: 2, total: 3 },
      }),
    ).toBe("frases do nicho — frase 2 de 3");
    expect(rotuloOrigem({ texto: "x", origem: "grupo" })).toBe("mensagem do grupo");
    expect(rotuloOrigem({ texto: "x", origem: "global" })).toBe("mensagem padrão global");
  });
});
