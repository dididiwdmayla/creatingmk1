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
