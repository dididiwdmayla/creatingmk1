import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { combinacoesDoNicho, proximaCombinacao, RODIZIO_COLLECTION } from "../rodizio";
import type { SkinDefinition } from "../types";

function skinFake(id: string, nicho: string, presetIds: string[]): SkinDefinition {
  return {
    id,
    nicho,
    sinonimos: [],
    nome: id,
    componente: () => Promise.reject(new Error("não usado no teste")),
    themeDefault: { id: presetIds[0] } as SkinDefinition["themeDefault"],
    themePresets: presetIds.map((themeId) => ({ id: themeId }) as SkinDefinition["themeDefault"]),
    demoDataExemplo: {} as SkinDefinition["demoDataExemplo"],
    secoes: [],
    heroEscalaLimites: { min: 1, max: 1 },
    thumbnail: "",
  };
}

describe("combinacoesDoNicho", () => {
  it("ordena por id de skin e depois id de preset, determinístico", () => {
    const skins = [
      skinFake("zebra", "petshop", ["b", "a"]),
      skinFake("acacia", "petshop", ["y", "x"]),
    ];
    expect(combinacoesDoNicho("petshop", skins)).toEqual([
      { skinId: "acacia", themeId: "x" },
      { skinId: "acacia", themeId: "y" },
      { skinId: "zebra", themeId: "a" },
      { skinId: "zebra", themeId: "b" },
    ]);
  });

  it("usa o número real de presets de cada skin, não um 4 fixo", () => {
    const skins = [skinFake("s1", "tatuagem", ["p1", "p2", "p3"])];
    expect(combinacoesDoNicho("tatuagem", skins)).toHaveLength(3);
  });
});

describe("proximaCombinacao", () => {
  it("percorre todas as combinações antes de repetir", async () => {
    const db = new FakeFirestore();
    const skins = [
      skinFake("s1", "barbearia", ["a", "b"]),
      skinFake("s2", "barbearia", ["a", "b"]),
    ];
    const vistas: string[] = [];
    for (let i = 0; i < 4; i++) {
      const combo = await proximaCombinacao(db, "barbearia", new Date(), skins);
      vistas.push(`${combo?.skinId}:${combo?.themeId}`);
    }
    expect(new Set(vistas).size).toBe(4); // as 4 combinações, todas distintas
    // a 5ª chamada repete a 1ª — o rodízio deu a volta completa
    const combo5 = await proximaCombinacao(db, "barbearia", new Date(), skins);
    expect(`${combo5?.skinId}:${combo5?.themeId}`).toBe(vistas[0]);
  });

  it("sobrevive a uma skin nova entrando no meio do rodízio", async () => {
    const db = new FakeFirestore();
    const duasSkins = [
      skinFake("s1", "lancheria", ["a", "b"]),
      skinFake("s2", "lancheria", ["a", "b"]),
    ];
    // Gira 3 vezes com 2 skins (4 combinações) — contador chega a 3.
    for (let i = 0; i < 3; i++) await proximaCombinacao(db, "lancheria", new Date(), duasSkins);

    // Uma terceira skin entra: a lista cresce de 4 para 6 combinações.
    const tresSkins = [...duasSkins, skinFake("s3", "lancheria", ["a", "b"])];
    const proxima = await proximaCombinacao(db, "lancheria", new Date(), tresSkins);
    const todas = combinacoesDoNicho("lancheria", tresSkins);
    // contador estava em 3 → índice 3 % 6 = 3, dentro da lista nova, sem erro.
    expect(proxima).toEqual(todas[3]);

    const doc = db.getDoc(`${RODIZIO_COLLECTION}/lancheria`);
    expect(doc?.contador).toBe(4);
  });

  it("nicho sem skin devolve null e não grava nada", async () => {
    const db = new FakeFirestore();
    const resultado = await proximaCombinacao(db, "dentista", new Date(), []);
    expect(resultado).toBeNull();
    expect(db.getDoc(`${RODIZIO_COLLECTION}/dentista`)).toBeUndefined();
  });
});
