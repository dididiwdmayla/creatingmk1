import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { momentoFimIntervalo, momentoFimTetoHora, proximaViradaDiaOperacional } from "@/lib/fila/contadores";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import type { Lead } from "@/lib/leads/types";
import { GET as proximoGET } from "../fila/proximo/route";
import { GET as resumoGET } from "../fila/resumo/route";

/**
 * `GET /api/fila/resumo` — o retrato que a macro pequena do desbloqueio de
 * tela lê. O que estes testes protegem, acima de tudo: a rota NUNCA reserva
 * (não é uma segunda porta para `/proximo`), e `motivoAtual`/`proximaJanela`
 * dizem a mesma verdade que `/proximo` diria no mesmo instante — nunca uma
 * hora plausível e errada quando quem bloqueia é RITMO, não janela.
 */

const CHAVE = "chave-do-celular";

/** Terça 10h, offset 0: dentro do "bom" da barbearia (9h–11h30). */
const TERCA_10H = new Date("2026-03-10T10:00:00Z");
/** Terça 3h: fechado (estimado 9h–18h) — fora de janela para qualquer nicho. */
const TERCA_3H = new Date("2026-03-10T03:00:00Z");
/** Terça 8h: fechado, mas a 1h de abrir. */
const TERCA_8H = new Date("2026-03-10T08:00:00Z");

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    busca: { nicho: "barbearia", regiao: "Maringá", em: "2026-03-01T00:00:00.000Z" },
    demo: { skinId: "barbearia-editorial" },
    horarios: { faixas: [], utcOffsetMinutes: 0, obtidoEm: "2026-03-01T00:00:00.000Z" },
    capturas: {
      estado: "pronto",
      execucaoId: "exec-1",
      pedidoEm: "2026-03-01T00:00:00.000Z",
      imagens: [
        { ancora: "hero", tela: "celular", ordem: 1, url: "https://storage/hero-cel.png", largura: 780, altura: 1688 },
      ],
    },
    criadoEm: "2026-03-01T00:00:00.000Z",
    atualizadoEm: "2026-03-01T00:00:00.000Z",
    ...overrides,
  } as Lead;
}

function semear(...leads: Lead[]) {
  for (const l of leads) db.seed(`leads/${l.placeId}`, l as unknown as Record<string, unknown>);
}

function resumo(headers: Record<string, string> = { authorization: `Bearer ${CHAVE}` }) {
  return resumoGET(new Request("http://localhost/api/fila/resumo", { headers }));
}

function proximo(headers: Record<string, string> = { authorization: `Bearer ${CHAVE}` }) {
  return proximoGET(new Request("http://localhost/api/fila/proximo", { headers }));
}

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("RADAR_DEVICE_KEY", CHAVE);
  vi.useFakeTimers();
  vi.setSystemTime(TERCA_10H);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("GET /api/fila/resumo — autenticação", () => {
  it("sem a chave correta devolve 401", async () => {
    const res = await resumo({ authorization: "Bearer errada" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ erro: "nao_autorizado" });
  });

  it("sem header nenhum devolve 401", async () => {
    expect((await resumo({})).status).toBe(401);
  });
});

describe("GET /api/fila/resumo — nunca reserva", () => {
  it("50 chamadas seguidas não criam claim nem mudam filaEnvios", async () => {
    semear(lead("ChIJa"), lead("ChIJb"));

    for (let i = 0; i < 50; i++) {
      const res = await resumo();
      expect(res.status).toBe(200);
    }

    expect(db.getDoc("filaEnvios/ChIJa")).toBeUndefined();
    expect(db.getDoc("filaEnvios/ChIJb")).toBeUndefined();
  });

  it("não altera filaContadores", async () => {
    semear(lead("ChIJa"));
    await resumo();
    await resumo();

    expect(db.getDoc("filaContadores/2026-03-10")).toBeUndefined();
  });
});

describe("GET /api/fila/resumo — forma do corpo", () => {
  const CHAVES = [
    "ativo",
    "enviados",
    "meta",
    "restante",
    "semPrint",
    "falhas",
    "invalidos",
    "elegiveisAgora",
    "motivoAtual",
    "proximaJanela",
    "diaOperacional",
  ] as const;

  it("todas as chaves sempre presentes, com ou sem lead na base", async () => {
    const semLead = await (await resumo()).json();
    expect(Object.keys(semLead).sort()).toEqual([...CHAVES].sort());

    semear(lead("ChIJa"));
    const comLead = await (await resumo()).json();
    expect(Object.keys(comLead).sort()).toEqual([...CHAVES].sort());
  });

  it("ativo é booleano, os contadores são number, o resto é string", async () => {
    const corpo = await (await resumo()).json();
    expect(typeof corpo.ativo).toBe("boolean");
    for (const chave of ["enviados", "meta", "restante", "semPrint", "falhas", "invalidos", "elegiveisAgora"]) {
      expect(typeof corpo[chave]).toBe("number");
    }
    for (const chave of ["motivoAtual", "proximaJanela", "diaOperacional"]) {
      expect(typeof corpo[chave]).toBe("string");
    }
  });
});

describe("GET /api/fila/resumo — motivoAtual bate com /proximo no mesmo instante", () => {
  async function comparar() {
    const [resumoBody, proximoBody] = await Promise.all([
      (await resumo()).json(),
      (await proximo()).json(),
    ]);
    const motivoDoProximo = proximoBody.temTarefa ? "" : proximoBody.motivo;
    expect(resumoBody.motivoAtual).toBe(motivoDoProximo);
    return { resumoBody, proximoBody };
  }

  it("tarefa disponível agora → ambos dizem ''", async () => {
    semear(lead("ChIJa"));
    const { resumoBody } = await comparar();
    expect(resumoBody.motivoAtual).toBe("");
    expect(resumoBody.proximaJanela).toBe("");
  });

  it("pausado", async () => {
    semear(lead("ChIJa"));
    db.seed("config/fila", { ativo: false });
    await comparar();
  });

  it("meta_atingida", async () => {
    semear(lead("ChIJa"));
    db.seed("config/fila", { metaDiaria: 1 });
    db.seed("filaContadores/2026-03-10", { enviados: 1, envios: [], ultimoEventoEm: null });
    await comparar();
  });

  it("teto_hora", async () => {
    semear(lead("ChIJa"));
    db.seed("config/fila", { tetoPorHora: 2 });
    db.seed("filaContadores/2026-03-10", {
      enviados: 2,
      envios: ["2026-03-10T09:30:00.000Z", "2026-03-10T09:45:00.000Z"],
      ultimoEventoEm: null,
    });
    await comparar();
  });

  it("intervalo", async () => {
    semear(lead("ChIJa"));
    db.seed("config/fila", { intervaloMinimoSegundos: 300 });
    db.seed("filaContadores/2026-03-10", {
      enviados: 1,
      envios: [],
      ultimoEventoEm: "2026-03-10T09:58:00.000Z",
    });
    await comparar();
  });

  it("fora_de_janela", async () => {
    semear(lead("ChIJa"));
    vi.setSystemTime(TERCA_3H);
    await comparar();
  });

  it("sem_leads_elegiveis", async () => {
    semear(lead("ChIJa", { status: "contactado" }));
    await comparar();
  });
});

describe("GET /api/fila/resumo — proximaJanela coerente com o portão", () => {
  it("meta_atingida devolve a VIRADA DO DIA, não a próxima faixa", async () => {
    semear(lead("ChIJa"));
    db.seed("config/fila", { metaDiaria: 1, inicioDiaOperacionalHora: 5 });
    db.seed("filaContadores/2026-03-10", { enviados: 1, envios: [], ultimoEventoEm: null });

    const corpo = await (await resumo()).json();

    expect(corpo.motivoAtual).toBe("meta_atingida");
    expect(corpo.proximaJanela).toBe(proximaViradaDiaOperacional(TERCA_10H, 5).toISOString());
  });

  it("teto_hora devolve quando o teto libera, não a próxima faixa", async () => {
    semear(lead("ChIJa"));
    db.seed("config/fila", { tetoPorHora: 1 });
    const envios = ["2026-03-10T09:40:00.000Z"];
    db.seed("filaContadores/2026-03-10", { enviados: 1, envios, ultimoEventoEm: null });

    const corpo = await (await resumo()).json();

    expect(corpo.motivoAtual).toBe("teto_hora");
    expect(corpo.proximaJanela).toBe(
      momentoFimTetoHora({ envios }, 1, TERCA_10H)!.toISOString(),
    );
  });

  it("intervalo devolve ultimoEventoEm + intervaloMinimoSegundos", async () => {
    semear(lead("ChIJa"));
    db.seed("config/fila", { intervaloMinimoSegundos: 300 });
    db.seed("filaContadores/2026-03-10", {
      enviados: 1,
      envios: [],
      ultimoEventoEm: "2026-03-10T09:58:00.000Z",
    });

    const corpo = await (await resumo()).json();

    expect(corpo.motivoAtual).toBe("intervalo");
    expect(corpo.proximaJanela).toBe(
      momentoFimIntervalo({ ultimoEventoEm: "2026-03-10T09:58:00.000Z" }, 300)!.toISOString(),
    );
  });

  it("fora de janela devolve a PRÓXIMA FAIXA, coerente com exigirJanelaBoa", async () => {
    // Lancheria: razoável 9h–11h30 (implícito), ruim 11h30–14h, bom 14h30–16h30.
    // Às 8h (fechado): com exigirJanelaBoa true, o próximo aceito é o BOM às
    // 14h30 — pular a faixa razoável das 9h seria justamente mostrar uma
    // hora plausível e errada. Com false, o próximo aceito é a razoável, 9h.
    semear(lead("ChIJa", { busca: { nicho: "lancheria", regiao: "Maringá", em: "2026-03-01T00:00:00.000Z" } }));
    vi.setSystemTime(TERCA_8H);

    const comExigencia = await (await resumo()).json();
    expect(comExigencia.motivoAtual).toBe("fora_de_janela");
    expect(comExigencia.proximaJanela).toBe("2026-03-10T14:30:00.000Z");

    db.seed("config/fila", { exigirJanelaBoa: false });
    const semExigencia = await (await resumo()).json();
    expect(semExigencia.motivoAtual).toBe("fora_de_janela");
    expect(semExigencia.proximaJanela).toBe("2026-03-10T09:00:00.000Z");
  });

  it("com vários leads bloqueados por janela, promete a MENOR das faixas, não a de qualquer um", async () => {
    // Barbearia reabre às 9h; tatuagem só reabre às 13h. O menor dos dois é
    // o que a rota tem que prometer, não o do lead que a ordenação de
    // `ordenarCandidatos` (mais antigo primeiro) colocaria primeiro.
    semear(
      lead("ChIJTatuagem", {
        criadoEm: "2026-02-01T00:00:00.000Z", // mais antigo — sairia primeiro na ordenação
        busca: { nicho: "tatuagem", regiao: "Maringá", em: "2026-02-01T00:00:00.000Z" },
      }),
      lead("ChIJBarbearia", { criadoEm: "2026-03-01T00:00:00.000Z" }),
    );
    vi.setSystemTime(TERCA_3H);

    const corpo = await (await resumo()).json();

    expect(corpo.motivoAtual).toBe("fora_de_janela");
    expect(corpo.proximaJanela).toBe("2026-03-10T09:00:00.000Z");
  });

  it("pausado não promete hora nenhuma", async () => {
    db.seed("config/fila", { ativo: false });
    semear(lead("ChIJa"));

    const corpo = await (await resumo()).json();

    expect(corpo.motivoAtual).toBe("pausado");
    expect(corpo.proximaJanela).toBe("");
  });

  it("sem_leads_elegiveis não promete hora nenhuma", async () => {
    semear(lead("ChIJa", { status: "contactado" }));

    const corpo = await (await resumo()).json();

    expect(corpo.motivoAtual).toBe("sem_leads_elegiveis");
    expect(corpo.proximaJanela).toBe("");
  });
});

describe("GET /api/fila/resumo — elegiveisAgora independe do ritmo", () => {
  it("fila pausada e um lead pronto: elegiveisAgora é 1, não 0", async () => {
    semear(lead("ChIJa"));
    db.seed("config/fila", { ativo: false });

    const corpo = await (await resumo()).json();

    expect(corpo.ativo).toBe(false);
    expect(corpo.elegiveisAgora).toBe(1);
    expect(corpo.motivoAtual).toBe("pausado");
  });

  it("pausada e vazia: elegiveisAgora é 0 — situação DIFERENTE da anterior", async () => {
    db.seed("config/fila", { ativo: false });

    const corpo = await (await resumo()).json();

    expect(corpo.elegiveisAgora).toBe(0);
  });

  it("meta batida com 3 leads prontos: elegiveisAgora é 3", async () => {
    semear(lead("ChIJa"), lead("ChIJb"), lead("ChIJc"));
    db.seed("config/fila", { metaDiaria: 1 });
    db.seed("filaContadores/2026-03-10", { enviados: 1, envios: [], ultimoEventoEm: null });

    expect((await (await resumo()).json()).elegiveisAgora).toBe(3);
  });
});

describe("GET /api/fila/resumo — os números do dia", () => {
  it("enviados/meta/restante/semPrint/falhas/invalidos vêm do contador do dia operacional", async () => {
    db.seed("config/fila", { metaDiaria: 20 });
    db.seed("filaContadores/2026-03-10", {
      enviados: 7,
      envios: [],
      ultimoEventoEm: null,
      falhas: 2,
      invalidos: 1,
      semPrint: 3,
    });

    const corpo = await (await resumo()).json();

    expect(corpo).toMatchObject({
      enviados: 7,
      meta: 20,
      restante: 13,
      semPrint: 3,
      falhas: 2,
      invalidos: 1,
    });
  });

  it("restante nunca é negativo", async () => {
    db.seed("config/fila", { metaDiaria: 5 });
    db.seed("filaContadores/2026-03-10", { enviados: 9, envios: [], ultimoEventoEm: null });

    expect((await (await resumo()).json()).restante).toBe(0);
  });

  it("diaOperacional respeita inicioDiaOperacionalHora, não a meia-noite UTC/SP", async () => {
    db.seed("config/fila", { inicioDiaOperacionalHora: 5 });
    vi.setSystemTime(new Date("2026-03-10T07:00:00Z")); // 04h em São Paulo, antes do corte

    expect((await (await resumo()).json()).diaOperacional).toBe("2026-03-09");
  });

  it("doc do dia ausente: tudo zero, nunca erro", async () => {
    const corpo = await (await resumo()).json();
    expect(corpo).toMatchObject({ enviados: 0, falhas: 0, invalidos: 0, semPrint: 0, restante: 15 });
  });
});
