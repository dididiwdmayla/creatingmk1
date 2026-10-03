import { describe, expect, it } from "vitest";

import type { CandidatoFila } from "../candidatos";
import { DEFAULT_FILA_CONFIG, type FilaConfig } from "../config";
import { contadorComEnvio, contadorDoDoc, contadorNoInstante, type FilaContadorDoc } from "../contadores";
import {
  instanteDoMomento,
  ordenarCandidatos,
  proximaAberturaDeJanela,
  proximaSaida,
  type EstadoFila,
} from "../selecao";
import { DEFAULT_JANELAS_CONTATO } from "@/lib/leads/janelaContato";

/**
 * `proximaSaida` — QUEM SAI E QUANDO, a função que `/api/fila/proximo`
 * pergunta com o horizonte fechado em "agora" e a agenda da fila pergunta
 * com um relógio que anda. Barbearia (offset 0 salvo dito o contrário):
 * faixa "bom" 9h–11h30 de segunda a quinta; sem horário de funcionamento,
 * o expediente estimado é 9h–18h. 10/03/2026 é uma terça.
 */

const TERCA_3H = new Date("2026-03-10T03:00:00Z");
const TERCA_10H = new Date("2026-03-10T10:00:00Z");
const TERCA_12H = new Date("2026-03-10T12:00:00Z");
const FIM_DE_QUARTA = new Date("2026-03-12T03:00:00Z");

function config(overrides: Partial<FilaConfig> = {}): FilaConfig {
  return { ...DEFAULT_FILA_CONFIG, ...overrides };
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

function doc(overrides: Partial<FilaContadorDoc> = {}): FilaContadorDoc {
  return { ...contadorDoDoc(undefined), ...overrides };
}

function estado(
  pool: CandidatoFila[],
  overrides: { config?: FilaConfig; contadores?: Record<string, FilaContadorDoc> } = {},
): EstadoFila {
  return {
    config: overrides.config ?? config(),
    janelas: DEFAULT_JANELAS_CONTATO,
    pool,
    contadores: overrides.contadores ?? {},
  };
}

describe("proximaSaida — com o horizonte fechado em agora (o caso de /proximo)", () => {
  it("alguém em janela: sai AGORA, na ordem exata de ordenarCandidatos", () => {
    const pool = [
      candidato("b", { criadoEm: "2026-03-02T00:00:00.000Z" }),
      candidato("a"),
      candidato("m", { manual: true, criadoEm: "2026-03-05T00:00:00.000Z" }),
    ];

    const saida = proximaSaida(estado(pool), TERCA_10H, { ate: TERCA_10H });

    expect(saida.em).toEqual(TERCA_10H);
    expect(saida.fila).toEqual(
      ordenarCandidatos(pool, config(), DEFAULT_JANELAS_CONTATO, TERCA_10H).escolhido,
    );
    expect(saida.fila.map((c) => c.id)).toEqual(["m", "a", "b"]);
    expect(saida.motivoEmDesde).toBe("");
    expect(saida.segurou).toBeUndefined();
  });

  it("todo mundo dormindo: nada sai, fora_de_janela", () => {
    const saida = proximaSaida(estado([candidato("a")]), TERCA_3H, { ate: TERCA_3H });

    expect(saida.em).toBeUndefined();
    expect(saida.motivoEmDesde).toBe("fora_de_janela");
    expect(saida.diagnostico?.janela.semNivel).toBe(1);
  });

  it("pool vazio: sem_leads_elegiveis", () => {
    expect(proximaSaida(estado([]), TERCA_10H, { ate: TERCA_10H }).motivoEmDesde).toBe(
      "sem_leads_elegiveis",
    );
  });

  it("os portões de ritmo valem sobre o contador do dia operacional do instante", () => {
    const contadores = { "2026-03-10": doc({ enviados: 15, ultimoEventoEm: "2026-03-10T09:00:00.000Z" }) };

    const saida = proximaSaida(estado([candidato("a")], { contadores }), TERCA_10H, { ate: TERCA_10H });

    expect(saida.em).toBeUndefined();
    expect(saida.motivoEmDesde).toBe("meta_atingida");
  });
});

describe("proximaSaida — o relógio que anda (a agenda)", () => {
  it("fora de janela: sai no INÍCIO do minuto em que a faixa abre", () => {
    const desde = new Date("2026-03-10T06:40:37.250Z");

    const saida = proximaSaida(estado([candidato("a")]), desde, { ate: FIM_DE_QUARTA });

    expect(saida.em).toEqual(new Date("2026-03-10T09:00:00.000Z"));
    expect(saida.fila.map((c) => c.id)).toEqual(["a"]);
    expect(saida.motivoEmDesde).toBe("fora_de_janela");
    expect(saida.segurou).toBe("fora_de_janela");
  });

  it("lead em OUTRO fuso: a faixa abre às 9h DELE", () => {
    // UTC-3: 9h local = 12h UTC.
    const saida = proximaSaida(estado([candidato("sp", { offset: -180 })]), TERCA_3H, { ate: FIM_DE_QUARTA });

    expect(saida.em).toEqual(new Date("2026-03-10T12:00:00.000Z"));
  });

  it("dois fusos: sai primeiro quem abre primeiro, não quem é mais antigo", () => {
    const pool = [
      candidato("antigo-sp", { offset: -180, criadoEm: "2026-01-01T00:00:00.000Z" }),
      candidato("novo-lisboa", { offset: 0, criadoEm: "2026-03-05T00:00:00.000Z" }),
    ];

    const saida = proximaSaida(estado(pool), TERCA_3H, { ate: FIM_DE_QUARTA });

    expect(saida.em).toEqual(new Date("2026-03-10T09:00:00.000Z"));
    expect(saida.fila.map((c) => c.id)).toEqual(["novo-lisboa"]);
  });

  it("intervalo: sai quando o intervalo mínimo passa, contado do último evento", () => {
    const contadores = { "2026-03-10": doc({ enviados: 1, envios: ["2026-03-10T10:00:00.000Z"], ultimoEventoEm: "2026-03-10T10:00:00.000Z" }) };
    const cfg = config({ intervaloMinimoSegundos: 600 });

    const saida = proximaSaida(estado([candidato("a")], { config: cfg, contadores }), new Date("2026-03-10T10:01:00Z"), {
      ate: FIM_DE_QUARTA,
    });

    expect(saida.em).toEqual(new Date("2026-03-10T10:10:00.000Z"));
    expect(saida.motivoEmDesde).toBe("intervalo");
    expect(saida.segurou).toBe("intervalo");
  });

  it("teto por hora: sai quando o envio mais velho da janela deslizante sai dela", () => {
    const envios = ["2026-03-10T09:20:00.000Z", "2026-03-10T09:40:00.000Z", "2026-03-10T10:00:00.000Z"];
    const contadores = { "2026-03-10": doc({ enviados: 3, envios, ultimoEventoEm: envios[2] }) };
    const cfg = config({ tetoPorHora: 3, intervaloMinimoSegundos: 60 });

    const saida = proximaSaida(estado([candidato("a")], { config: cfg, contadores }), new Date("2026-03-10T10:05:00Z"), {
      ate: FIM_DE_QUARTA,
    });

    expect(saida.em).toEqual(new Date("2026-03-10T10:20:00.000Z"));
    expect(saida.segurou).toBe("teto_hora");
  });

  it("meta batida: o próximo dia operacional, e então a janela do lead", () => {
    const contadores = { "2026-03-10": doc({ enviados: 15 }) };

    const saida = proximaSaida(estado([candidato("a")], { contadores }), TERCA_10H, { ate: FIM_DE_QUARTA });

    // A virada (00h em São Paulo = 03h UTC) não abre a barbearia de offset 0:
    // quem segurou por último foi a janela, às 9h de quarta.
    expect(saida.em).toEqual(new Date("2026-03-11T09:00:00.000Z"));
    expect(saida.motivoEmDesde).toBe("meta_atingida");
    expect(saida.segurou).toBe("fora_de_janela");
  });

  it("a virada do dia operacional zera também o INTERVALO e o TETO (o doc novo nasce vazio)", () => {
    // 23h59 em São Paulo; a barbearia de UTC+6 está às 8h59 e abre às 9h.
    const ultimo = "2026-03-11T02:59:00.000Z";
    const contadores = { "2026-03-10": doc({ enviados: 1, envios: [ultimo], ultimoEventoEm: ultimo }) };
    const cfg = config({ intervaloMinimoSegundos: 3600, tetoPorHora: 1 });

    const saida = proximaSaida(
      estado([candidato("leste", { offset: 360 })], { config: cfg, contadores }),
      new Date(ultimo),
      { ate: FIM_DE_QUARTA },
    );

    // A fila real lê o doc do dia novo, vazio: nem o intervalo de 1h nem o
    // teto seguram depois da virada.
    expect(saida.em).toEqual(new Date("2026-03-11T03:00:00.000Z"));
  });

  it("pausada: nada sai em horizonte nenhum", () => {
    const saida = proximaSaida(estado([candidato("a")], { config: config({ ativo: false }) }), TERCA_3H, {
      ate: FIM_DE_QUARTA,
    });

    expect(saida.em).toBeUndefined();
    expect(saida.motivoEmDesde).toBe("pausado");
  });

  it("além do horizonte: nada sai, e o motivo é o de `desde`", () => {
    const saida = proximaSaida(estado([candidato("a")]), TERCA_3H, { ate: new Date("2026-03-10T08:59:59Z") });

    expect(saida.em).toBeUndefined();
    expect(saida.motivoEmDesde).toBe("fora_de_janela");
  });

  it("exigirJanelaBoa: com o razoável aceito, sai já; só com o bom, amanhã às 9h", () => {
    const pool = [candidato("a")];

    expect(
      proximaSaida(estado(pool, { config: config({ exigirJanelaBoa: false }) }), TERCA_12H, { ate: FIM_DE_QUARTA }).em,
    ).toEqual(TERCA_12H);
    expect(proximaSaida(estado(pool), TERCA_12H, { ate: FIM_DE_QUARTA }).em).toEqual(
      new Date("2026-03-11T09:00:00.000Z"),
    );
  });

  it("o barrado pelo NICHO não puxa o relógio — nenhuma janela o resolve", () => {
    const cfg = config({ nichosPermitidos: ["tatuagem"] });

    const saida = proximaSaida(estado([candidato("a")], { config: cfg }), TERCA_3H, { ate: FIM_DE_QUARTA });

    expect(saida.em).toBeUndefined();
    expect(saida.motivoEmDesde).toBe("sem_leads_elegiveis");
  });

  it("o MANUAL fura o nicho e puxa o relógio", () => {
    const cfg = config({ nichosPermitidos: ["tatuagem"] });

    const saida = proximaSaida(estado([candidato("a", { manual: true })], { config: cfg }), TERCA_3H, {
      ate: FIM_DE_QUARTA,
    });

    expect(saida.em).toEqual(new Date("2026-03-10T09:00:00.000Z"));
  });

  it("simulando o confirmar com contadorComEnvio, o intervalo empurra o seguinte", () => {
    const pool = [candidato("a"), candidato("b", { criadoEm: "2026-03-02T00:00:00.000Z" })];
    const primeira = proximaSaida(estado(pool), TERCA_10H, { ate: FIM_DE_QUARTA });
    expect(primeira.fila[0].id).toBe("a");

    const contadores = {
      "2026-03-10": contadorComEnvio(undefined, primeira.em as Date),
    };
    const segunda = proximaSaida(estado([pool[1]], { contadores }), TERCA_10H, { ate: FIM_DE_QUARTA });

    expect(segunda.em).toEqual(new Date(TERCA_10H.getTime() + 180_000));
    expect(segunda.fila.map((c) => c.id)).toEqual(["b"]);
  });
});

describe("instanteDoMomento", () => {
  it("o momento local vira instante no início do minuto, nos dois fusos", () => {
    const agora = new Date("2026-03-10T06:40:37.250Z");

    expect(instanteDoMomento({ offsetDias: 0, inicioMin: 9 * 60 }, 0, agora)).toEqual(
      new Date("2026-03-10T09:00:00.000Z"),
    );
    // UTC-3: agora são 3h40 lá; amanhã às 9h lá = 12h UTC de quarta.
    expect(instanteDoMomento({ offsetDias: 1, inicioMin: 9 * 60 }, -180, agora)).toEqual(
      new Date("2026-03-11T12:00:00.000Z"),
    );
  });
});

describe("proximaAberturaDeJanela", () => {
  it("a menor das próximas faixas aceitas, sempre DEPOIS de agora", () => {
    const pool = [candidato("sp", { offset: -180 }), candidato("lisboa", { offset: 0 })];

    expect(proximaAberturaDeJanela(pool, config(), DEFAULT_JANELAS_CONTATO, TERCA_3H)).toEqual(
      new Date("2026-03-10T09:00:00.000Z"),
    );
  });

  it("ninguém com faixa aceita nos próximos dias: undefined", () => {
    expect(proximaAberturaDeJanela([], config(), DEFAULT_JANELAS_CONTATO, TERCA_3H)).toBeUndefined();
  });
});

describe("contadorNoInstante", () => {
  it("última hora deslizante e segundos desde o último evento, sobre o doc já lido", () => {
    const d = doc({
      enviados: 3,
      envios: ["2026-03-10T08:30:00.000Z", "2026-03-10T09:15:00.000Z", "2026-03-10T09:50:00.000Z"],
      ultimoEventoEm: "2026-03-10T09:50:00.000Z",
    });

    expect(contadorNoInstante(d, TERCA_10H)).toMatchObject({
      enviados: 3,
      ultimaHora: 2,
      segundosDesdeUltimoEvento: 600,
    });
  });
});
