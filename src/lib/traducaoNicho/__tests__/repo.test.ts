import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { getTraducaoNicho, salvarTraducaoNicho, traducaoCacheKey } from "../repo";

const NOW = new Date("2026-07-29T12:00:00.000Z");

describe("traducaoCacheKey", () => {
  it("normaliza caixa e espaços (mesmo par bate na mesma chave)", () => {
    expect(traducaoCacheKey("Dentista", "en-US")).toBe(traducaoCacheKey("  dentista  ", "en-US"));
    expect(traducaoCacheKey("dentista", "en-US")).not.toBe(traducaoCacheKey("dentista", "es-ES"));
  });
});

describe("getTraducaoNicho / salvarTraducaoNicho", () => {
  it("cache miss devolve undefined; salvar e reler devolve a tradução", async () => {
    const db = new FakeFirestore();

    expect(await getTraducaoNicho(db, "dentista", "en-US")).toBeUndefined();

    const salva = await salvarTraducaoNicho(db, "dentista", "en-US", "dentist", NOW);
    expect(salva).toEqual({
      nicho: "dentista",
      idioma: "en-US",
      termo: "dentist",
      geradoEm: NOW.toISOString(),
    });

    const lida = await getTraducaoNicho(db, "  Dentista ", "en-US");
    expect(lida?.termo).toBe("dentist");
  });

  it("pares nicho+idioma diferentes não colidem no cache", async () => {
    const db = new FakeFirestore();
    await salvarTraducaoNicho(db, "dentista", "en-US", "dentist", NOW);
    await salvarTraducaoNicho(db, "dentista", "es-ES", "dentista", NOW);

    expect((await getTraducaoNicho(db, "dentista", "en-US"))?.termo).toBe("dentist");
    expect((await getTraducaoNicho(db, "dentista", "es-ES"))?.termo).toBe("dentista");
  });
});
