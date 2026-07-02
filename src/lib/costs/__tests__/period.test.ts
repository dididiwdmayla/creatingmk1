import { describe, expect, it } from "vitest";

import { periodKey } from "../period";

describe("periodKey", () => {
  it("formata como YYYY-MM", () => {
    expect(periodKey(new Date("2026-07-02T12:00:00Z"))).toBe("2026-07");
  });

  it("preenche o mês com zero à esquerda", () => {
    expect(periodKey(new Date("2026-01-15T00:00:00Z"))).toBe("2026-01");
  });

  it("usa UTC na virada do mês (não o fuso local)", () => {
    // 23h30 de 31/07 em Brasília (UTC-3) já é 01/08 em UTC.
    expect(periodKey(new Date("2026-07-31T23:30:00-03:00"))).toBe("2026-08");
    expect(periodKey(new Date("2026-07-31T23:30:00Z"))).toBe("2026-07");
  });
});
