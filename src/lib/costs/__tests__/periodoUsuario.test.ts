import { describe, expect, it } from "vitest";

import {
  dateKeyRange,
  resetaDiaEm,
  resetaMesEm,
  resetaSemanaEm,
  saoPauloDateKey,
  saoPauloMonthStartKey,
  saoPauloWeekStartKey,
} from "../periodoUsuario";

describe("saoPauloDateKey", () => {
  it("23h59 em Brasília ainda é o dia corrente, mesmo já sendo o dia seguinte em UTC", () => {
    // 27/07/2026 23:59 BRT (UTC-3) = 28/07/2026 02:59 UTC
    expect(saoPauloDateKey(new Date("2026-07-28T02:59:00Z"))).toBe("2026-07-27");
  });

  it("00h01 em Brasília já vira o dia seguinte", () => {
    // 28/07/2026 00:01 BRT = 28/07/2026 03:01 UTC
    expect(saoPauloDateKey(new Date("2026-07-28T03:01:00Z"))).toBe("2026-07-28");
  });

  it("a virada acontece exatamente às 03:00 UTC (meia-noite em Brasília)", () => {
    expect(saoPauloDateKey(new Date("2026-07-28T02:59:59Z"))).toBe("2026-07-27");
    expect(saoPauloDateKey(new Date("2026-07-28T03:00:00Z"))).toBe("2026-07-28");
  });
});

describe("saoPauloWeekStartKey", () => {
  it("uma segunda-feira é o início da própria semana", () => {
    expect(saoPauloWeekStartKey("2026-07-27")).toBe("2026-07-27"); // 27/07/2026 é segunda
  });

  it("domingo pertence à semana que começou na segunda anterior", () => {
    expect(saoPauloWeekStartKey("2026-08-02")).toBe("2026-07-27"); // 02/08/2026 é domingo
  });

  it("quinta-feira volta para a segunda da mesma semana", () => {
    expect(saoPauloWeekStartKey("2026-07-02")).toBe("2026-06-29");
  });
});

describe("saoPauloMonthStartKey", () => {
  it("retorna o dia 01 do mês da chave", () => {
    expect(saoPauloMonthStartKey("2026-07-27")).toBe("2026-07-01");
  });
});

describe("dateKeyRange", () => {
  it("inclui início e fim, em ordem", () => {
    expect(dateKeyRange("2026-06-29", "2026-07-02")).toEqual([
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
    ]);
  });

  it("um único dia quando de === ate", () => {
    expect(dateKeyRange("2026-07-02", "2026-07-02")).toEqual(["2026-07-02"]);
  });
});

describe("resetaDiaEm", () => {
  it("é a meia-noite de amanhã em Brasília, em UTC (03:00Z)", () => {
    expect(resetaDiaEm(new Date("2026-07-02T12:00:00Z"))).toBe("2026-07-03T03:00:00.000Z");
  });
});

describe("resetaSemanaEm", () => {
  it("é a próxima segunda-feira 00h00 em Brasília", () => {
    // 02/07/2026 é quinta; a próxima segunda é 06/07/2026
    expect(resetaSemanaEm(new Date("2026-07-02T12:00:00Z"))).toBe("2026-07-06T03:00:00.000Z");
  });

  it("de uma segunda-feira, reseta na segunda SEGUINTE (7 dias depois)", () => {
    expect(resetaSemanaEm(new Date("2026-07-27T12:00:00Z"))).toBe("2026-08-03T03:00:00.000Z");
  });
});

describe("resetaMesEm", () => {
  it("é o dia 01 do mês seguinte, 00h00 em Brasília", () => {
    expect(resetaMesEm(new Date("2026-07-02T12:00:00Z"))).toBe("2026-08-01T03:00:00.000Z");
  });

  it("vira o ano corretamente em dezembro", () => {
    expect(resetaMesEm(new Date("2026-12-15T12:00:00Z"))).toBe("2027-01-01T03:00:00.000Z");
  });
});
