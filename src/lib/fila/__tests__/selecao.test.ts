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

/** Mesma seleção, pedindo a lista de bloqueados (o que o painel da /config faz). */
function ordenarComBloqueados(pool: CandidatoFila[], cfg = config(), now = TERCA_10H) {
  return ordenarCandidatos(pool, cfg, DEFAULT_JANELAS_CONTATO, now, { coletarBloqueados: true });
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
    expect(diagnostico).toEqual({ nichoBarrado: 0, janela: JANELA_ZERADA, bloqueados: [] });
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

describe("ordenarCandidatos — a SELEÇÃO MANUAL (`filaManual`)", () => {
  it("no mesmo nível de janela, o manual vem antes do natural mais antigo", () => {
    const pool = [
      candidato("natural-velho", { criadoEm: "2020-01-01T00:00:00.000Z" }),
      // O mais NOVO da base: pelo FIFO seria o último.
      candidato("manual-novo", { criadoEm: "2026-03-09T00:00:00.000Z", manual: true }),
    ];

    expect(ordenar(pool).escolhido.map((c) => c.id)).toEqual(["manual-novo", "natural-velho"]);
  });

  it("dois manuais entre si voltam ao FIFO, com desempate por id", () => {
    const pool = [
      candidato("m-novo", { criadoEm: "2026-03-09T00:00:00.000Z", manual: true }),
      candidato("m-velho-z", { criadoEm: "2020-01-01T00:00:00.000Z", manual: true }),
      candidato("m-velho-a", { criadoEm: "2020-01-01T00:00:00.000Z", manual: true }),
    ];

    expect(ordenar(pool).escolhido.map((c) => c.id)).toEqual([
      "m-velho-a",
      "m-velho-z",
      "m-novo",
    ]);
  });

  it("manual em 'razoavel' NÃO passa na frente de natural em 'bom' — o nível vem primeiro", () => {
    const pool = [
      // TERCA_12H: sem offset é "razoavel"; com offset -180 é 9h local, "bom".
      candidato("manual-razoavel", { manual: true }),
      candidato("natural-bom", { offset: -180, criadoEm: "2026-03-09T00:00:00.000Z" }),
    ];

    const { escolhido } = ordenar(pool, config({ exigirJanelaBoa: false }), TERCA_12H);

    expect(escolhido).toEqual([
      { id: "natural-bom", nivel: "bom" },
      { id: "manual-razoavel", nivel: "razoavel" },
    ]);
  });

  it("fura o nicho permitido — e não conta como barrado no funil", () => {
    const pool = [candidato("manual", { manual: true }), candidato("natural")];

    const { escolhido, diagnostico } = ordenar(pool, config({ nichosPermitidos: ["tatuagem"] }));

    expect(escolhido).toEqual([{ id: "manual", nivel: "bom" }]);
    // O natural barrou; o manual não foi barrado, então não pode aparecer
    // como barrado.
    expect(diagnostico.nichoBarrado).toBe(1);
  });

  it("NÃO fura a janela: manual fechado agora fica bloqueado como qualquer outro", () => {
    const { escolhido, diagnostico } = ordenarComBloqueados(
      [candidato("manual", { manual: true })],
      config(),
      TERCA_3H,
    );

    expect(escolhido).toEqual([]);
    expect(diagnostico.janela).toEqual({ razoavel: 0, ruim: 0, semNivel: 1 });
    expect(diagnostico.bloqueados).toEqual([{ id: "manual" }]);
  });

  it("manual fora do nicho e fora da janela conta na JANELA, não no nicho", () => {
    // Prova a ordem das etapas para quem furou o nicho: ele chega à janela.
    const { diagnostico } = ordenar(
      [candidato("manual", { manual: true })],
      config({ nichosPermitidos: ["tatuagem"] }),
      TERCA_3H,
    );

    expect(diagnostico.nichoBarrado).toBe(0);
    expect(diagnostico.janela).toEqual({ razoavel: 0, ruim: 0, semNivel: 1 });
  });

  it("`manual` ausente (pool gravado antes deste campo) é lido como não-manual", () => {
    const pool = [
      candidato("sem-campo", { criadoEm: "2026-03-09T00:00:00.000Z" }),
      candidato("velho", { criadoEm: "2020-01-01T00:00:00.000Z" }),
    ];

    expect(ordenar(pool).escolhido.map((c) => c.id)).toEqual(["velho", "sem-campo"]);
  });
});

describe("ordenarCandidatos — diagnóstico: nicho (etapa 3)", () => {
  it("nicho barrado incrementa nichoBarrado e não conta como janela", () => {
    const { escolhido, diagnostico } = ordenar(
      [candidato("a")],
      config({ nichosPermitidos: ["tatuagem"] }),
    );

    expect(escolhido).toEqual([]);
    expect(diagnostico).toEqual({ nichoBarrado: 1, janela: JANELA_ZERADA, bloqueados: [] });
  });

  it("hoje não incrementa contador de janela nenhum (nicho é barrado antes de olhar a hora)", () => {
    // Fechado (TERCA_3H) e nicho barrado ao mesmo tempo: conta só em nichoBarrado.
    const { diagnostico } = ordenar(
      [candidato("a")],
      config({ nichosPermitidos: ["tatuagem"] }),
      TERCA_3H,
    );

    expect(diagnostico).toEqual({ nichoBarrado: 1, janela: JANELA_ZERADA, bloqueados: [] });
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

/**
 * A LISTA de bloqueados, não só a contagem — o painel da /config mostra
 * nome por nome. Fica opt-in porque `/proximo` roda de minuto em minuto e
 * não tem o que fazer com ela.
 */
describe("ordenarCandidatos — bloqueados (opt-in)", () => {
  it("sem pedir, a lista vem vazia mesmo havendo bloqueado — /proximo não paga por ela", () => {
    const { diagnostico } = ordenar([candidato("a")], config(), TERCA_3H);

    expect(diagnostico.janela.semNivel).toBe(1);
    expect(diagnostico.bloqueados).toEqual([]);
  });

  it("pedindo, devolve id e o nível de agora", () => {
    const { diagnostico } = ordenarComBloqueados([candidato("a")], config(), TERCA_12H);

    expect(diagnostico.bloqueados).toEqual([{ id: "a", nivel: "razoavel" }]);
  });

  it("fechado na hora do lead entra SEM nível — é o que a tela precisa distinguir", () => {
    const { diagnostico } = ordenarComBloqueados([candidato("a")], config(), TERCA_3H);

    expect(diagnostico.bloqueados).toEqual([{ id: "a" }]);
  });

  it("a lista bate com a contagem, e na ordem justa (mais antigo primeiro)", () => {
    const pool = [
      candidato("novo", { criadoEm: "2026-03-05T00:00:00.000Z" }),
      candidato("velho", { criadoEm: "2020-01-01T00:00:00.000Z" }),
      candidato("meio", { criadoEm: "2023-01-01T00:00:00.000Z" }),
    ];

    const { diagnostico } = ordenarComBloqueados(pool, config(), TERCA_17H);

    expect(diagnostico.bloqueados.map((b) => b.id)).toEqual(["velho", "meio", "novo"]);
    expect(diagnostico.bloqueados).toHaveLength(diagnostico.janela.ruim);
  });

  it("empate de criadoEm desempata por id — a ordem não depende do Firestore", () => {
    const pool = ["z", "a", "m"].map((id) => candidato(id));

    const { diagnostico } = ordenarComBloqueados(pool, config(), TERCA_3H);

    expect(diagnostico.bloqueados.map((b) => b.id)).toEqual(["a", "m", "z"]);
  });

  it("barrado por NICHO não entra em bloqueados — parou numa etapa antes da janela", () => {
    const { diagnostico } = ordenarComBloqueados(
      [candidato("a")],
      config({ nichosPermitidos: ["tatuagem"] }),
      TERCA_3H,
    );

    expect(diagnostico.nichoBarrado).toBe(1);
    expect(diagnostico.bloqueados).toEqual([]);
  });

  it("elegível não entra em bloqueados", () => {
    const { escolhido, diagnostico } = ordenarComBloqueados([candidato("a")]);

    expect(escolhido).toEqual([{ id: "a", nivel: "bom" }]);
    expect(diagnostico.bloqueados).toEqual([]);
  });

  it("desmarcar exigirJanelaBoa move o razoável de bloqueado para elegível", () => {
    const comExigencia = ordenarComBloqueados([candidato("a")], config(), TERCA_12H);
    expect(comExigencia.diagnostico.bloqueados).toEqual([{ id: "a", nivel: "razoavel" }]);

    const semExigencia = ordenarComBloqueados(
      [candidato("a")],
      config({ exigirJanelaBoa: false }),
      TERCA_12H,
    );
    expect(semExigencia.diagnostico.bloqueados).toEqual([]);
    expect(semExigencia.escolhido).toEqual([{ id: "a", nivel: "razoavel" }]);
  });
});
