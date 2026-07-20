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
      textSearchEnterprise: 0,
      detailsEssentials: 0,
      detailsEnterprise: 0,
      geocoding: 0,
      aiGeneration: 0,
    });
    expect(db.getDoc(DOC)).toMatchObject({ textSearch: 1, detailsEnterprise: 0 });
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
    await reserveQuota(db, "detailsEnterprise", caps(), NOW);
    const result = await reserveQuota(db, "detailsEnterprise", caps(), NOW);

    expect(result.usage).toEqual({
      textSearch: 1,
      textSearchEnterprise: 0,
      detailsEssentials: 0,
      detailsEnterprise: 2,
      geocoding: 0,
      aiGeneration: 0,
    });
  });

  it("parte do uso já persistido no doc do mês", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { textSearch: 41, detailsEnterprise: 7 });

    const result = await reserveQuota(db, "textSearch", caps(), NOW);

    expect(result.usage.textSearch).toBe(42);
    expect(result.usage.detailsEnterprise).toBe(7);
  });

  it("migração: reserva continua do contador legado detailsPro e grava o nome novo", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { detailsPro: 17 });

    const result = await reserveQuota(db, "detailsEnterprise", caps(), NOW);

    expect(result.usage.detailsEnterprise).toBe(18);
    expect(db.getDoc(DOC)).toMatchObject({ detailsEnterprise: 18, detailsPro: 17 });

    // Depois que o nome novo existe, o legado é ignorado.
    const second = await reserveQuota(db, "detailsEnterprise", caps(), NOW);
    expect(second.usage.detailsEnterprise).toBe(19);
  });

  it("recusa quando o teto seria estourado e NÃO incrementa o contador", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { detailsEnterprise: 3 });

    await expect(
      reserveQuota(db, "detailsEnterprise", caps({ detailsEnterprise: 3 }), NOW),
    ).rejects.toThrow(QuotaExceededError);

    expect(db.getDoc(DOC)).toEqual({ detailsEnterprise: 3 });
  });

  it("permite exatamente até o teto", async () => {
    const db = new FakeFirestore();
    const capped = caps({ detailsEnterprise: 2 });

    await reserveQuota(db, "detailsEnterprise", capped, NOW);
    const last = await reserveQuota(db, "detailsEnterprise", capped, NOW);
    expect(last.usage.detailsEnterprise).toBe(2);

    await expect(reserveQuota(db, "detailsEnterprise", capped, NOW)).rejects.toThrow(
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
    db.seed(DOC, { textSearch: "muitos", detailsEnterprise: -12, detailsEssentials: NaN });

    const result = await reserveQuota(db, "textSearch", caps(), NOW);

    expect(result.usage).toEqual({
      textSearch: 1,
      textSearchEnterprise: 0,
      detailsEssentials: 0,
      detailsEnterprise: 0,
      geocoding: 0,
      aiGeneration: 0,
    });
  });

  it("grava atualizadoEm em ISO 8601", async () => {
    const db = new FakeFirestore();

    await reserveQuota(db, "textSearch", caps(), NOW);

    expect(db.getDoc(DOC)?.atualizadoEm).toBe("2026-07-02T12:00:00.000Z");
  });

  it("com userId, incrementa também a quebra porUsuario (teto continua agregado)", async () => {
    const db = new FakeFirestore();

    await reserveQuota(db, "textSearch", caps(), NOW, "ana");
    await reserveQuota(db, "textSearch", caps(), NOW, "ana");
    await reserveQuota(db, "textSearch", caps(), NOW, "beto");
    await reserveQuota(db, "textSearch", caps(), NOW); // sem usuário identificado

    const doc = db.getDoc(DOC);
    expect(doc?.textSearch).toBe(4);
    const porUsuario = doc?.porUsuario as Record<string, Record<string, number>>;
    expect(porUsuario.ana.textSearch).toBe(2);
    expect(porUsuario.beto.textSearch).toBe(1);
  });
});

describe("getUsage", () => {
  it("retorna tudo zero quando o doc do mês não existe", async () => {
    const db = new FakeFirestore();

    const result = await getUsage(db, NOW);

    expect(result).toEqual({
      period: "2026-07",
      usage: {
        textSearch: 0,
        textSearchEnterprise: 0,
        detailsEssentials: 0,
        detailsEnterprise: 0,
        geocoding: 0,
        aiGeneration: 0,
      },
      porUsuario: {},
    });
  });

  it("lê a quebra porUsuario do doc (entradas malformadas ignoradas)", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, {
      textSearch: 12,
      porUsuario: { ana: { textSearch: 5 }, sujo: "não é objeto" },
    });

    const result = await getUsage(db, NOW);

    expect(result.porUsuario).toEqual({
      ana: {
        textSearch: 5,
        textSearchEnterprise: 0,
        detailsEssentials: 0,
        detailsEnterprise: 0,
        geocoding: 0,
        aiGeneration: 0,
      },
    });
  });

  it("retorna os contadores persistidos", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { textSearch: 42, detailsEssentials: 1, detailsEnterprise: 17 });

    const result = await getUsage(db, NOW);

    expect(result.usage).toEqual({
      textSearch: 42,
      textSearchEnterprise: 0,
      detailsEssentials: 1,
      detailsEnterprise: 17,
      geocoding: 0,
      aiGeneration: 0,
    });
  });

  it("migração: lê o contador legado detailsPro como detailsEnterprise", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { textSearch: 5, detailsPro: 17 });

    const result = await getUsage(db, NOW);

    expect(result.usage.detailsEnterprise).toBe(17);
  });

  it("migração: o nome novo tem precedência sobre o legado (mesmo em 0)", async () => {
    const db = new FakeFirestore();
    db.seed(DOC, { detailsPro: 17, detailsEnterprise: 0 });

    const result = await getUsage(db, NOW);

    expect(result.usage.detailsEnterprise).toBe(0);
  });
});
