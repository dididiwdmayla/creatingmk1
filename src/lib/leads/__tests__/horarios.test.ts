import { describe, expect, it } from "vitest";

import { estadoAtual, melhorMomento, resumirHorarios } from "../horarios";
import type { Lead } from "../types";

type Faixa = NonNullable<Lead["horarios"]>["faixas"][number];

function faixa(dia: number, horaAbre: number, horaFecha: number, minAbre = 0, minFecha = 0): Faixa {
  return { diaAbre: dia, horaAbre, minAbre, diaFecha: dia, horaFecha, minFecha };
}

function horarios(faixas: Faixa[], utcOffsetMinutes: number | undefined): Lead["horarios"] {
  return { faixas, utcOffsetMinutes, obtidoEm: "2026-07-01T00:00:00.000Z" };
}

// Segunda(1) a sexta(5), 09:00–18:00.
const COMERCIAL: Faixa[] = [1, 2, 3, 4, 5].map((dia) => ({
  diaAbre: dia,
  horaAbre: 9,
  minAbre: 0,
  diaFecha: dia,
  horaFecha: 18,
  minFecha: 0,
}));

// Segunda a sábado, 09:00–18:00 (fechado só domingo).
const SEM_DOMINGO: Faixa[] = [1, 2, 3, 4, 5, 6].map((dia) => ({
  diaAbre: dia,
  horaAbre: 9,
  minAbre: 0,
  diaFecha: dia,
  horaFecha: 18,
  minFecha: 0,
}));

// Sexta 22h–sábado 02h (madrugada, cruza a meia-noite).
const MADRUGADA: Faixa[] = [
  { diaAbre: 5, horaAbre: 22, minAbre: 0, diaFecha: 6, horaFecha: 2, minFecha: 0 },
];

describe("estadoAtual", () => {
  it("aberto agora → 'Aberto agora · fecha Xh' (fuso -3h, Brasília)", () => {
    // Terça 14h local (-3h) = 2026-07-21T17:00:00Z.
    const now = new Date("2026-07-21T17:00:00Z");
    expect(estadoAtual(horarios(COMERCIAL, -180), now)).toEqual({
      aberto: true,
      texto: "Aberto agora · fecha 18h",
    });
  });

  it("fechado → 'Fechado · abre Xh' (fuso +9h, Japão)", () => {
    // Terça 20h local (+9h) = 2026-07-21T11:00:00Z — depois do fechamento.
    const now = new Date("2026-07-21T11:00:00Z");
    expect(estadoAtual(horarios(COMERCIAL, 540), now)).toEqual({
      aberto: false,
      texto: "Fechado · abre 9h",
    });
  });

  it("madrugada: aberto após meia-noite numa faixa que cruza o dia", () => {
    // Sábado 01h local (-3h) = 2026-07-25T04:00:00Z, dentro de sex 22h–sáb 02h.
    const now = new Date("2026-07-25T04:00:00Z");
    expect(estadoAtual(horarios(MADRUGADA, -180), now)).toEqual({
      aberto: true,
      texto: "Aberto agora · fecha 2h",
    });
  });

  it("madrugada: fechado antes da faixa abrir, no mesmo dia", () => {
    // Sexta 18h local (-3h) = 2026-07-24T21:00:00Z — antes de abrir às 22h.
    const now = new Date("2026-07-24T21:00:00Z");
    expect(estadoAtual(horarios(MADRUGADA, -180), now)).toEqual({
      aberto: false,
      texto: "Fechado · abre 22h",
    });
  });

  it("fechado no domingo (sem faixa nesse dia)", () => {
    // Domingo 10h local (-3h) = 2026-07-26T13:00:00Z.
    const now = new Date("2026-07-26T13:00:00Z");
    expect(estadoAtual(horarios(SEM_DOMINGO, -180), now)).toEqual({
      aberto: false,
      texto: "Fechado · abre 9h",
    });
  });

  it("sem utcOffsetMinutes → null (não dá pra calcular o fuso)", () => {
    const now = new Date("2026-07-21T17:00:00Z");
    expect(estadoAtual(horarios(COMERCIAL, undefined), now)).toBeNull();
  });

  it("sem faixas (lugar sem horário conhecido) → null", () => {
    const now = new Date("2026-07-21T17:00:00Z");
    expect(estadoAtual(horarios([], -180), now)).toBeNull();
  });

  it("horarios ausente (nunca buscado) → null", () => {
    expect(estadoAtual(undefined, new Date())).toBeNull();
  });
});

describe("melhorMomento", () => {
  it("aberto agora → sugere agora, sem cálculo de próxima faixa", () => {
    const now = new Date("2026-07-21T17:00:00Z"); // terça 14h local (-3h)
    const resultado = melhorMomento(horarios(COMERCIAL, -180), now);
    expect(resultado).toMatchObject({ agora: true, texto: "Contatar agora" });
    expect(resultado?.em).toEqual(now);
  });

  it("fechado → próxima abertura + 1h, 'amanhã ~Xh' (fuso +9h, Japão)", () => {
    // Terça 20h local (+9h) = 2026-07-21T11:00:00Z; abre quarta 9h local.
    const now = new Date("2026-07-21T11:00:00Z");
    const resultado = melhorMomento(horarios(COMERCIAL, 540), now);
    expect(resultado).toMatchObject({ agora: false, texto: "amanhã ~10h" });
  });

  it("fechado no domingo → sugere 'amanhã ~10h' (abre segunda 9h, +1h)", () => {
    // Domingo 10h local (-3h) = 2026-07-26T13:00:00Z.
    const now = new Date("2026-07-26T13:00:00Z");
    const resultado = melhorMomento(horarios(SEM_DOMINGO, -180), now);
    expect(resultado).toMatchObject({ agora: false, texto: "amanhã ~10h" });
  });

  it("fechado no mesmo dia (madrugada) → 'hoje ~Xh'", () => {
    // Sexta 18h local (-3h) = 2026-07-24T21:00:00Z; abre sexta 22h → contato 23h, mesmo dia.
    const now = new Date("2026-07-24T21:00:00Z");
    const resultado = melhorMomento(horarios(MADRUGADA, -180), now);
    expect(resultado).toMatchObject({ agora: false, texto: "hoje ~23h" });
  });

  it("madrugada: fechado de virada, sugestão cai no dia seguinte", () => {
    // Sábado 01h30 local (-3h), faixa já fechou (fecha 02h) — mas ainda dentro,
    // então usamos um instante depois do fechamento: sábado 03h local.
    const now = new Date("2026-07-25T06:00:00Z"); // sábado 03h local
    const resultado = melhorMomento(horarios(MADRUGADA, -180), now);
    // Próxima abertura: sexta seguinte 22h (só há uma faixa/semana) → +1h = 23h,
    // dia da semana distante (sexta), não "hoje"/"amanhã".
    expect(resultado?.agora).toBe(false);
    expect(resultado?.texto).toMatch(/^(sexta) ~23h$/);
  });

  it("sem dados suficientes → null", () => {
    expect(melhorMomento(horarios(COMERCIAL, undefined), new Date())).toBeNull();
    expect(melhorMomento(horarios([], -180), new Date())).toBeNull();
    expect(melhorMomento(undefined, new Date())).toBeNull();
  });
});

describe("resumirHorarios", () => {
  it("dias agrupados: SEG-SEX iguais, SÁB diferente, DOM fechado", () => {
    const faixas = [
      ...[1, 2, 3, 4, 5].map((dia) => faixa(dia, 9, 20)),
      faixa(6, 9, 18),
    ];
    expect(resumirHorarios(faixas)).toBe("SEG-SEX 9h-20h · SÁB 9h-18h · DOM fechado");
  });

  it("dia isolado no meio da semana, resto fechado", () => {
    const faixas = [faixa(3, 14, 19)];
    expect(resumirHorarios(faixas)).toBe(
      "SEG-TER fechado · QUA 14h-19h · QUI-DOM fechado",
    );
  });

  it("faixa dupla no mesmo dia (pausa de almoço)", () => {
    const faixas = [1, 2, 3, 4, 5].map((dia) => dia).flatMap((dia) => [
      faixa(dia, 9, 12),
      faixa(dia, 14, 18),
    ]);
    expect(resumirHorarios(faixas)).toBe("SEG-SEX 9h-12h/14h-18h · SÁB-DOM fechado");
  });

  it("sem faixas → undefined", () => {
    expect(resumirHorarios([])).toBeUndefined();
  });
});
