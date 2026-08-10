import { describe, expect, it } from "vitest";

import { formatDateShortSP, formatDuracao, formatTempoRelativo } from "../format";

describe("formatDuracao", () => {
  it("segundos puros abaixo de 1min", () => {
    expect(formatDuracao(0)).toBe("0s");
    expect(formatDuracao(45)).toBe("45s");
  });

  it("minutos exatos sem resto", () => {
    expect(formatDuracao(60)).toBe("1min");
    expect(formatDuracao(120)).toBe("2min");
  });

  it("minutos com resto de segundos", () => {
    expect(formatDuracao(90)).toBe("1min 30s");
  });
});

describe("formatTempoRelativo", () => {
  const agora = new Date("2026-07-31T12:00:00.000Z").getTime();

  it("menos de 1min → agora mesmo", () => {
    expect(formatTempoRelativo(new Date(agora - 30_000).toISOString(), agora)).toBe("agora mesmo");
  });

  it("minutos", () => {
    expect(formatTempoRelativo(new Date(agora - 5 * 60_000).toISOString(), agora)).toBe("há 5min");
  });

  it("horas", () => {
    expect(formatTempoRelativo(new Date(agora - 3 * 3_600_000).toISOString(), agora)).toBe("há 3h");
  });

  it("dias, singular e plural", () => {
    expect(formatTempoRelativo(new Date(agora - 24 * 3_600_000).toISOString(), agora)).toBe(
      "há 1 dia",
    );
    expect(formatTempoRelativo(new Date(agora - 3 * 24 * 3_600_000).toISOString(), agora)).toBe(
      "há 3 dias",
    );
  });

  it("data futura (relógios dessincronizados) nunca fica negativa", () => {
    expect(formatTempoRelativo(new Date(agora + 60_000).toISOString(), agora)).toBe("agora mesmo");
  });
});

describe("formatDateShortSP", () => {
  it("usa o fuso de São Paulo, não o do processo", () => {
    // 01/08 01:00 UTC = 31/07 22:00 em Brasília — e é 31/07 que precisa
    // aparecer ao lado do grupo "Julho" de /buscas.
    expect(formatDateShortSP("2026-08-01T01:00:00.000Z")).toBe("31/07");
  });

  it("data ilegível vira travessão em vez de Invalid Date", () => {
    expect(formatDateShortSP("sei lá")).toBe("—");
  });
});

