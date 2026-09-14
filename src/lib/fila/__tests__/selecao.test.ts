import { describe, expect, it } from "vitest";

import type { CandidatoFila } from "../candidatos";
import { DEFAULT_FILA_CONFIG, type FilaConfig } from "../config";
import type { FilaContadorSnapshot } from "../contadores";
import { motivoDeRitmo, nichoPermitido, ordenarCandidatos } from "../selecao";
import { DEFAULT_JANELAS_CONTATO } from "@/lib/leads/janelaContato";

const TERCA_10H = new Date("2026-03-10T10:00:00Z"); // faixa "bom" da barbearia
const TERCA_12H = new Date("2026-03-10T12:00:00Z"); // aberto, sem faixa → "razoavel"
const TERCA_17H = new Date("2026-03-10T17:00:00Z"); // aberto, faixa "ruim" da barbearia (16h30-20h)
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

const JANELA_ZERADA = { razoavel: 0, ruim: 0, semNivel: 0 };

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

describe("ordenarCandidatos — escolhido", () => {
  it("na faixa boa, o candidato sai", () => {
    const { escolhido, diagnostico } = ordenar([candidato("a")]);

    expect(escolhido).toEqual([{ id: "a", nivel: "bom" }]);
    expect(diagnostico).toEqual({ nichoBarrado: 0, janela: JANELA_ZERADA });
  });

  it("razoável só entra com exigirJanelaBoa false", () => {
    expect(ordenar([candidato("a")], config(), TERCA_12H).escolhido).toEqual([]);
    expect(ordenar([candidato("a")], config({ exigirJanelaBoa: false }), TERCA_12H).escolhido).toEqual([
      { id: "a", nivel: "razoavel" },
    ]);
  });

  it("bom antes de razoável; dentro do nível, o mais antigo primeiro", () => {
    const pool = [
      candidato("razoavel-velho", { criadoEm: "2020-01-01T00:00:00.000Z" }),
      candidato("bom-novo", { criadoEm: "2026-03-09T00:00:00.000Z", offset: -180 }),
      candidato("bom-velho", { criadoEm: "2021-01-01T00:00:00.000Z", offset: -180 }),
    ];

    const { escolhido } = ordenar(pool, config({ exigirJanelaBoa: false }), TERCA_12H);

    expect(escolhido.map((c) => c.id)).toEqual(["bom-velho", "bom-novo", "razoavel-velho"]);
  });

  it("empate de criadoEm desempata por id — a ordem não depende do Firestore", () => {
    const { escolhido } = ordenar([candidato("z"), candidato("a"), candidato("m")]);

    expect(escolhido.map((c) => c.id)).toEqual(["a", "m", "z"]);
  });

  it("o horário de funcionamento REAL recorta a janela da família", () => {
    // Faixa boa da barbearia é 9h–11h30, mas este lead só abre às 11h.
    const soDeTarde = candidato("a", {
      faixas: [{ diaAbre: 2, horaAbre: 11, minAbre: 0, diaFecha: 2, horaFecha: 19, minFecha: 0 }],
    });

    expect(ordenar([soDeTarde], config(), TERCA_10H).escolhido).toEqual([]);
    expect(ordenar([soDeTarde], config(), new Date("2026-03-10T11:15:00Z")).escolhido).toEqual([
      { id: "a", nivel: "bom" },
    ]);
  });
});

describe("ordenarCandidatos — diagnóstico: nicho (etapa 3)", () => {
  it("nicho barrado incrementa nichoBarrado e não conta como janela", () => {
    const { escolhido, diagnostico } = ordenar(
      [candidato("a")],
      config({ nichosPermitidos: ["tatuagem"] }),
    );

    expect(escolhido).toEqual([]);
    expect(diagnostico).toEqual({ nichoBarrado: 1, janela: JANELA_ZERADA });
  });

  it("hoje não incrementa contador de janela nenhum (nicho é barrado antes de olhar a hora)", () => {
    // Fechado (TERCA_3H) e nicho barrado ao mesmo tempo: conta só em nichoBarrado.
    const { diagnostico } = ordenar(
      [candidato("a")],
      config({ nichosPermitidos: ["tatuagem"] }),
      TERCA_3H,
    );

    expect(diagnostico).toEqual({ nichoBarrado: 1, janela: JANELA_ZERADA });
  });
});

describe("ordenarCandidatos — diagnóstico: janela por nível (etapa 4)", () => {
  it("fechado na hora do lead conta em semNivel", () => {
    const { escolhido, diagnostico } = ordenar([candidato("a")], config(), TERCA_3H);

    expect(escolhido).toEqual([]);
    expect(diagnostico.janela).toEqual({ razoavel: 0, ruim: 0, semNivel: 1 });
  });

  it("com exigirJanelaBoa true, razoável conta em janela.razoavel", () => {
    const { escolhido, diagnostico } = ordenar([candidato("a")], config(), TERCA_12H);

    expect(escolhido).toEqual([]);
    expect(diagnostico.janela).toEqual({ razoavel: 1, ruim: 0, semNivel: 0 });
  });

  it("com exigirJanelaBoa false, o mesmo lead 'razoavel' sai da contagem de barrados e entra nos elegíveis", () => {
    const { escolhido, diagnostico } = ordenar(
      [candidato("a")],
      config({ exigirJanelaBoa: false }),
      TERCA_12H,
    );

    expect(escolhido).toEqual([{ id: "a", nivel: "razoavel" }]);
    expect(diagnostico.janela).toEqual(JANELA_ZERADA);
  });

  it("'ruim' não passa em nenhum dos dois estados, e conta em janela.ruim", () => {
    const comBoa = ordenar([candidato("a")], config(), TERCA_17H);
    expect(comBoa.escolhido).toEqual([]);
    expect(comBoa.diagnostico.janela).toEqual({ razoavel: 0, ruim: 1, semNivel: 0 });

    const semBoa = ordenar([candidato("a")], config({ exigirJanelaBoa: false }), TERCA_17H);
    expect(semBoa.escolhido).toEqual([]);
    expect(semBoa.diagnostico.janela).toEqual({ razoavel: 0, ruim: 1, semNivel: 0 });
  });

  it("distingue razoavel, ruim e semNivel no mesmo pool", () => {
    const pool = [
      candidato("razoavel", { offset: 0 }),
      candidato("ruim", { offset: 0, criadoEm: "2026-03-02T00:00:00.000Z" }),
      candidato("fechado", { offset: 0, criadoEm: "2026-03-03T00:00:00.000Z" }),
    ];

    // Um "now" só não serve pros três ao mesmo tempo (é o mesmo relógio para
    // todo o pool); a garantia que importa é que CADA nível cai no balde
    // certo quando é a vez dele.
    expect(ordenar([pool[0]], config(), TERCA_12H).diagnostico.janela).toEqual({
      razoavel: 1,
      ruim: 0,
      semNivel: 0,
    });
    expect(ordenar([pool[1]], config(), TERCA_17H).diagnostico.janela).toEqual({
      razoavel: 0,
      ruim: 1,
      semNivel: 0,
    });
    expect(ordenar([pool[2]], config(), TERCA_3H).diagnostico.janela).toEqual({
      razoavel: 0,
      ruim: 0,
      semNivel: 1,
    });
  });
});
