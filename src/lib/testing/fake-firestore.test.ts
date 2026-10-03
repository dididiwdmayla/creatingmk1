import { describe, expect, it } from "vitest";

import { FakeFirestore } from "./fake-firestore";

/**
 * Paridade de segmentos no path de coleção: o Firestore real
 * (`@google-cloud/firestore`) recusa `.collection()` com número PAR de
 * segmentos — só um número ÍMPAR aponta pra uma coleção de verdade
 * (collection, collection/doc/collection, ...). O fake precisa reproduzir
 * essa restrição, senão um bug de path (como `usage_users/{userId}`, 2
 * segmentos, que só deveria funcionar como `usage_users/{userId}/dias`)
 * passa limpo pelos testes e só quebra em produção.
 */
describe("FakeFirestore — paridade de segmentos do path de coleção", () => {
  it("aceita coleção de 1 segmento", () => {
    const db = new FakeFirestore();
    expect(() => db.collection("usuarios")).not.toThrow();
  });

  it("aceita subcoleção de 3 segmentos", () => {
    const db = new FakeFirestore();
    expect(() => db.collection("buscas/abc/execucoes")).not.toThrow();
    expect(() => db.collection("usage_users/membro-1/dias")).not.toThrow();
  });

  it("recusa path de 2 segmentos (aponta pra um documento, não coleção)", () => {
    const db = new FakeFirestore();
    expect(() => db.collection("usage_users/membro-1")).toThrow(/número ímpar|odd number/i);
  });

  it("recusa path de 4 segmentos", () => {
    const db = new FakeFirestore();
    expect(() => db.collection("a/b/c/d")).toThrow();
  });
});

/**
 * A CONCORRÊNCIA do fake — a garantia do Firestore real que ele não dava:
 * se um doc LIDO numa transação muda antes do commit, nada é escrito e a
 * função roda de novo sobre o estado novo. Sem isto, um teste de "virou
 * transacional" passaria sem provar nada (ver "Escritas transacionais no
 * lead" em ARCHITECTURE.md).
 */
describe("FakeFirestore — conflito de transação", () => {
  it("doc lido e escrito por OUTRO antes do commit: a função roda de novo sobre o valor novo", async () => {
    const db = new FakeFirestore();
    db.seed("c/x", { n: 1 });
    const ref = db.collection("c").doc("x");
    db.aoLer("c/x", async () => {
      await ref.set({ n: 10 }); // a escrita concorrente, entre a leitura e o commit
    });

    let rodadas = 0;
    await db.runTransaction(async (tx) => {
      rodadas += 1;
      const n = ((await tx.get(ref)).data()?.n as number) ?? 0;
      tx.set(ref, { n: n + 1 });
    });

    expect(rodadas).toBe(2);
    expect(db.getDoc("c/x")).toEqual({ n: 11 }); // nenhuma atualização perdida
  });

  it("escrita sem leitura não conflita (escrita cega, como no Firestore)", async () => {
    const db = new FakeFirestore();
    const ref = db.collection("c").doc("x");
    let rodadas = 0;
    await db.runTransaction(async (tx) => {
      rodadas += 1;
      await ref.set({ outro: true });
      tx.set(ref, { n: 1 }, { merge: true });
    });
    expect(rodadas).toBe(1);
    expect(db.getDoc("c/x")).toEqual({ outro: true, n: 1 });
  });

  it("contenção sem fim: desiste depois de 5 tentativas, sem escrever nada", async () => {
    const db = new FakeFirestore();
    db.seed("c/x", { n: 0 });
    const ref = db.collection("c").doc("x");

    await expect(
      db.runTransaction(async (tx) => {
        await tx.get(ref);
        db.seed("c/x", { n: 99 }); // alguém sempre escreve no meio
        tx.set(ref, { n: -1 });
      }),
    ).rejects.toThrow(/ABORTED/);
    expect(db.getDoc("c/x")).toEqual({ n: 99 });
  });

  it("o gancho `aoLer` dispara UMA vez, também em leitura fora de transação", async () => {
    const db = new FakeFirestore();
    db.seed("c/x", { n: 1 });
    let disparos = 0;
    db.aoLer("c/x", async () => {
      disparos += 1;
    });

    await db.collection("c").doc("x").get();
    await db.collection("c").doc("x").get();

    expect(disparos).toBe(1);
  });
});
