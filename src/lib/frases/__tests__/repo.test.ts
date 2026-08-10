import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import {
  avancarRotacao,
  conjuntoVazio,
  getConjunto,
  listConjuntos,
  salvarConjunto,
} from "../repo";
import { FRASES_COLLECTION } from "../types";

const BARBEARIA = "barbearia-editorial";
const PETSHOP = "petshop-focinho-feliz";

function caminho(skinId: string): string {
  return `${FRASES_COLLECTION}/${skinId}`;
}

describe("chave do doc", () => {
  it("é o id da skin, sem normalização nenhuma no meio", async () => {
    const db = new FakeFirestore();

    await salvarConjunto(db, BARBEARIA, ["a"]);

    expect(db.getDoc(caminho(BARBEARIA))).toBeDefined();
  });
});

describe("salvarConjunto", () => {
  it("grava os três slots e devolve o conjunto salvo", async () => {
    const db = new FakeFirestore();

    const salvo = await salvarConjunto(db, BARBEARIA, ["a", "b", "c"]);

    expect(salvo.frases).toEqual(["a", "b", "c"]);
    expect(salvo.skinId).toBe(BARBEARIA);
    expect(db.getDoc(caminho(BARBEARIA))?.frases).toEqual(["a", "b", "c"]);
  });

  it("completa slots faltantes em vez de guardar lista curta", async () => {
    const db = new FakeFirestore();

    const salvo = await salvarConjunto(db, PETSHOP, ["só a primeira"]);

    expect(salvo.frases).toEqual(["só a primeira", "", ""]);
  });

  it("editar os textos PRESERVA o contador do time", async () => {
    const db = new FakeFirestore();
    await salvarConjunto(db, BARBEARIA, ["a", "b", "c"]);
    await avancarRotacao(db, BARBEARIA);
    await avancarRotacao(db, BARBEARIA);

    await salvarConjunto(db, BARBEARIA, ["a", "b (revisada)", "c"]);

    const conjunto = await getConjunto(db, BARBEARIA);
    expect(conjunto?.indice).toBe(2);
    expect(conjunto?.frases[1]).toBe("b (revisada)");
  });
});

describe("avancarRotacao", () => {
  it("gira 1→2→3→1 no contador compartilhado", async () => {
    const db = new FakeFirestore();
    await salvarConjunto(db, BARBEARIA, ["a", "b", "c"]);

    expect(await avancarRotacao(db, BARBEARIA)).toBe(1);
    expect(await avancarRotacao(db, BARBEARIA)).toBe(2);
    expect(await avancarRotacao(db, BARBEARIA)).toBe(0);
  });

  it("avançar NÃO sobrescreve os textos", async () => {
    const db = new FakeFirestore();
    await salvarConjunto(db, BARBEARIA, ["a", "b", "c"]);

    await avancarRotacao(db, BARBEARIA);

    expect(db.getDoc(caminho(BARBEARIA))?.frases).toEqual(["a", "b", "c"]);
  });

  it("skin sem conjunto salvo não ganha doc por causa de um clique", async () => {
    const db = new FakeFirestore();

    expect(await avancarRotacao(db, PETSHOP)).toBe(0);

    expect(db.getDoc(caminho(PETSHOP))).toBeUndefined();
  });

  it("conjunto sem frase preenchida fica em 0", async () => {
    const db = new FakeFirestore();
    await salvarConjunto(db, PETSHOP, ["", "", ""]);

    expect(await avancarRotacao(db, PETSHOP)).toBe(0);
  });

  it("o contador é o MESMO para todos os leads e membros daquela skin", async () => {
    const db = new FakeFirestore();
    await salvarConjunto(db, BARBEARIA, ["a", "b", "c"]);

    // Dois envios, de leads e membros diferentes, na mesma skin.
    await avancarRotacao(db, BARBEARIA);
    const indice = await avancarRotacao(db, BARBEARIA);

    expect(indice).toBe(2);
  });

  it("skins irmãs do mesmo nicho têm contadores independentes", async () => {
    const db = new FakeFirestore();
    await salvarConjunto(db, BARBEARIA, ["a", "b", "c"]);
    await salvarConjunto(db, "barbearia2-sul", ["x", "y", "z"]);

    await avancarRotacao(db, BARBEARIA);

    expect((await getConjunto(db, "barbearia2-sul"))?.indice).toBe(0);
  });
});

describe("listConjuntos", () => {
  it("devolve um conjunto por doc, com o id do doc como skinId", async () => {
    const db = new FakeFirestore();
    await salvarConjunto(db, PETSHOP, ["p"]);
    await salvarConjunto(db, BARBEARIA, ["b"]);

    const conjuntos = await listConjuntos(db);

    expect(conjuntos.map((c) => c.skinId).sort()).toEqual([BARBEARIA, PETSHOP]);
  });

  it("doc legado (chave de texto) aparece com o id antigo — quem filtra é a listagem", async () => {
    const db = new FakeFirestore();
    db.seed(caminho("barbearia%20old%20school"), { nicho: "barbearia old school", frases: ["x"] });

    const conjuntos = await listConjuntos(db);

    expect(conjuntos).toEqual([
      { skinId: "barbearia%20old%20school", frases: ["x", "", ""], indice: 0 },
    ]);
  });

  it("sem nada salvo, a lista é vazia", async () => {
    const db = new FakeFirestore();

    expect(await listConjuntos(db)).toEqual([]);
  });
});

describe("leitura tolerante", () => {
  it("doc antigo/parcial entra no formato certo em vez de derrubar a tela", async () => {
    const db = new FakeFirestore();
    db.seed(caminho(BARBEARIA), { frases: ["a"] });

    const conjunto = await getConjunto(db, BARBEARIA);

    expect(conjunto).toEqual({ skinId: BARBEARIA, frases: ["a", "", ""], indice: 0 });
  });

  it("conjuntoVazio é a forma de uma skin que nunca foi preenchida", () => {
    expect(conjuntoVazio(PETSHOP)).toEqual({ skinId: PETSHOP, frases: ["", "", ""], indice: 0 });
  });
});
