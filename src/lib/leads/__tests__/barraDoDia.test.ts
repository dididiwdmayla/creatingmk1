import { describe, expect, it } from "vitest";

import { barraDoDia, linhaEstadoContato } from "../barraDoDia";
import { DEFAULT_JANELAS_CONTATO, type JanelasContatoConfig } from "../janelaContato";
import type { Lead } from "../types";

type Faixa = NonNullable<Lead["horarios"]>["faixas"][number];

function abertura(dia: number, horaAbre: number, horaFecha: number): Faixa {
  return { diaAbre: dia, horaAbre, minAbre: 0, diaFecha: dia, horaFecha, minFecha: 0 };
}

// Mesmas âncoras de horarios.test.ts: 2026-07-21 é terça.
const TERCA = "2026-07-21";
const SEXTA = "2026-07-24";
const SABADO = "2026-07-25";

/** Instante UTC correspondente a `hora:min` LOCAL (-180, Brasília) na data informada. */
function instanteLocal(data: string, hora: number, min = 0): Date {
  const utcHora = hora + 3;
  return new Date(`${data}T${String(utcHora).padStart(2, "0")}:${String(min).padStart(2, "0")}:00.000Z`);
}

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: "p1",
    nome: "Lead Teste",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Lead de barbearia com fuso de Brasília e o horário de funcionamento informado. */
function barbearia(faixas: Faixa[], overrides: Partial<Lead> = {}): Lead {
  return lead({
    busca: { nicho: "barbearia", regiao: "x", em: "" },
    horarios: { faixas, utcOffsetMinutes: -180, obtidoEm: "2026-01-01T00:00:00.000Z" },
    ...overrides,
  });
}

describe("barraDoDia", () => {
  it("sem deslocamento UTC conhecido → undefined: nenhuma barra, nunca hora errada", () => {
    expect(barraDoDia(DEFAULT_JANELAS_CONTATO, lead())).toBeUndefined();
    expect(barraDoDia(DEFAULT_JANELAS_CONTATO, lead({ endereco: "Rua X, Nárnia" }))).toBeUndefined();
  });

  it("cobre só o expediente, e classifica cada trecho pelo nível da família", () => {
    const l = barbearia([abertura(2, 9, 19)]); // terça, 9h-19h
    const barra = barraDoDia(DEFAULT_JANELAS_CONTATO, l, instanteLocal(TERCA, 10, 0))!;

    expect(barra.abertura).toEqual({ inicio: 9 * 60, fim: 19 * 60 });
    expect(barra.segmentos).toEqual([
      { inicioMin: 9 * 60, fimMin: 11 * 60 + 30, nivel: "bom" },
      { inicioMin: 11 * 60 + 30, fimMin: 16 * 60 + 30, nivel: "razoavel" },
      { inicioMin: 16 * 60 + 30, fimMin: 19 * 60, nivel: "ruim" },
    ]);
    expect(barra.estimado).toBe(false);
    expect(barra.aberto).toBe(true);
    expect(barra.nivelAgora).toBe("bom");
    expect(barra.proximoBom).toBeUndefined(); // agora JÁ é bom
  });

  it("a faixa da família é recortada pelo funcionamento: abrindo às 10h, o bom começa às 10h", () => {
    const l = barbearia([abertura(2, 10, 19)]);
    const barra = barraDoDia(DEFAULT_JANELAS_CONTATO, l, instanteLocal(TERCA, 8, 0))!;
    expect(barra.segmentos[0]).toEqual({ inicioMin: 10 * 60, fimMin: 11 * 60 + 30, nivel: "bom" });
    expect(barra.aberto).toBe(false);
    expect(barra.proximoBom).toEqual({ offsetDias: 0, rotuloDia: "hoje", inicioMin: 10 * 60 });
  });

  it("intervalo fechado no meio do dia vira BURACO — nada pintado ali", () => {
    const l = barbearia([abertura(2, 9, 12), abertura(2, 14, 19)]);
    const barra = barraDoDia(DEFAULT_JANELAS_CONTATO, l, instanteLocal(TERCA, 13, 0))!;

    expect(barra.abertura).toEqual({ inicio: 9 * 60, fim: 19 * 60 });
    const cobertos = barra.segmentos.map((s) => [s.inicioMin, s.fimMin]);
    expect(cobertos).toEqual([
      [9 * 60, 11 * 60 + 30],
      [11 * 60 + 30, 12 * 60],
      [14 * 60, 16 * 60 + 30],
      [16 * 60 + 30, 19 * 60],
    ]);
    // 13h cai no buraco: fechado, e nenhum segmento cobre o minuto.
    expect(barra.aberto).toBe(false);
    expect(barra.nivelAgora).toBeUndefined();
  });

  it("dia fechado: sem abertura e sem segmentos, só a linha de texto", () => {
    const l = barbearia([abertura(1, 9, 19)]); // só segunda
    const barra = barraDoDia(DEFAULT_JANELAS_CONTATO, l, instanteLocal(TERCA, 10, 0))!;
    expect(barra.abertura).toBeUndefined();
    expect(barra.segmentos).toEqual([]);
    expect(barra.aberto).toBe(false);
    expect(linhaEstadoContato(barra)).toBe("Hora do lead 10h · fechado hoje · próximo bom segunda 9h");
  });

  it("sem horário de funcionamento: intervalo comercial padrão, marcado como estimativa", () => {
    const l = lead({
      busca: { nicho: "barbearia", regiao: "x", em: "" },
      endereco: "Rua X, 123, São Paulo, Brasil", // fuso derivado do país, sem horários
    });
    const barra = barraDoDia(DEFAULT_JANELAS_CONTATO, l, instanteLocal(TERCA, 12, 0))!;
    expect(barra.estimado).toBe(true);
    expect(barra.abertura).toEqual({ inicio: 9 * 60, fim: 18 * 60 });
    expect(barra.nivelAgora).toBe("razoavel");
    expect(linhaEstadoContato(barra)).toContain("horário estimado");
  });

  it("madrugada: faixa que cruza a meia-noite entra recortada nos dois dias", () => {
    // Terça 18h → quarta 2h.
    const l = barbearia([{ diaAbre: 2, horaAbre: 18, minAbre: 0, diaFecha: 3, horaFecha: 2, minFecha: 0 }]);
    const terca = barraDoDia(DEFAULT_JANELAS_CONTATO, l, instanteLocal(TERCA, 19, 0))!;
    expect(terca.abertura).toEqual({ inicio: 18 * 60, fim: 24 * 60 });
    expect(terca.aberto).toBe(true);
    expect(terca.nivelAgora).toBe("ruim"); // 16h30-20h é ruim pra barbearia

    const quarta = barraDoDia(DEFAULT_JANELAS_CONTATO, l, instanteLocal("2026-07-22", 1, 0))!;
    expect(quarta.abertura).toEqual({ inicio: 0, fim: 2 * 60 });
    expect(quarta.aberto).toBe(true);
    expect(quarta.nivelAgora).toBe("razoavel");
  });

  it("sexta não tem trecho bom: o próximo bom cai na segunda", () => {
    const l = barbearia([abertura(5, 9, 19), abertura(1, 9, 19)]);
    const barra = barraDoDia(DEFAULT_JANELAS_CONTATO, l, instanteLocal(SEXTA, 10, 0))!;
    expect(barra.segmentos.some((s) => s.nivel === "bom")).toBe(false);
    expect(barra.nivelAgora).toBe("razoavel");
    expect(barra.proximoBom).toEqual({ offsetDias: 3, rotuloDia: "segunda", inicioMin: 9 * 60 });
  });

  it("sábado de barbearia é ruim o dia inteiro, e o próximo bom é na segunda", () => {
    const l = barbearia([abertura(6, 9, 18), abertura(1, 9, 19)]);
    const barra = barraDoDia(DEFAULT_JANELAS_CONTATO, l, instanteLocal(SABADO, 11, 0))!;
    expect(barra.segmentos).toEqual([{ inicioMin: 9 * 60, fimMin: 18 * 60, nivel: "ruim" }]);
    expect(linhaEstadoContato(barra)).toBe(
      "Hora do lead 11h · agora: ruim · próximo bom segunda 9h",
    );
  });

  it("dia desmarcado com o estabelecimento aberto: tudo razoável, nada de quarto nível", () => {
    const l = lead({
      busca: { nicho: "lancheria", regiao: "x", em: "" },
      horarios: {
        faixas: [abertura(6, 11, 22)],
        utcOffsetMinutes: -180,
        obtidoEm: "2026-01-01T00:00:00.000Z",
      },
    });
    const barra = barraDoDia(DEFAULT_JANELAS_CONTATO, l, instanteLocal(SABADO, 12, 0))!;
    expect(barra.segmentos).toEqual([{ inicioMin: 11 * 60, fimMin: 22 * 60, nivel: "razoavel" }]);
  });

  it("família fora da tabela cai no genérico", () => {
    const l = lead({
      busca: { nicho: "pizzaria", regiao: "x", em: "" },
      horarios: { faixas: [abertura(2, 8, 18)], utcOffsetMinutes: -180, obtidoEm: "" },
    });
    const barra = barraDoDia(DEFAULT_JANELAS_CONTATO, l, instanteLocal(TERCA, 10, 0))!;
    expect(barra.nivelAgora).toBe("bom"); // genérico: 9h30-11h
  });

  it("tabela sem a família nem o genérico → undefined", () => {
    const janelas: JanelasContatoConfig = { barbearia: { dias: {} } };
    const l = lead({ busca: { nicho: "pizzaria", regiao: "x", em: "" }, endereco: "Rua X, Brasil" });
    expect(barraDoDia(janelas, l, instanteLocal(TERCA, 10, 0))).toBeUndefined();
  });
});

describe("linhaEstadoContato", () => {
  it("aberto e bom: diz que é a hora, sem prometer outra", () => {
    const l = barbearia([abertura(2, 9, 19)]);
    const barra = barraDoDia(DEFAULT_JANELAS_CONTATO, l, instanteLocal(TERCA, 10, 15))!;
    expect(linhaEstadoContato(barra)).toBe("Hora do lead 10h15 · agora: bom");
  });

  it("aberto e ruim: o próximo bom é amanhã", () => {
    const l = barbearia([abertura(2, 9, 19), abertura(3, 9, 19)]);
    const barra = barraDoDia(DEFAULT_JANELAS_CONTATO, l, instanteLocal(TERCA, 17, 0))!;
    expect(linhaEstadoContato(barra)).toBe("Hora do lead 17h · agora: ruim · próximo bom amanhã 9h");
  });

  it("fechado agora, abre mais tarde: aponta o bom de hoje mesmo", () => {
    const l = barbearia([abertura(2, 10, 19)]);
    const barra = barraDoDia(DEFAULT_JANELAS_CONTATO, l, instanteLocal(TERCA, 8, 30))!;
    expect(linhaEstadoContato(barra)).toBe("Hora do lead 8h30 · fechado agora · próximo bom hoje 10h");
  });
});
