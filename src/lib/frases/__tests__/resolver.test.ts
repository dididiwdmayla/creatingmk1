import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { conjuntoDaSkin, resolverMensagem, rotuloOrigem } from "../resolver";
import type { FrasesProspeccao } from "../types";

const BARBEARIA = "barbearia-editorial";
const PETSHOP = "petshop-focinho-feliz";

function conjunto(skinId: string, frases: string[], indice = 0): FrasesProspeccao {
  return { skinId, frases, indice };
}

function lead(extra: Partial<Lead> = {}): Pick<Lead, "buscaId" | "demo"> {
  return {
    buscaId: ["b1"],
    demo: { skinId: BARBEARIA } as Lead["demo"],
    ...extra,
  } as Pick<Lead, "buscaId" | "demo">;
}

const BUSCAS = [{ id: "b1", mensagemPadrao: "Mensagem do grupo" }];
const GLOBAL = "Mensagem global";

describe("conjuntoDaSkin", () => {
  it("casa pelo id da skin da demo", () => {
    const achado = conjuntoDaSkin(BARBEARIA, [conjunto(PETSHOP, ["p"]), conjunto(BARBEARIA, ["b"])]);

    expect(achado?.skinId).toBe(BARBEARIA);
  });

  it("lead sem demo não tem conjunto", () => {
    expect(conjuntoDaSkin(undefined, [conjunto(BARBEARIA, ["b"])])).toBeUndefined();
  });
});

describe("precedência: skin da demo → grupo → global", () => {
  it("1º as frases da skin da demo do lead", () => {
    const resolvida = resolverMensagem({
      lead: lead(),
      buscas: BUSCAS,
      conjuntos: [conjunto(BARBEARIA, ["N1", "N2", "N3"], 1)],
      global: GLOBAL,
    });

    expect(resolvida).toEqual({
      texto: "N2",
      origem: "skin",
      rotacao: { skinId: BARBEARIA, posicao: 2, total: 3, slot: 1 },
    });
  });

  it("skin sem nenhuma frase preenchida não participa: cai no grupo", () => {
    const resolvida = resolverMensagem({
      lead: lead(),
      buscas: BUSCAS,
      conjuntos: [conjunto(BARBEARIA, ["", "", ""])],
      global: GLOBAL,
    });

    expect(resolvida).toEqual({ texto: "Mensagem do grupo", origem: "grupo" });
  });

  it("a frase da skin IRMÃ do mesmo nicho nunca é usada como fallback", () => {
    const resolvida = resolverMensagem({
      lead: lead(),
      buscas: BUSCAS,
      conjuntos: [conjunto("barbearia2-sul", ["da irmã"])],
      global: GLOBAL,
    });

    expect(resolvida.origem).toBe("grupo");
  });

  it("lead SEM demo usa exatamente o que já usava antes das frases", () => {
    const semDemo = lead({ demo: undefined });

    expect(
      resolverMensagem({
        lead: semDemo,
        buscas: BUSCAS,
        conjuntos: [conjunto(BARBEARIA, ["N1", "N2", "N3"])],
        global: GLOBAL,
      }),
    ).toEqual({ texto: "Mensagem do grupo", origem: "grupo" });

    expect(
      resolverMensagem({
        lead: { ...semDemo, buscaId: [] },
        buscas: BUSCAS,
        conjuntos: [conjunto(BARBEARIA, ["N1"])],
        global: GLOBAL,
      }),
    ).toEqual({ texto: GLOBAL, origem: "global" });
  });

  it("ganhar demo troca a frase sozinho: mesma entrada, só o skinId a mais", () => {
    const entrada = {
      buscas: BUSCAS,
      conjuntos: [conjunto(BARBEARIA, ["Frase da barbearia"])],
      global: GLOBAL,
    };

    expect(resolverMensagem({ lead: lead({ demo: undefined }), ...entrada }).origem).toBe("grupo");
    expect(resolverMensagem({ lead: lead(), ...entrada }).texto).toBe("Frase da barbearia");
  });

  it("a global continua sendo o último caso, sempre", () => {
    const resolvida = resolverMensagem({
      lead: lead({ buscaId: [], demo: undefined }),
      buscas: BUSCAS,
      conjuntos: [],
      global: GLOBAL,
    });

    expect(resolvida).toEqual({ texto: GLOBAL, origem: "global" });
  });

  it("entre grupos, vence a busca MAIS RECENTE com mensagem própria", () => {
    const resolvida = resolverMensagem({
      lead: lead({ buscaId: ["b1", "b2"], demo: undefined }),
      buscas: [
        { id: "b1", mensagemPadrao: "antiga" },
        { id: "b2", mensagemPadrao: "recente" },
      ],
      conjuntos: [],
      global: GLOBAL,
    });

    expect(resolvida.texto).toBe("recente");
  });
});

describe("rotuloOrigem", () => {
  it("diz de onde veio o texto, com a posição na rotação", () => {
    expect(
      rotuloOrigem({
        texto: "x",
        origem: "skin",
        rotacao: { skinId: BARBEARIA, posicao: 2, total: 3, slot: 1 },
      }),
    ).toBe("frases da skin — frase 2 de 3");
    expect(rotuloOrigem({ texto: "x", origem: "grupo" })).toBe("mensagem do grupo");
    expect(rotuloOrigem({ texto: "x", origem: "global" })).toBe("mensagem padrão global");
  });
});

describe("tradução do lead estrangeiro", () => {
  const ARGENTINO = { endereco: "Av. Corrientes 1234, Buenos Aires, Argentina" } as Partial<Lead>;

  function comTraducao(frases: string[], traduzidas: string[], origem = frases): FrasesProspeccao {
    return {
      skinId: BARBEARIA,
      frases,
      indice: 0,
      traducoes: { "es-AR": { frases: traduzidas, origem, em: "2026-08-01T00:00:00.000Z" } },
    };
  }

  it("lead do Brasil não fala de tradução nenhuma", () => {
    const resolvida = resolverMensagem({
      lead: lead(),
      buscas: BUSCAS,
      conjuntos: [conjunto(BARBEARIA, ["Oi {nome}"])],
      global: GLOBAL,
    });

    expect(resolvida.traducao).toBeUndefined();
  });

  it("sem tradução gravada, manda o português e pede o botão", () => {
    const resolvida = resolverMensagem({
      lead: lead(ARGENTINO),
      buscas: BUSCAS,
      conjuntos: [conjunto(BARBEARIA, ["Oi {nome}, veja: {demo}"])],
      global: GLOBAL,
    });

    expect(resolvida.texto).toBe("Oi {nome}, veja: {demo}");
    expect(resolvida.traducao).toEqual({ idioma: "es-AR", estado: "ausente" });
  });

  it("com tradução gravada, o texto sai traduzido — sem chamar nada", () => {
    const resolvida = resolverMensagem({
      lead: lead(ARGENTINO),
      buscas: BUSCAS,
      conjuntos: [comTraducao(["Oi {nome}", "", ""], ["Hola {nome}", "", ""])],
      global: GLOBAL,
    });

    expect(resolvida.texto).toBe("Hola {nome}");
    expect(resolvida.traducao).toEqual({ idioma: "es-AR", estado: "aplicada" });
  });

  it("português editado depois da tradução: volta ao português e marca desatualizada", () => {
    const resolvida = resolverMensagem({
      lead: lead(ARGENTINO),
      buscas: BUSCAS,
      conjuntos: [
        comTraducao(["Oi {nome}, mudei", "", ""], ["Hola {nome}", "", ""], ["Oi {nome}", "", ""]),
      ],
      global: GLOBAL,
    });

    expect(resolvida.texto).toBe("Oi {nome}, mudei");
    expect(resolvida.traducao?.estado).toBe("desatualizada");
  });

  it("a tradução é endereçada pelo SLOT, não pela posição na rotação", () => {
    const conjuntoComVazio: FrasesProspeccao = {
      skinId: BARBEARIA,
      frases: ["Oi", "", "Terceira"],
      indice: 1,
      traducoes: {
        "es-AR": {
          frases: ["Hola", "", "Tercera"],
          origem: ["Oi", "", "Terceira"],
          em: "2026-08-01T00:00:00.000Z",
        },
      },
    };

    const resolvida = resolverMensagem({
      lead: lead(ARGENTINO),
      buscas: BUSCAS,
      conjuntos: [conjuntoComVazio],
      global: GLOBAL,
    });

    expect(resolvida.rotacao?.slot).toBe(2);
    expect(resolvida.texto).toBe("Tercera");
  });

  it("mensagem do grupo/global nunca é traduzida (não é frase de skin)", () => {
    const resolvida = resolverMensagem({
      lead: lead({ ...ARGENTINO, demo: undefined }),
      buscas: BUSCAS,
      conjuntos: [],
      global: GLOBAL,
    });

    expect(resolvida.origem).toBe("grupo");
    expect(resolvida.traducao).toBeUndefined();
  });
});
