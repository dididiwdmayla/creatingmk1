import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgendaFila } from "@/lib/fila/estado";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import type { Lead } from "@/lib/leads/types";
import { GET as agendaGET } from "../config/fila/agenda/route";
import { POST as confirmarPOST } from "../fila/confirmar/route";
import { GET as proximoGET } from "../fila/proximo/route";

/**
 * A AGENDA da fila — uma SIMULAÇÃO com as funções de `/api/fila/proximo` e
 * `/api/fila/confirmar`, e um relógio que anda. O que estes testes protegem,
 * acima de tudo, é que a agenda e a fila CONCORDAM: roda-se a agenda, e
 * depois o relógio é levado a cada horário previsto — um segundo antes a
 * fila não entrega nada, no horário ela entrega o MESMO lead, e o
 * `/confirmar` de verdade fecha o envio antes do próximo. Se pudessem
 * discordar, a agenda não serviria para nada.
 *
 * Barbearia: faixa "bom" 9h–11h30 (hora do lead) de segunda a quinta; sem
 * horário de funcionamento, expediente estimado 9h–18h. 10/03/2026 é uma
 * terça; São Paulo é UTC-3, e o dia operacional (início 0h) vira às 03h UTC.
 */

/** Terça, 06h40 UTC (03h40 em São Paulo): todo mundo dormindo. */
const TERCA_0640 = new Date("2026-03-10T06:40:00Z");

const CHAVE = "chave-do-celular";

const CHAVES_PROXIMO = [
  "temTarefa",
  "tipo",
  "teste",
  "id",
  "leadId",
  "nome",
  "numero",
  "texto",
  "printUrl",
  "expiraEm",
  "motivo",
];

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

/** Lead em São Paulo (UTC-3): a faixa das 9h dele é às 12h UTC. */
function leadSP(id: string, overrides: Partial<Lead> = {}): Lead {
  return lead(id, {
    horarios: { faixas: [], utcOffsetMinutes: -180, obtidoEm: "2026-03-01T00:00:00.000Z" },
    endereco: "Rua X, 100, Centro, Maringá - PR, 87000-000, Brasil",
    ...overrides,
  });
}

function semear(...leads: Lead[]) {
  for (const l of leads) db.seed(`leads/${l.placeId}`, l as unknown as Record<string, unknown>);
}

function configFila(campos: Record<string, unknown>) {
  db.seed("config/fila", campos);
}

async function agenda(cookie?: string) {
  return agendaGET(
    new Request("http://localhost/api/config/fila/agenda", { headers: cookie ? { cookie } : {} }),
  );
}

const comoAdmin = () => cookieDeSessao(db, { id: "admin", papel: "admin" });

async function lerAgenda(): Promise<AgendaFila> {
  const res = await agenda(await comoAdmin());
  expect(res.status).toBe(200);
  return res.json();
}

async function proximo() {
  return (
    await proximoGET(new Request("http://localhost/api/fila/proximo", { headers: { authorization: `Bearer ${CHAVE}` } }))
  ).json();
}

function confirmar(corpo: unknown) {
  return confirmarPOST(
    new Request("http://localhost/api/fila/confirmar", {
      method: "POST",
      headers: { authorization: `Bearer ${CHAVE}`, "content-type": "application/json" },
      body: JSON.stringify(corpo),
    }),
  );
}

/**
 * O PERCURSO: para cada linha da agenda, um segundo antes a fila não entrega
 * nada; no horário, entrega o mesmo lead (com o contrato achatado de sempre),
 * e o `/confirmar` real fecha o envio — contador e rotação andam pelo
 * caminho de produção, não pelo da simulação.
 */
async function percorrer(linhas: AgendaFila["linhas"]) {
  for (const linha of linhas) {
    const em = new Date(linha.em);
    // "agora" e "em seguida" não têm um "antes" em que a fila esperava.
    if (linha.motivo !== "agora" && linha.motivo !== "em_seguida") {
      vi.setSystemTime(new Date(em.getTime() - 1000));
      const antes = await proximo();
      expect(antes.temTarefa, `nada deveria sair um segundo antes de ${linha.em}`).toBe(false);
    }

    vi.setSystemTime(em);
    const corpo = await proximo();
    expect(Object.keys(corpo)).toEqual(CHAVES_PROXIMO);
    expect(corpo.leadId, `às ${linha.em}`).toBe(linha.leadId);
    const res = await confirmar({ id: corpo.id, leadId: corpo.leadId, resultado: "enviado", detalhe: "" });
    expect(res.status).toBe(200);
  }
}

/** A linha reduzida ao que a tela mostra: quem, quando, por quê. */
function resumo(a: AgendaFila) {
  return a.linhas.map((l) => [l.leadId, l.em, l.motivo]);
}

beforeEach(() => {
  db = new FakeFirestore();
  // Os leads deste arquivo são de março; o corte do legado tem testes
  // próprios (fila-legado.route.test.ts) — aqui ele fica antes deles.
  db.seed("config/automacao", { corteLegado: "2000-01-01" });
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.stubEnv("RADAR_DEVICE_KEY", CHAVE);
  vi.stubEnv("RADAR_DEVICE_USER_ID", "admin");
  vi.useFakeTimers();
  vi.setSystemTime(TERCA_0640);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("GET /api/config/fila/agenda — permissão", () => {
  it("sem sessão → 401, e nada da agenda no corpo", async () => {
    const res = await agenda();

    expect(res.status).toBe(401);
    expect(await res.json()).not.toHaveProperty("linhas");
  });

  it("MEMBRO → 403, e nada da agenda no corpo", async () => {
    const res = await agenda(await cookieDeSessao(db, { id: "m1", papel: "membro" }));

    expect(res.status).toBe(403);
    expect(await res.json()).not.toHaveProperty("linhas");
  });
});

describe("agenda e fila CONCORDAM", () => {
  it("o mesmo lead sai no mesmo horário, em sequência — janela por lead, outro fuso, intervalo, teto e meta", async () => {
    configFila({ metaDiaria: 5, tetoPorHora: 3, intervaloMinimoSegundos: 600 });
    semear(
      lead("A", { criadoEm: "2026-03-01T00:00:00.000Z" }),
      lead("B", { criadoEm: "2026-03-02T00:00:00.000Z" }),
      leadSP("C", { criadoEm: "2026-03-03T00:00:00.000Z" }),
      lead("D", { criadoEm: "2026-03-04T00:00:00.000Z" }),
      leadSP("E", { criadoEm: "2026-03-05T00:00:00.000Z" }),
      lead("F", { criadoEm: "2026-03-06T00:00:00.000Z" }),
    );

    const a = await lerAgenda();

    expect(resumo(a)).toEqual([
      // A faixa da barbearia de UTC+0 abre às 9h dele.
      ["A", "2026-03-10T09:00:00.000Z", "janela"],
      // Intervalo de 10 min entre envios.
      ["B", "2026-03-10T09:10:00.000Z", "intervalo"],
      ["D", "2026-03-10T09:20:00.000Z", "intervalo"],
      // Teto de 3/h: o envio das 9h sai da janela deslizante às 10h.
      ["F", "2026-03-10T10:00:00.000Z", "teto_hora"],
      // UTC-3: a faixa das 9h DELE é às 12h UTC.
      ["C", "2026-03-10T12:00:00.000Z", "janela"],
      // Meta de 5 batida: o dia seguinte, na faixa dele.
      ["E", "2026-03-11T12:00:00.000Z", "janela"],
    ]);
    expect(a.linhas.at(-1)?.depoisDaMeta).toBe(true);
    expect(a.linhas.slice(0, -1).every((l) => !l.depoisDaMeta)).toBe(true);
    expect(a.linhas.find((l) => l.leadId === "C")).toMatchObject({ offsetLead: -180, cidade: "Maringá - PR" });
    expect(a).toMatchObject({ fora: 0, parouPor: "horizonte", pausada: false, bloqueada: false, barrados: [], vencidos: [] });

    await percorrer(a.linhas);
    // E depois do último, a fila também não tem mais nada a dizer.
    expect((await proximo()).temTarefa).toBe(false);
  });

  it("corta onde a fila corta: a meta e o horizonte, e o que sobra é contado à parte", async () => {
    configFila({ metaDiaria: 2, intervaloMinimoSegundos: 600 });
    semear(
      ...["A", "B", "C", "D", "E"].map((id, i) => lead(id, { criadoEm: `2026-03-0${i + 1}T00:00:00.000Z` })),
    );

    const a = await lerAgenda();

    expect(resumo(a)).toEqual([
      ["A", "2026-03-10T09:00:00.000Z", "janela"],
      ["B", "2026-03-10T09:10:00.000Z", "intervalo"],
      ["C", "2026-03-11T09:00:00.000Z", "janela"],
      ["D", "2026-03-11T09:10:00.000Z", "intervalo"],
    ]);
    // Alguém sai HOJE: o horizonte é o fim do PRÓXIMO dia operacional
    // (quinta, 00h em São Paulo) — o mínimo, que a meta de hoje precisa.
    expect(a.horizonte).toBe("2026-03-12T03:00:00.000Z");
    expect(a.horizonteDia).toBe("2026-03-11");
    expect(a).toMatchObject({ fora: 1, parouPor: "horizonte" });

    await percorrer(a.linhas);
    vi.setSystemTime(new Date("2026-03-11T09:20:00Z"));
    expect((await proximo()).motivo).toBe("meta_atingida");
  });

  it("o alvo do estoque limita a agenda; o resto é contado à parte", async () => {
    db.seed("config/automacao", { corteLegado: "2000-01-01", alvoEstoque: 2 });
    semear(...["A", "B", "C", "D"].map((id, i) => lead(id, { criadoEm: `2026-03-0${i + 1}T00:00:00.000Z` })));

    const a = await lerAgenda();

    expect(a.alvo).toBe(2);
    expect(a.linhas.map((l) => l.leadId)).toEqual(["A", "B"]);
    expect(a).toMatchObject({ fora: 2, parouPor: "alvo" });
  });

  it("entregável já: a primeira linha é AGORA", async () => {
    vi.setSystemTime(new Date("2026-03-10T10:00:00Z"));
    semear(lead("A"), lead("B", { criadoEm: "2026-03-02T00:00:00.000Z" }));

    const a = await lerAgenda();

    expect(resumo(a)).toEqual([
      ["A", "2026-03-10T10:00:00.000Z", "agora"],
      ["B", "2026-03-10T10:03:00.000Z", "intervalo"],
    ]);
    await percorrer(a.linhas);
  });
});

describe("o HORIZONTE vai até o dia da primeira saída — com teto de 7 dias", () => {
  /** Sábado, 14/03/2026, 16h em São Paulo. */
  const SABADO_16H = new Date("2026-03-14T19:00:00Z");

  /** Aberto o dia inteiro, nos 7 dias: quem decide é a janela da família. */
  const SEMPRE_ABERTO = Array.from({ length: 7 }, (_, dia) => ({
    diaAbre: dia,
    horaAbre: 0,
    minAbre: 0,
    diaFecha: dia,
    horaFecha: 23,
    minFecha: 59,
  }));

  /** A família com UMA faixa "bom" (9h–11h30), num dia da semana só. */
  function soNoDia(dia: number) {
    const faixa = { inicio: { hora: 9, minuto: 0 }, fim: { hora: 11, minuto: 30 }, nivel: "bom" };
    return { dias: Object.fromEntries(Array.from({ length: 7 }, (_, d) => [d, d === dia ? [faixa] : []])) };
  }

  it("sábado à tarde, tudo abrindo segunda 9h: a agenda lista os de segunda com horário — e a fila concorda", async () => {
    vi.setSystemTime(SABADO_16H);
    // O caso de produção: 15 prontos, todos barbearia em São Paulo — sábado
    // é "ruim" para a barbearia, domingo não tem faixa, segunda abre às 9h.
    semear(
      ...Array.from({ length: 15 }, (_, i) =>
        leadSP(`L${String(i + 1).padStart(2, "0")}`, {
          criadoEm: `2026-03-01T${String(i).padStart(2, "0")}:00:00.000Z`,
        }),
      ),
    );

    const a = await lerAgenda();

    // Segunda, 9h em São Paulo: a faixa "bom" (9h–11h30) com o teto de 4
    // por hora e o intervalo de 3 min — doze envios, todos na segunda. Da
    // segunda hora em diante quem segura é o teto (janela DESLIZANTE: às
    // 13h03 o envio das 12h03 ainda está na última hora).
    const horas = ["12:00", "12:03", "12:06", "12:09", "13:00", "13:03", "13:06", "13:09", "14:00", "14:03", "14:06", "14:09"];
    expect(resumo(a)).toEqual(
      horas.map((hora, i) => [
        `L${String(i + 1).padStart(2, "0")}`,
        `2026-03-16T${hora}:00.000Z`,
        i === 0 ? "janela" : i < 4 ? "intervalo" : "teto_hora",
      ]),
    );
    // Até onde ela foi: o fim de segunda. Os três que só saem terça ficam
    // contados à parte, "sem vez até o fim de segunda".
    expect(a).toMatchObject({
      horizonte: "2026-03-17T03:00:00.000Z",
      horizonteDia: "2026-03-16",
      diaOperacional: "2026-03-14",
      parouPor: "horizonte",
      fora: 3,
    });

    await percorrer(a.linhas);
    expect((await proximo()).temTarefa).toBe(false);
  });

  it("o teto: hoje e os seis dias seguintes, nunca mais que 7×24h — quem só abre depois fica de fora", async () => {
    vi.setSystemTime(SABADO_16H);
    db.seed("config/app", {
      // Barbearia só no SÁBADO (o próximo é depois do teto); pet shop só na
      // SEXTA (o sexto dia — dentro).
      janelasContato: { barbearia: soNoDia(6), petshop: soNoDia(5) },
    });
    const sempreAberto = { horarios: { faixas: SEMPRE_ABERTO, utcOffsetMinutes: -180, obtidoEm: "2026-03-01T00:00:00.000Z" } };
    semear(
      leadSP("SAB", { criadoEm: "2026-03-01T00:00:00.000Z", ...sempreAberto }),
      leadSP("SEX", {
        criadoEm: "2026-03-02T00:00:00.000Z",
        busca: { nicho: "petshop", regiao: "Maringá", em: "2026-03-01T00:00:00.000Z" },
        ...sempreAberto,
      }),
    );

    const a = await lerAgenda();

    // Sexta, 9h em São Paulo: seis dias à frente, ainda na agenda.
    expect(resumo(a)).toEqual([["SEX", "2026-03-20T12:00:00.000Z", "janela"]]);
    // O teto: a virada de sexta para sábado — sábado 9h fica de fora.
    expect(a).toMatchObject({
      horizonte: "2026-03-21T03:00:00.000Z",
      horizonteDia: "2026-03-20",
      parouPor: "horizonte",
      fora: 1,
    });
    expect(Date.parse(a.horizonte) - SABADO_16H.getTime()).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);

    await percorrer(a.linhas);
    // A fila confirma o corte: o sábado do lado de lá do teto é quando ele
    // sai de verdade — e nem um minuto antes do teto ele saía.
    vi.setSystemTime(new Date("2026-03-21T03:00:00Z"));
    expect((await proximo()).temTarefa).toBe(false);
    vi.setSystemTime(new Date("2026-03-21T12:00:00Z"));
    expect((await proximo()).leadId).toBe("SAB");
  });

  it("nada sai em sete dias: a agenda vazia vai até o teto", async () => {
    vi.setSystemTime(SABADO_16H);
    db.seed("config/app", { janelasContato: { barbearia: soNoDia(6) } });
    semear(leadSP("SAB", { horarios: { faixas: SEMPRE_ABERTO, utcOffsetMinutes: -180, obtidoEm: "2026-03-01T00:00:00.000Z" } }));

    const a = await lerAgenda();

    expect(a).toMatchObject({
      linhas: [],
      horizonte: "2026-03-21T03:00:00.000Z",
      horizonteDia: "2026-03-20",
      parouPor: "horizonte",
      fora: 1,
    });
  });
});

describe("os BARRADOS pela guarda da mensagem não ocupam vaga", () => {
  it("marcador sem resolver: sai da sequência para 'vão ser barrados', com o marcador — e a fila pula ele igual", async () => {
    db.seed("buscas/b-erro", {
      id: "b-erro",
      nicho: "barbearia",
      regiao: "Maringá",
      criadaEm: "2026-02-01T00:00:00.000Z",
      mensagemPadrao: "Oi {nome}, veja {link}",
    });
    semear(
      // O mais antigo — o primeiro da fila. A skin não tem frases, então a
      // mensagem é a do GRUPO, com o marcador digitado errado.
      lead("G", { criadoEm: "2026-02-01T00:00:00.000Z", buscaId: ["b-erro"] }),
      lead("A", { criadoEm: "2026-03-01T00:00:00.000Z" }),
      lead("B", { criadoEm: "2026-03-02T00:00:00.000Z" }),
    );

    const a = await lerAgenda();

    expect(a.barrados).toEqual([{ leadId: "G", nome: "Lead G", motivo: "marcador", marcador: "{link}" }]);
    expect(resumo(a)).toEqual([
      ["A", "2026-03-10T09:00:00.000Z", "janela"],
      ["B", "2026-03-10T09:03:00.000Z", "intervalo"],
    ]);
    expect(a.fora).toBe(0);

    await percorrer(a.linhas);
  });

  it("a rotação gira e o barrado sai na vez seguinte — como na fila", async () => {
    configFila({ intervaloMinimoSegundos: 600 });
    db.seed("frasesProspeccao/barbearia-editorial", {
      skinId: "barbearia-editorial",
      frases: ["Oi {nome}. {penetracao}", "Oi {nome}, tudo bem?", ""],
      indice: 0,
    });
    db.seed("buscas/b-pen", {
      id: "b-pen",
      nicho: "barbearia",
      regiao: "Maringá",
      criadaEm: "2026-02-01T00:00:00.000Z",
      penetracao: {
        total: 20,
        comSiteProprio: 12,
        soRedeSocial: 4,
        semNada: 4,
        desconhecidos: 0,
        percentuais: { comSiteProprio: 60, soRedeSocial: 20, semNada: 20 },
      },
    });
    semear(
      // Q é o mais antigo, mas sem penetração: a frase 1 o barra.
      lead("Q", { criadoEm: "2026-03-01T00:00:00.000Z" }),
      // P tem a penetração: a frase 1 serve, ele sai e a rotação gira.
      lead("P", { criadoEm: "2026-03-02T00:00:00.000Z", buscaId: ["b-pen"], siteProprio: false }),
    );

    const a = await lerAgenda();

    expect(resumo(a)).toEqual([
      ["P", "2026-03-10T09:00:00.000Z", "janela"],
      // A frase 2 não tem marcador: Q sai na vez seguinte.
      ["Q", "2026-03-10T09:10:00.000Z", "intervalo"],
    ]);
    expect(a.barrados).toEqual([]);

    await percorrer(a.linhas);
  });
});

describe("a demo que VENCE antes da vez sai da sequência", () => {
  /** Demo automática aprovada, com as três marcas da origem comprovada. */
  function demoAutomatica(criadoEm: string): Lead["demo"] {
    return {
      skinId: "barbearia-editorial",
      origem: "automacao",
      aprovacao: "aprovada",
      criadoPor: "automacao",
      execucaoAutomacao: "exec-x",
      criadoEm,
    } as Lead["demo"];
  }

  function cenario() {
    configFila({ metaDiaria: 1 });
    semear(
      lead("A", { criadoEm: "2026-03-01T00:00:00.000Z" }),
      // Vence quarta 06h00 UTC; a varredura de quarta (06h30 UTC) a apaga
      // antes da vez dele (quarta 9h, por causa da meta de 1).
      lead("V", { criadoEm: "2026-03-02T00:00:00.000Z", demo: demoAutomatica("2026-03-08T06:00:00.000Z") }),
      lead("W", { criadoEm: "2026-03-03T00:00:00.000Z" }),
    );
  }

  it("com a automação ligada: listada à parte, e os seguintes sobem", async () => {
    db.seed("config/automacao", { corteLegado: "2000-01-01", ativo: true, expiracaoDemoHoras: 72 });
    cenario();

    const a = await lerAgenda();

    expect(a.vencidos).toEqual([
      {
        leadId: "V",
        nome: "Lead V",
        venceEm: "2026-03-11T06:00:00.000Z",
        varreduraEm: "2026-03-11T06:30:00.000Z",
        sairiaEm: "2026-03-11T09:00:00.000Z",
      },
    ]);
    expect(resumo(a)).toEqual([
      ["A", "2026-03-10T09:00:00.000Z", "janela"],
      ["W", "2026-03-11T09:00:00.000Z", "janela"],
    ]);
  });

  it("antes da varredura, a mesma demo sai normalmente", async () => {
    db.seed("config/automacao", { corteLegado: "2000-01-01", ativo: true, expiracaoDemoHoras: 72 });
    configFila({ metaDiaria: 5 });
    semear(lead("V", { demo: demoAutomatica("2026-03-08T06:00:00.000Z") }));

    const a = await lerAgenda();

    expect(a.vencidos).toEqual([]);
    expect(resumo(a)).toEqual([["V", "2026-03-10T09:00:00.000Z", "janela"]]);
  });

  it("com a automação desligada a varredura não roda: a demo não vence", async () => {
    cenario();

    const a = await lerAgenda();

    expect(a.vencidos).toEqual([]);
    expect(a.linhas.map((l) => l.leadId)).toEqual(["A", "V"]);
  });
});

describe("fila pausada ou bloqueada", () => {
  it("pausada: a agenda é calculada como se estivesse ativa, com o aviso", async () => {
    configFila({ ativo: false });
    semear(lead("A"));

    const a = await lerAgenda();

    expect(a.pausada).toBe(true);
    expect(resumo(a)).toEqual([["A", "2026-03-10T09:00:00.000Z", "janela"]]);
    // A fila, enquanto isso, não entrega nada.
    vi.setSystemTime(new Date("2026-03-10T09:00:00Z"));
    expect((await proximo()).motivo).toBe("pausado");
  });

  it("config ausente (saúde): calculada, com o aviso de bloqueio", async () => {
    vi.stubEnv("RADAR_DEVICE_USER_ID", "");
    semear(lead("A"));

    const a = await lerAgenda();

    expect(a).toMatchObject({ bloqueada: true, pausada: false });
    expect(a.linhas.map((l) => l.leadId)).toEqual(["A"]);
  });
});

describe("SOMENTE LEITURA", () => {
  it("nenhuma escrita — nem a do pool vencido, refeito em memória", async () => {
    semear(lead("A"), lead("B", { criadoEm: "2026-03-02T00:00:00.000Z" }));
    const cookie = await comoAdmin();
    const escritas = vi.spyOn(db, "applyWrite");
    const exclusoes = vi.spyOn(db, "deleteDoc");
    const transacoes = vi.spyOn(db, "runTransaction");

    const res = await agenda(cookie);
    const a: AgendaFila = await res.json();

    expect(res.status).toBe(200);
    expect(a.linhas).toHaveLength(2);
    expect(a.pool.reconstruido).toBe(true);
    expect(escritas).not.toHaveBeenCalled();
    expect(exclusoes).not.toHaveBeenCalled();
    expect(transacoes).not.toHaveBeenCalled();
    expect(db.getDoc("filaCandidatos/pool")).toBeUndefined();
    expect(db.getDoc("filaEnvios/A")).toBeUndefined();
  });

  it("o pool em cache dentro do TTL é reaproveitado (sem varrer /leads)", async () => {
    semear(lead("A"), lead("B", { criadoEm: "2026-03-02T00:00:00.000Z" }));
    db.seed("filaCandidatos/pool", {
      geradoEm: new Date(TERCA_0640.getTime() - 60_000).toISOString(),
      candidatos: [{ id: "B", nicho: "barbearia", offset: 0, faixas: [], criadoEm: "2026-03-02T00:00:00.000Z" }],
      lidos: 2,
      truncado: false,
    });

    const a = await lerAgenda();

    expect(a.pool).toMatchObject({ reconstruido: false, geradoEm: "2026-03-10T06:39:00.000Z" });
    expect(a.linhas.map((l) => l.leadId)).toEqual(["B"]);
  });
});

describe("estado vazio", () => {
  it("sem lead nenhum: listas vazias, nada fora, e o horizonte no teto (hoje e os seis seguintes)", async () => {
    const a = await lerAgenda();

    expect(a).toMatchObject({
      linhas: [],
      barrados: [],
      vencidos: [],
      fora: 0,
      parouPor: "horizonte",
      alvo: 15,
      // Terça 03h40: o teto é a virada de segunda para terça que vem.
      horizonte: "2026-03-17T03:00:00.000Z",
      horizonteDia: "2026-03-16",
    });
  });
});
