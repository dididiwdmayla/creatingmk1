import { describe, expect, it } from "vitest";

import type { CandidatoFila } from "../candidatos";
import { DEFAULT_FILA_CONFIG, type FilaConfig } from "../config";
import type { FilaContadorSnapshot } from "../contadores";
import { motivoDeRitmo, nichoPermitido, ordenarCandidatos } from "../selecao";
import { DEFAULT_JANELAS_CONTATO } from "@/lib/leads/janelaContato";

const TERCA_10H = new Date("2026-03-10T10:00:00Z"); // faixa "bom" da barbearia
const TERCA_12H = new Date("2026-03-10T12:00:00Z"); // aberto, sem faixa → "razoavel"
const TERCA_3H = new Date("2026-03-10T03:00:00Z"); // fechado

function config(overrides: Partial<FilaConfig> = {}): FilaConfig {
  return { ...DEFAULT_FILA_CONFIG, ...overrides };
}

function contador(overrides: Partial<FilaContadorSnapshot> = {}): FilaContadorSnapshot {
  return { totalDoDia: 0, ultimaHora: 0, segundosDesdeUltimoEvento: null, ...overrides };
}

function candidato(id: string, overrides: Partial<CandidatoFila> = {}): CandidatoFila {
  return {
    id,
    nicho: "barbearia",
    offset: 0,
    faixas: [],
    criadoEm: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function ordenar(pool: CandidatoFila[], cfg = config(), now = TERCA_10H) {
  return ordenarCandidatos(pool, cfg, DEFAULT_JANELAS_CONTATO, now);
}

describe("motivoDeRitmo — os portões que não custam lead nenhum", () => {
  it("fila ativa e contadores zerados: nenhum motivo", () => {
    expect(motivoDeRitmo(config(), contador())).toBeUndefined();
  });

  it("a pausa vem antes de tudo", () => {
    expect(
      motivoDeRitmo(config({ ativo: false }), contador({ totalDoDia: 999, ultimaHora: 999 })),
    ).toBe("pausado");
  });

  it("meta do dia atingida", () => {
    expect(motivoDeRitmo(config({ metaDiaria: 3 }), contador({ totalDoDia: 3 }))).toBe(
      "meta_atingida",
    );
  });

  it("teto da hora atingido", () => {
    expect(motivoDeRitmo(config({ tetoPorHora: 2 }), contador({ ultimaHora: 2 }))).toBe(
      "teto_hora",
    );
  });

  it("intervalo mínimo ainda não passou", () => {
    expect(
      motivoDeRitmo(
        config({ intervaloMinimoSegundos: 180 }),
        contador({ segundosDesdeUltimoEvento: 179 }),
      ),
    ).toBe("intervalo");
  });

  it("no segundo exato do intervalo já libera", () => {
    expect(
      motivoDeRitmo(
        config({ intervaloMinimoSegundos: 180 }),
        contador({ segundosDesdeUltimoEvento: 180 }),
      ),
    ).toBeUndefined();
  });

  it("nunca houve envio: o intervalo não barra", () => {
    expect(
      motivoDeRitmo(config({ intervaloMinimoSegundos: 999 }), contador({ segundosDesdeUltimoEvento: null })),
    ).toBeUndefined();
  });
});

describe("nichoPermitido", () => {
  it("lista vazia libera tudo", () => {
    expect(nichoPermitido("qualquer coisa", [])).toBe(true);
    expect(nichoPermitido("", [])).toBe(true);
  });

  it("casa por substring, como a família do lead", () => {
    expect(nichoPermitido("barbearia masculina", ["barbearia"])).toBe(true);
    expect(nichoPermitido("barbearia masculina", ["Barbearia"])).toBe(true); // normaliza
  });

  it("nicho de fora da lista não passa", () => {
    expect(nichoPermitido("petshop", ["barbearia", "tatuagem"])).toBe(false);
  });

  it("lead sem nicho não passa quando há lista — não dá para provar que é permitido", () => {
    expect(nichoPermitido("", ["barbearia"])).toBe(false);
  });
});

describe("ordenarCandidatos", () => {
  it("na faixa boa, o candidato sai", () => {
    const { elegiveis, foraDeJanela } = ordenar([candidato("a")]);

    expect(elegiveis).toEqual([{ id: "a", nivel: "bom" }]);
    expect(foraDeJanela).toBe(0);
  });

  it("fechado na hora do lead conta como fora de janela, não some", () => {
    const { elegiveis, foraDeJanela } = ordenar([candidato("a")], config(), TERCA_3H);

    expect(elegiveis).toEqual([]);
    expect(foraDeJanela).toBe(1);
  });

  it("razoável só entra com exigirJanelaBoa false", () => {
    expect(ordenar([candidato("a")], config(), TERCA_12H).elegiveis).toEqual([]);
    expect(ordenar([candidato("a")], config({ exigirJanelaBoa: false }), TERCA_12H).elegiveis).toEqual([
      { id: "a", nivel: "razoavel" },
    ]);
  });

  it("nicho barrado não conta como fora de janela (é outro problema)", () => {
    const { elegiveis, foraDeJanela } = ordenar(
      [candidato("a")],
      config({ nichosPermitidos: ["tatuagem"] }),
    );

    expect(elegiveis).toEqual([]);
    expect(foraDeJanela).toBe(0);
  });

  it("bom antes de razoável; dentro do nível, o mais antigo primeiro", () => {
    const pool = [
      candidato("razoavel-velho", { criadoEm: "2020-01-01T00:00:00.000Z" }),
      candidato("bom-novo", { criadoEm: "2026-03-09T00:00:00.000Z", offset: -180 }),
      candidato("bom-velho", { criadoEm: "2021-01-01T00:00:00.000Z", offset: -180 }),
    ];

    const { elegiveis } = ordenar(pool, config({ exigirJanelaBoa: false }), TERCA_12H);

    expect(elegiveis.map((c) => c.id)).toEqual(["bom-velho", "bom-novo", "razoavel-velho"]);
  });

  it("empate de criadoEm desempata por id — a ordem não depende do Firestore", () => {
    const { elegiveis } = ordenar([candidato("z"), candidato("a"), candidato("m")]);

    expect(elegiveis.map((c) => c.id)).toEqual(["a", "m", "z"]);
  });

  it("o horário de funcionamento REAL recorta a janela da família", () => {
    // Faixa boa da barbearia é 9h–11h30, mas este lead só abre às 11h.
    const soDeTarde = candidato("a", {
      faixas: [{ diaAbre: 2, horaAbre: 11, minAbre: 0, diaFecha: 2, horaFecha: 19, minFecha: 0 }],
    });

    expect(ordenar([soDeTarde], config(), TERCA_10H).elegiveis).toEqual([]);
    expect(ordenar([soDeTarde], config(), new Date("2026-03-10T11:15:00Z")).elegiveis).toEqual([
      { id: "a", nivel: "bom" },
    ]);
  });
});
