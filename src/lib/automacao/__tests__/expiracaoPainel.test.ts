import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  AGENDA_UTC,
  contarAApagar,
  estoqueExcedeFila,
  proximaVarreduraAgendada,
  vencimentoMs,
  type ExpiracaoPainel,
} from "../painelTipos";

/** O que a TELA faz com a lista do retrato: a contagem e o aviso. Puro, client-safe. */

describe("proximaVarreduraAgendada", () => {
  it("antes das 06:30 UTC é hoje; depois (ou exatamente), amanhã", () => {
    expect(new Date(proximaVarreduraAgendada(Date.parse("2026-10-03T02:00:00Z"))).toISOString()).toBe(
      "2026-10-03T06:30:00.000Z",
    );
    expect(new Date(proximaVarreduraAgendada(Date.parse("2026-10-03T06:30:00Z"))).toISOString()).toBe(
      "2026-10-04T06:30:00.000Z",
    );
    expect(new Date(proximaVarreduraAgendada(Date.parse("2026-10-03T21:00:00Z"))).toISOString()).toBe(
      "2026-10-04T06:30:00.000Z",
    );
  });

  it("é o mesmo horário do cron do workflow", () => {
    const yml = readFileSync(path.resolve(__dirname, "../../../../.github/workflows/automacao.yml"), "utf8");
    const cron = /cron:\s*"(\d+) (\d+) \* \* \*"/.exec(yml);
    expect(cron).not.toBeNull();
    expect({ minuto: Number(cron![1]), hora: Number(cron![2]) }).toEqual({
      minuto: AGENDA_UTC.minuto,
      hora: AGENDA_UTC.hora,
    });
  });
});

describe("vencimentoMs", () => {
  it("criadoEm + prazo; data inválida nunca vence", () => {
    expect(vencimentoMs("2026-10-01T00:00:00.000Z", 72)).toBe(Date.parse("2026-10-04T00:00:00.000Z"));
    expect(vencimentoMs("x", 72)).toBeUndefined();
  });
});

describe("contarAApagar", () => {
  const quando = Date.parse("2026-10-03T06:30:00.000Z");
  const exp = (over: Partial<ExpiracaoPainel> = {}): ExpiracaoPainel => ({
    criadas: ["2026-09-29T00:00:00.000Z", "2026-09-30T06:30:00.000Z", "2026-10-01T00:00:00.000Z", "x"],
    total: 4,
    geradoEm: "2026-10-02T20:00:00.000Z",
    proximaVarreduraEm: "2026-10-03T06:30:00.000Z",
    teto: 40,
    metaDiaria: 15,
    ...over,
  });

  it("conta as que vencem ATÉ o instante da varredura (inclusive), com o prazo dado", () => {
    expect(contarAApagar(exp(), 72, quando)).toEqual({ vencidas: 2, aApagar: 2, ficam: 0 });
    expect(contarAApagar(exp(), 24, quando)).toEqual({ vencidas: 3, aApagar: 3, ficam: 0 });
    expect(contarAApagar(exp(), 200, quando)).toEqual({ vencidas: 0, aApagar: 0, ficam: 0 });
  });

  it("o teto por execução corta, e o resto fica para a seguinte", () => {
    expect(contarAApagar(exp({ teto: 1 }), 72, quando)).toEqual({ vencidas: 2, aApagar: 1, ficam: 1 });
  });

  it("varredura que não roda não apaga nada", () => {
    expect(contarAApagar(exp({ naoRodaria: "fila de envio pausada" }), 72, quando)).toEqual({
      vencidas: 2,
      aApagar: 0,
      ficam: 2,
    });
  });
});

describe("estoqueExcedeFila", () => {
  it("só quando o alvo passa da meta diária", () => {
    expect(estoqueExcedeFila(20, 15)).toBe(true);
    expect(estoqueExcedeFila(15, 15)).toBe(false);
    expect(estoqueExcedeFila(10, 15)).toBe(false);
  });
});
