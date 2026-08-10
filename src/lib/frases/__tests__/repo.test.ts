import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { chaveNicho } from "../chave";
import {
  avancarRotacao,
  chaveDoAlvo,
  conjuntoVazio,
  getConjunto,
  listConjuntos,
  salvarConjunto,
} from "../repo";
import { CHAVE_GENERICAS, FRASES_COLLECTION } from "../types";

function caminho(nicho: string | null): string {
  return `${FRASES_COLLECTION}/${chaveDoAlvo(nicho)}`;
}

describe("chave do doc", () => {
  it("normaliza caixa e espaços — o mesmo nicho cai no mesmo conjunto", () => {
    expect(chaveNicho("Dentista")).toBe(chaveNicho("  dentista  "));
    expect(chaveNicho("loja  de   roupas")).toBe(chaveNicho("Loja de Roupas"));
  });

  it("nicho com barra não vira subcoleção", () => {
    expect(chaveNicho("bar/restaurante")).not.toContain("/");
  });

  it("o conjunto genérico tem doc reservado próprio", () => {
    expect(chaveDoAlvo(null)).toBe(CHAVE_GENERICAS);
  });
});

describe("salvarConjunto", () => {
  it("grava os três slots e devolve o conjunto salvo", async () => {
    const db = new FakeFirestore();

    const salvo = await salvarConjunto(db, "Dentista", ["a", "b", "c"]);

    expect(salvo.frases).toEqual(["a", "b", "c"]);
    expect(salvo.nicho).toBe("Dentista");
    expect(db.getDoc(caminho("dentista"))?.frases).toEqual(["a", "b", "c"]);
  });

  it("completa slots faltantes em vez de guardar lista curta", async () => {
    const db = new FakeFirestore();

    const salvo = await salvarConjunto(db, "petshop", ["só a primeira"]);

    expect(salvo.frases).toEqual(["só a primeira", "", ""]);
  });

  it("editar os textos PRESERVA o contador do time", async () => {
    const db = new FakeFirestore();
    await salvarConjunto(db, "dentista", ["a", "b", "c"]);
    await avancarRotacao(db, "dentista");
    await avancarRotacao(db, "dentista");

    await salvarConjunto(db, "dentista", ["a", "b (revisada)", "c"]);

    const conjunto = await getConjunto(db, "dentista");
    expect(conjunto?.indice).toBe(2);
    expect(conjunto?.frases[1]).toBe("b (revisada)");
  });

  it("o conjunto genérico usa o mesmo caminho de código", async () => {
    const db = new FakeFirestore();

    await salvarConjunto(db, null, ["genérica 1", "genérica 2", ""]);

    const conjunto = await getConjunto(db, null);
    expect(conjunto?.frases).toEqual(["genérica 1", "genérica 2", ""]);
    expect(conjunto?.nicho).toBe("");
  });
});

describe("avancarRotacao", () => {
  it("gira 1→2→3→1 no contador compartilhado", async () => {
    const db = new FakeFirestore();
    await salvarConjunto(db, "dentista", ["a", "b", "c"]);

    expect(await avancarRotacao(db, "dentista")).toBe(1);
    expect(await avancarRotacao(db, "dentista")).toBe(2);
    expect(await avancarRotacao(db, "dentista")).toBe(0);
  });

  it("avançar NÃO sobrescreve os textos", async () => {
    const db = new FakeFirestore();
    await salvarConjunto(db, "dentista", ["a", "b", "c"]);

    await avancarRotacao(db, "dentista");

    expect(db.getDoc(caminho("dentista"))?.frases).toEqual(["a", "b", "c"]);
  });

  it("nicho sem conjunto salvo não ganha doc por causa de um clique", async () => {
    const db = new FakeFirestore();

    expect(await avancarRotacao(db, "inexistente")).toBe(0);

    expect(db.getDoc(caminho("inexistente"))).toBeUndefined();
  });

  it("conjunto sem frase preenchida fica em 0", async () => {
    const db = new FakeFirestore();
    await salvarConjunto(db, "vazio", ["", "", ""]);

    expect(await avancarRotacao(db, "vazio")).toBe(0);
  });

  it("o contador é o MESMO para todos os leads e membros do nicho", async () => {
    const db = new FakeFirestore();
    await salvarConjunto(db, "Dentista", ["a", "b", "c"]);

    // Dois envios de leads/membros diferentes, grafias diferentes do nicho.
    await avancarRotacao(db, "dentista");
    const indice = await avancarRotacao(db, "  DENTISTA ");

    expect(indice).toBe(2);
  });
});

describe("listConjuntos", () => {
  it("separa o genérico dos nichos e ordena por nome", async () => {
    const db = new FakeFirestore();
    await salvarConjunto(db, "petshop", ["p"]);
    await salvarConjunto(db, "barbearia", ["b"]);
    await salvarConjunto(db, null, ["g"]);

    const { nichos, genericas } = await listConjuntos(db);

    expect(nichos.map((c) => c.nicho)).toEqual(["barbearia", "petshop"]);
    expect(genericas?.frases[0]).toBe("g");
  });

  it("sem nada salvo, não há genérico", async () => {
    const db = new FakeFirestore();

    const { nichos, genericas } = await listConjuntos(db);

    expect(nichos).toEqual([]);
    expect(genericas).toBeUndefined();
  });
});

describe("leitura tolerante", () => {
  it("doc antigo/parcial entra no formato certo em vez de derrubar a tela", async () => {
    const db = new FakeFirestore();
    db.seed(caminho("dentista"), { nicho: "dentista", frases: ["a"] });

    const conjunto = await getConjunto(db, "dentista");

    expect(conjunto).toEqual({ nicho: "dentista", frases: ["a", "", ""], indice: 0 });
  });

  it("conjuntoVazio é a forma de um nicho que nunca foi preenchido", () => {
    expect(conjuntoVazio("novo")).toEqual({ nicho: "novo", frases: ["", "", ""], indice: 0 });
  });
});
