import { describe, expect, it } from "vitest";

import {
  DEFAULT_JANELAS_CONTATO,
  familiaDoLead,
  horarioLocalNoDisparo,
  linhaRecomendacaoContato,
  utcOffsetDoLead,
  validarJanelasContato,
  type JanelasContatoConfig,
} from "../janelaContato";
import type { Lead } from "../types";

type Faixa = NonNullable<Lead["horarios"]>["faixas"][number];

function faixaAbertura(dia: number, horaAbre: number, horaFecha: number): Faixa {
  return { diaAbre: dia, horaAbre, minAbre: 0, diaFecha: dia, horaFecha, minFecha: 0 };
}

// Mesmas âncoras de horarios.test.ts: 2026-07-21 é terça.
const TERCA = "2026-07-21";
const QUARTA = "2026-07-22";
const SEXTA = "2026-07-24";
const SABADO = "2026-07-25";

/** Instante UTC correspondente a `hora:min` LOCAL (-180, Brasília) na data informada. */
function instanteLocal(data: string, hora: number, min = 0): Date {
  const utcHora = hora + 3; // -180 => local = UTC-3, então UTC = local+3
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

/** Fuso conhecido (-180, Brasília), sem horário de funcionamento declarado. */
function comFuso(overrides: Partial<Lead> = {}): Lead {
  return lead({
    horarios: { faixas: [], utcOffsetMinutes: -180, obtidoEm: "2026-01-01T00:00:00.000Z" },
    ...overrides,
  });
}

describe("familiaDoLead", () => {
  it("casa por substring normalizada do nicho da busca", () => {
    expect(familiaDoLead(lead({ busca: { nicho: "Salão de beleza e Barbearia Vintage", regiao: "x", em: "" } }))).toBe(
      "barbearia",
    );
    expect(familiaDoLead(lead({ busca: { nicho: "  TATUAGEM  ", regiao: "x", em: "" } }))).toBe("tatuagem");
  });

  it("nicho sem família conhecida ou lead sem busca → genérico", () => {
    expect(familiaDoLead(lead({ busca: { nicho: "Pizzaria do Zé", regiao: "x", em: "" } }))).toBe("generico");
    expect(familiaDoLead(lead())).toBe("generico");
  });
});

describe("utcOffsetDoLead", () => {
  it("horarios.utcOffsetMinutes vence, mesmo com endereço de outro país", () => {
    const l = lead({
      endereco: "Rua X, 123, Lisboa, Portugal",
      horarios: { faixas: [], utcOffsetMinutes: -180, obtidoEm: "2026-01-01T00:00:00.000Z" },
    });
    expect(utcOffsetDoLead(l)).toBe(-180);
  });

  it("sem horarios, deriva do país do endereço quando reconhecível", () => {
    expect(utcOffsetDoLead(lead({ endereco: "Rua X, 123, São Paulo, Brasil" }))).toBe(-180);
    expect(utcOffsetDoLead(lead({ endereco: "Rua X, 123, Lisboa, Portugal" }))).toBe(0);
  });

  it("sem horarios e sem país reconhecível/endereço → undefined", () => {
    expect(utcOffsetDoLead(lead({ endereco: "Rua X, 123, Nárnia" }))).toBeUndefined();
    expect(utcOffsetDoLead(lead())).toBeUndefined();
  });
});

describe("linhaRecomendacaoContato", () => {
  it("sem deslocamento UTC conhecido → undefined, nunca hora errada", () => {
    expect(linhaRecomendacaoContato(DEFAULT_JANELAS_CONTATO, lead())).toBeUndefined();
  });

  it("janela ideal de hoje, ainda não passou", () => {
    const l = comFuso({ busca: { nicho: "barbearia", regiao: "x", em: "" } });
    const linha = linhaRecomendacaoContato(DEFAULT_JANELAS_CONTATO, l, instanteLocal(TERCA, 8, 0));
    expect(linha).toBe("Hoje: 9h30–11h");
  });

  it("janela ideal já passou e a família não tem alternativa → pula pro próximo dia", () => {
    const l = comFuso({ busca: { nicho: "barbearia", regiao: "x", em: "" } });
    // Terça 12h: ideal (9h30-11h) já passou, sem alternativa — próximo dia útil é amanhã (quarta).
    const linha = linhaRecomendacaoContato(DEFAULT_JANELAS_CONTATO, l, instanteLocal(TERCA, 12, 0));
    expect(linha).toBe("Amanhã: 9h30–11h");
  });

  it("janela ideal já passou, mas a alternativa do mesmo dia ainda não", () => {
    const l = comFuso({ busca: { nicho: "imobiliaria", regiao: "x", em: "" } });
    const linha = linhaRecomendacaoContato(DEFAULT_JANELAS_CONTATO, l, instanteLocal(TERCA, 12, 0));
    expect(linha).toBe("Hoje: 16h–17h");
  });

  it("fim de semana desmarcado: pula sábado e domingo até a próxima segunda", () => {
    const l = comFuso({ busca: { nicho: "barbearia", regiao: "x", em: "" } });
    const linha = linhaRecomendacaoContato(DEFAULT_JANELAS_CONTATO, l, instanteLocal(SABADO, 10, 0));
    expect(linha).toBe("Segunda: 9h30–11h");
  });

  it("sexta é pouco indicada mas ainda conta como dia disponível", () => {
    const l = comFuso({ busca: { nicho: "barbearia", regiao: "x", em: "" } });
    const linha = linhaRecomendacaoContato(DEFAULT_JANELAS_CONTATO, l, instanteLocal(SEXTA, 8, 0));
    expect(linha).toBe("Hoje: 9h30–11h");
  });

  it("cruza com o horário de funcionamento: mostra a interseção quando existe", () => {
    const l = lead({
      busca: { nicho: "barbearia", regiao: "x", em: "" },
      horarios: {
        faixas: [faixaAbertura(2, 10, 18)], // terça: abre só às 10h
        utcOffsetMinutes: -180,
        obtidoEm: "2026-01-01T00:00:00.000Z",
      },
    });
    const linha = linhaRecomendacaoContato(DEFAULT_JANELAS_CONTATO, l, instanteLocal(TERCA, 8, 0));
    expect(linha).toBe("Hoje: 10h–11h");
  });

  it("sem interseção com o horário declarado: mostra a janela da família e sinaliza", () => {
    const l = lead({
      busca: { nicho: "barbearia", regiao: "x", em: "" },
      horarios: {
        faixas: [faixaAbertura(2, 18, 22)], // terça: só abre à noite
        utcOffsetMinutes: -180,
        obtidoEm: "2026-01-01T00:00:00.000Z",
      },
    });
    const linha = linhaRecomendacaoContato(DEFAULT_JANELAS_CONTATO, l, instanteLocal(TERCA, 8, 0));
    expect(linha).toBe("Hoje: 9h30–11h (fora do horário do estabelecimento)");
  });

  it("família sem nenhum dia disponível → undefined", () => {
    const janelas: JanelasContatoConfig = {
      generico: {
        ideal: { inicio: { hora: 9, minuto: 0 }, fim: { hora: 10, minuto: 0 } },
        dias: { 0: "indisponivel", 1: "indisponivel", 2: "indisponivel", 3: "indisponivel", 4: "indisponivel", 5: "indisponivel", 6: "indisponivel" },
      },
    };
    const linha = linhaRecomendacaoContato(janelas, lead(), instanteLocal(TERCA, 8, 0));
    expect(linha).toBeUndefined();
  });
});

describe("horarioLocalNoDisparo", () => {
  it("registra hora e dia local quando o fuso é conhecido", () => {
    const l = lead({ horarios: { faixas: [], utcOffsetMinutes: -180, obtidoEm: "2026-01-01T00:00:00.000Z" } });
    expect(horarioLocalNoDisparo(l, instanteLocal(QUARTA, 14, 30))).toEqual({
      horaLocalLead: "14:30",
      diaSemanaLocalLead: 3,
    });
  });

  it("sem fuso conhecido → objeto vazio, nunca hora errada", () => {
    expect(horarioLocalNoDisparo(lead())).toEqual({});
  });
});

describe("validarJanelasContato", () => {
  it("a config padrão é válida", () => {
    const problemas: string[] = [];
    validarJanelasContato(DEFAULT_JANELAS_CONTATO, "janelasContato", problemas);
    expect(problemas).toEqual([]);
  });

  it("acusa janela ideal ausente, hora fora de faixa e fim ≤ início", () => {
    const problemas: string[] = [];
    validarJanelasContato(
      {
        barbearia: { dias: { 1: "recomendado" } },
        lancheria: {
          ideal: { inicio: { hora: 25, minuto: 0 }, fim: { hora: 10, minuto: 0 } },
          dias: { 1: "recomendado" },
        },
        tatuagem: {
          ideal: { inicio: { hora: 10, minuto: 0 }, fim: { hora: 9, minuto: 0 } },
          dias: { 1: "abre-sempre" },
        },
      },
      "janelasContato",
      problemas,
    );
    expect(problemas.some((p) => p.includes("barbearia.ideal") && p.includes("obrigatória"))).toBe(true);
    expect(problemas.some((p) => p.includes("lancheria.ideal.inicio.hora"))).toBe(true);
    expect(problemas.some((p) => p.includes("tatuagem.ideal") && p.includes("fim deve ser depois"))).toBe(true);
    expect(problemas.some((p) => p.includes("tatuagem.dias.1"))).toBe(true);
  });
});
