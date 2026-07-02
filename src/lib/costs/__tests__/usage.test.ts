import { describe, expect, it } from "vitest";

import { QuotaExceededError } from "../errors";
import { DEFAULT_CAPS, type UsageCounts } from "../skus";
import { getUsage, reserveQuota } from "../usage";
import { FakeFirestore } from "../../testing/fake-firestore";

const NOW = new Date("2026-07-02T12:00:00Z");
const DOC = "usage/2026-07";

function caps(overrides: Partial<UsageCounts> = {}): UsageCounts {
  return { ...DEFAULT_CAPS, ...overrides };
}

describe("reserveQuota", () => {
  it("cria o doc do mês na primeira reserva, com os outros SKUs zerados", async () => {
    const db = new FakeFirestore();

    const result = await reserveQuota(db, "textSearch", caps(), NOW);

    expect(result.period).toBe("2026-07");
    expect(result.usage).toEqual({
      textSearch: 1,
      detailsEssentials: 0,
      detailsPro: 0,
    });
    expect(db.getDoc(DOC)).toMatchObject({ textSearch: 1, detailsPro: 0 });
  });

  it("acumula reservas sequenciais", async () => {
    const db = new FakeFirestore();

    await reserveQuota(db, "textSearch", caps(), NOW);
    await reserveQuota(db, "textSearch", caps(), NOW);
    const result = await reserveQuota(db, "textSearch", caps(), NOW);

    expect(result.usage.textSearch).toBe(3);
  });

  it("conta SKUs de forma independente", async () => {
    const db = new FakeFirestore();

    await reserveQuota(db, "textSearch", caps(), NOW);
    await reserveQuota(db, "detailsPro", caps(), NOW);
    const result = await reserveQuota(db, "detailsPro", caps(), NOW);

    expect(result.usage).toEqual({
      textSearch: 1,
      detailsEssentials: 0,
      detailsPro: 2,
    });
  });

  it("parte do uso já persistido no doc do mês", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { textSearch: 41, detailsPro: 7 });

    const result = await reserveQuota(db, "textSearch", caps(), NOW);

    expect(result.usage.textSearch).toBe(42);
    expect(result.usage.detailsPro).toBe(7);
  });

  it("recusa quando o teto seria estourado e NÃO incrementa o contador", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { detailsPro: 3 });

    await expect(
      reserveQuota(db, "detailsPro", caps({ detailsPro: 3 }), NOW),
    ).rejects.toThrow(QuotaExceededError);

    expect(db.getDoc(DOC)).toEqual({ detailsPro: 3 });
  });

  it("permite exatamente até o teto", async () => {
    const db = new FakeFirestore();
    const capped = caps({ detailsPro: 2 });

    await reserveQuota(db, "detailsPro", capped, NOW);
    const last = await reserveQuota(db, "detailsPro", capped, NOW);
    expect(last.usage.detailsPro).toBe(2);

    await expect(reserveQuota(db, "detailsPro", capped, NOW)).rejects.toThrow(
      QuotaExceededError,
    );
  });

  it("teto 0 bloqueia o SKU por completo", async () => {
    const db = new FakeFirestore();

    await expect(
      reserveQuota(db, "textSearch", caps({ textSearch: 0 }), NOW),
    ).rejects.toThrow(QuotaExceededError);
    expect(db.getDoc(DOC)).toBeUndefined();
  });

  it("teto negativo é tratado como 0", async () => {
    const db = new FakeFirestore();

    await expect(
      reserveQuota(db, "textSearch", caps({ textSearch: -5 }), NOW),
    ).rejects.toThrow(QuotaExceededError);
  });

  it("o erro carrega sku, uso, teto e período para a rota montar o 429", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { textSearch: 100 });

    const error = await reserveQuota(
      db,
      "textSearch",
      caps({ textSearch: 100 }),
      NOW,
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(QuotaExceededError);
    const quotaError = error as QuotaExceededError;
    expect(quotaError.code).toBe("quota_exceeded");
    expect(quotaError.sku).toBe("textSearch");
    expect(quotaError.used).toBe(100);
    expect(quotaError.cap).toBe(100);
    expect(quotaError.period).toBe("2026-07");
    expect(quotaError.message).toContain("textSearch");
    expect(quotaError.message).toContain("100/100");
  });

  it("meses diferentes usam docs diferentes (contador zera na virada)", async () => {
    const db = new FakeFirestore();
    db.seed("usage/2026-06", { textSearch: 9_999 });

    const july = await reserveQuota(db, "textSearch", caps(), NOW);

    expect(july.usage.textSearch).toBe(1);
    expect(db.getDoc("usage/2026-06")).toEqual({ textSearch: 9_999 });
  });

  it("trata contadores malformados (string, negativo, NaN) como 0", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { textSearch: "muitos", detailsPro: -12, detailsEssentials: NaN });

    const result = await reserveQuota(db, "textSearch", caps(), NOW);

    expect(result.usage).toEqual({
      textSearch: 1,
      detailsEssentials: 0,
      detailsPro: 0,
    });
  });

  it("grava atualizadoEm em ISO 8601", async () => {
    const db = new FakeFirestore();

    await reserveQuota(db, "textSearch", caps(), NOW);

    expect(db.getDoc(DOC)?.atualizadoEm).toBe("2026-07-02T12:00:00.000Z");
  });
});

describe("getUsage", () => {
  it("retorna tudo zero quando o doc do mês não existe", async () => {
    const db = new FakeFirestore();

    const result = await getUsage(db, NOW);

    expect(result).toEqual({
      period: "2026-07",
      usage: { textSearch: 0, detailsEssentials: 0, detailsPro: 0 },
    });
  });

  it("retorna os contadores persistidos", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { textSearch: 42, detailsEssentials: 1, detailsPro: 17 });

    const result = await getUsage(db, NOW);

    expect(result.usage).toEqual({
      textSearch: 42,
      detailsEssentials: 1,
      detailsPro: 17,
    });
  });
});
