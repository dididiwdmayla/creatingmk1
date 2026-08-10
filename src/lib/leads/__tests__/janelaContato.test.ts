import { describe, expect, it } from "vitest";

import {
  DEFAULT_JANELAS_CONTATO,
  faixasDoDia,
  familiaDoLead,
  horarioLocalNoDisparo,
  mesclarJanelasContato,
  utcOffsetDoLead,
  validarJanelasContato,
  type FamiliaJanelaContato,
} from "../janelaContato";
import type { Lead } from "../types";

// Mesmas âncoras de horarios.test.ts: 2026-07-21 é terça.
const QUARTA = "2026-07-22";

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

describe("tabela padrão de faixas por família", () => {
  it("barbearia: manhã boa, fim de tarde ruim (o movimento deles)", () => {
    const terca = faixasDoDia(DEFAULT_JANELAS_CONTATO.barbearia, 2);
    expect(terca.map((f) => [f.inicio.hora, f.fim.hora, f.nivel])).toEqual([
      [9, 11, "bom"],
      [16, 20, "ruim"],
    ]);
  });

  it("barbearia: sábado inteiro é ruim — a exceção ao fim de semana desmarcado", () => {
    expect(faixasDoDia(DEFAULT_JANELAS_CONTATO.barbearia, 6)).toEqual([
      { inicio: { hora: 9, minuto: 0 }, fim: { hora: 20, minuto: 0 }, nivel: "ruim" },
    ]);
  });

  it("lancheria: picos de almoço e janta ruins, meio da tarde bom", () => {
    expect(faixasDoDia(DEFAULT_JANELAS_CONTATO.lancheria, 3).map((f) => f.nivel)).toEqual([
      "ruim",
      "bom",
      "ruim",
    ]);
  });

  it("tatuagem começo de tarde; imobiliária, petshop e multimarcas com seus bons", () => {
    expect(faixasDoDia(DEFAULT_JANELAS_CONTATO.tatuagem, 1)).toEqual([
      { inicio: { hora: 13, minuto: 0 }, fim: { hora: 15, minuto: 0 }, nivel: "bom" },
    ]);
    expect(faixasDoDia(DEFAULT_JANELAS_CONTATO.imobiliaria, 1).map((f) => f.inicio.hora)).toEqual([9, 14]);
    expect(faixasDoDia(DEFAULT_JANELAS_CONTATO.petshop, 1)[0].nivel).toBe("bom");
    expect(faixasDoDia(DEFAULT_JANELAS_CONTATO.multimarcas, 1)[0].inicio.hora).toBe(14);
  });

  it("sexta vale menos: os bons de segunda-quinta viram razoáveis, os ruins seguem ruins", () => {
    for (const familia of Object.values(DEFAULT_JANELAS_CONTATO)) {
      expect(faixasDoDia(familia, 5).some((f) => f.nivel === "bom")).toBe(false);
      const ruinsQuinta = faixasDoDia(familia, 4).filter((f) => f.nivel === "ruim").length;
      expect(faixasDoDia(familia, 5).filter((f) => f.nivel === "ruim")).toHaveLength(ruinsQuinta);
    }
  });

  it("fim de semana desmarcado em todas as famílias, exceto o sábado da barbearia", () => {
    for (const [id, familia] of Object.entries(DEFAULT_JANELAS_CONTATO)) {
      expect(faixasDoDia(familia, 0), `${id} domingo`).toEqual([]);
      if (id !== "barbearia") expect(faixasDoDia(familia, 6), `${id} sábado`).toEqual([]);
    }
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

  it("acusa dia inválido, hora fora de faixa, fim ≤ início e nível desconhecido", () => {
    const problemas: string[] = [];
    validarJanelasContato(
      {
        barbearia: { dias: { 9: [] } },
        lancheria: {
          dias: { 1: [{ inicio: { hora: 25, minuto: 0 }, fim: { hora: 10, minuto: 0 }, nivel: "bom" }] },
        },
        tatuagem: {
          dias: { 1: [{ inicio: { hora: 10, minuto: 0 }, fim: { hora: 9, minuto: 0 }, nivel: "otimo" }] },
        },
        petshop: { dias: { 1: {} } },
      },
      "janelasContato",
      problemas,
    );
    expect(problemas.some((p) => p.includes("barbearia.dias.9"))).toBe(true);
    expect(problemas.some((p) => p.includes("lancheria.dias.1[0].inicio.hora"))).toBe(true);
    expect(problemas.some((p) => p.includes("tatuagem.dias.1[0]") && p.includes("fim deve ser depois"))).toBe(true);
    expect(problemas.some((p) => p.includes("tatuagem.dias.1[0].nivel"))).toBe(true);
    expect(problemas.some((p) => p.includes("petshop.dias.1") && p.includes("lista"))).toBe(true);
  });

  it("acusa faixas sobrepostas no mesmo dia (o nível do minuto deixaria de ser determinístico)", () => {
    const problemas: string[] = [];
    validarJanelasContato(
      {
        generico: {
          dias: {
            1: [
              { inicio: { hora: 9, minuto: 0 }, fim: { hora: 12, minuto: 0 }, nivel: "bom" },
              { inicio: { hora: 11, minuto: 0 }, fim: { hora: 13, minuto: 0 }, nivel: "ruim" },
            ],
          },
        },
      },
      "janelasContato",
      problemas,
    );
    expect(problemas).toEqual(["janelasContato.generico.dias.1: faixas sobrepostas no mesmo dia"]);
  });

  it("faixas coladas (11h termina, 11h começa) não são sobreposição", () => {
    const problemas: string[] = [];
    validarJanelasContato(
      {
        generico: {
          dias: {
            1: [
              { inicio: { hora: 9, minuto: 0 }, fim: { hora: 11, minuto: 0 }, nivel: "bom" },
              { inicio: { hora: 11, minuto: 0 }, fim: { hora: 13, minuto: 0 }, nivel: "ruim" },
            ],
          },
        },
      },
      "janelasContato",
      problemas,
    );
    expect(problemas).toEqual([]);
  });
});

describe("mesclarJanelasContato", () => {
  const nova: FamiliaJanelaContato = {
    dias: { 1: [{ inicio: { hora: 8, minuto: 0 }, fim: { hora: 9, minuto: 0 }, nivel: "bom" }] },
  };

  it("família válida do doc vence o padrão; as outras seguem no padrão", () => {
    const saida = mesclarJanelasContato(DEFAULT_JANELAS_CONTATO, { barbearia: nova });
    expect(saida.barbearia).toEqual(nova);
    expect(saida.lancheria).toEqual(DEFAULT_JANELAS_CONTATO.lancheria);
  });

  it("doc no formato ANTIGO (janela ideal/alternativa) cai no padrão novo, não quebra a barra", () => {
    const antigo = {
      barbearia: {
        ideal: { inicio: { hora: 9, minuto: 30 }, fim: { hora: 11, minuto: 0 } },
        dias: { 1: "recomendado", 5: "poucoIndicado", 6: "indisponivel" },
      },
    };
    const saida = mesclarJanelasContato(DEFAULT_JANELAS_CONTATO, antigo);
    expect(saida.barbearia).toEqual(DEFAULT_JANELAS_CONTATO.barbearia);
  });

  it("valor que nem objeto é → padrão inteiro", () => {
    expect(mesclarJanelasContato(DEFAULT_JANELAS_CONTATO, "nada")).toEqual(DEFAULT_JANELAS_CONTATO);
  });
});
