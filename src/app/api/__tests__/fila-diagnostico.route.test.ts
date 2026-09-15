import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { estruturalVazio } from "@/lib/fila/candidatos";
import { PAINEL_LINHAS } from "@/lib/fila/painel";
import type { AppDb } from "@/lib/firestore-like";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET } from "../fila/diagnostico/route";

/** Conta quantas vezes a coleção `leads` foi varrida — `collection()` devolve um objeto novo a cada chamada, então a única forma de contar é envolver o `AppDb` inteiro. */
function contandoLeituraDeLeads(base: FakeFirestore): { db: AppDb; leituras: () => number } {
  let leituras = 0;
  const db: AppDb = {
    collection(name: string) {
      const real = base.collection(name);
      if (name !== "leads") return real;
      return { ...real, get: async () => { leituras += 1; return real.get(); } };
    },
    runTransaction: (fn) => base.runTransaction(fn),
  };
  return { db, leituras: () => leituras };
}

/**
 * `/api/fila/diagnostico` — o painel de "por que fora_de_janela". Autenticado
 * por SESSÃO de admin (igual `/api/config/fila` PUT), nunca pela
 * RADAR_DEVICE_KEY: esse segredo é do aparelho, não abre este painel.
 *
 * O que estes testes protegem: a rota NUNCA dispara uma varredura de /leads
 * (ela só lê o que o pool já tem), e o retrato que ela mostra é exatamente
 * o que está gravado — nem mais fresco, nem escondido atrás de um rebuild.
 */

const AGORA = new Date("2026-03-10T10:00:00Z");

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

function diagnostico(cookie?: string) {
  return GET(
    new Request("http://localhost/api/fila/diagnostico", {
      headers: cookie ? { cookie } : {},
    }),
  );
}

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("GET /api/fila/diagnostico — autenticação", () => {
  it("sem sessão → 401 (nunca a RADAR_DEVICE_KEY: essa rota é do painel, não do celular)", async () => {
    const res = await diagnostico();

    expect(res.status).toBe(401);
    const { error } = await res.json();
    expect(error.code).toBe("unauthorized");
  });

  it("membro → 403 (diagnóstico é do admin, igual a config da fila)", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    const res = await diagnostico(cookie);

    expect(res.status).toBe(403);
    const { error } = await res.json();
    expect(error.code).toBe("forbidden");
  });

  it("admin → 200", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    expect((await diagnostico(cookie)).status).toBe(200);
  });
});

describe("GET /api/fila/diagnostico — etapa 1: ritmo", () => {
  it("nenhum portão de ritmo ativo: ritmo null", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (await diagnostico(cookie)).json();

    expect(corpo.ritmo).toBeNull();
  });

  it("fila pausada: ritmo 'pausado', mesmo sem pool nenhum construído", async () => {
    db.seed("config/fila", { ativo: false });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (await diagnostico(cookie)).json();

    expect(corpo.ritmo).toBe("pausado");
  });

  it("teto por hora atingido: ritmo 'teto_hora'", async () => {
    db.seed("config/fila", { tetoPorHora: 1 });
    db.seed("filaContadores/2026-03-10", {
      enviados: 1,
      envios: ["2026-03-10T09:50:00.000Z"],
      ultimoEventoEm: null,
    });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    expect((await (await diagnostico(cookie)).json()).ritmo).toBe("teto_hora");
  });
});

describe("GET /api/fila/diagnostico — etapa 2: estrutural (retrato do pool)", () => {
  it("pool nunca construído: geradoEm null, estrutural zerado, e NENHUMA varredura de /leads", async () => {
    db.seed("leads/ChIJa", { placeId: "ChIJa", status: "novo" });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const { db: dbContado, leituras } = contandoLeituraDeLeads(db);
    db = dbContado as unknown as FakeFirestore;

    const corpo = await (await diagnostico(cookie)).json();

    expect(corpo.pool).toEqual({
      geradoEm: null,
      lidos: 0,
      truncado: false,
      estrutural: estruturalVazio(),
    });
    expect(leituras()).toBe(0);
  });

  it("pool existente: expõe geradoEm e as contagens tal como estão gravadas, mesmo velhas além do TTL", async () => {
    const geradoEmVelho = "2026-03-10T08:00:00.000Z"; // mais de 10 min atrás
    db.seed("filaCandidatos/pool", {
      geradoEm: geradoEmVelho,
      candidatos: [],
      lidos: 40,
      truncado: false,
      estrutural: {
        status: 5,
        descartado: 1,
        telefoneInvalido: 2,
        semTelefone: 3,
        semDemo: 4,
        capturaNaoPronta: 6,
        semFuso: 7,
      },
    });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (await diagnostico(cookie)).json();

    expect(corpo.pool).toEqual({
      geradoEm: geradoEmVelho,
      lidos: 40,
      truncado: false,
      estrutural: {
        status: 5,
        descartado: 1,
        telefoneInvalido: 2,
        semTelefone: 3,
        semDemo: 4,
        capturaNaoPronta: 6,
        semFuso: 7,
      },
    });
  });
});

describe("GET /api/fila/diagnostico — etapas 3 e 4: nicho e janela (frescos, sobre o pool)", () => {
  function poolCom(candidatos: unknown[]) {
    db.seed("filaCandidatos/pool", {
      geradoEm: AGORA.toISOString(),
      candidatos,
      lidos: candidatos.length,
      truncado: false,
      estrutural: estruturalVazio(),
    });
  }

  it("nicho barrado conta em nichoBarrado, fresco (não vem do rebuild)", async () => {
    poolCom([{ id: "a", nicho: "tatuagem", offset: 0, faixas: [], criadoEm: "2026-03-01T00:00:00.000Z" }]);
    db.seed("config/fila", { nichosPermitidos: ["barbearia"] });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (await diagnostico(cookie)).json();

    expect(corpo.nichoBarrado).toBe(1);
    expect(corpo.janela).toEqual({ razoavel: 0, ruim: 0, semNivel: 0 });
    expect(corpo.elegiveis).toBe(0);
  });

  it("janela quebrada por nível: razoavel some da contagem quando exigirJanelaBoa vira false", async () => {
    // Meio-dia, offset 0, sem faixa de horário marcada → nível "razoavel".
    poolCom([{ id: "a", nicho: "barbearia", offset: 0, faixas: [], criadoEm: "2026-03-01T00:00:00.000Z" }]);
    vi.setSystemTime(new Date("2026-03-10T12:00:00Z"));
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const comExigencia = await (await diagnostico(cookie)).json();
    expect(comExigencia.janela).toEqual({ razoavel: 1, ruim: 0, semNivel: 0 });
    expect(comExigencia.elegiveis).toBe(0);

    db.seed("config/fila", { exigirJanelaBoa: false });
    const semExigencia = await (await diagnostico(cookie)).json();
    expect(semExigencia.janela).toEqual({ razoavel: 0, ruim: 0, semNivel: 0 });
    expect(semExigencia.elegiveis).toBe(1);
  });
});

/**
 * A VISÃO da tela, além das contagens: o contador do dia e as duas listas
 * curtas com nome. O que estes testes protegem é o custo (leitura de lead
 * POR ID, nunca varredura de /leads) e a honestidade das linhas (o pool é
 * cache: pode oferecer quem não serve mais, a tela não mostra).
 */

const LEAD_BASE = {
  status: "novo",
  enriquecido: false,
  telefoneIntl: "+55 44 99154-3803",
  demo: { skinId: "barbearia-editorial" },
  horarios: { faixas: [], utcOffsetMinutes: -180, obtidoEm: "2026-03-01T00:00:00.000Z" },
  capturas: {
    estado: "pronto",
    execucaoId: "e1",
    pedidoEm: "2026-03-01T00:00:00.000Z",
    imagens: [{ ancora: "hero", tela: "celular", ordem: 1, url: "u", largura: 1, altura: 1 }],
  },
  criadoEm: "2026-03-01T00:00:00.000Z",
  atualizadoEm: "2026-03-01T00:00:00.000Z",
};

function semearLead(id: string, nome: string, extra: Record<string, unknown> = {}) {
  db.seed(`leads/${id}`, {
    ...LEAD_BASE,
    placeId: id,
    nome,
    busca: { nicho: "Barbearia Masculina", regiao: "Maringá", em: "2026-03-01T00:00:00.000Z" },
    ...extra,
  });
}

/**
 * Põe o relógio às 10h LOCAIS do lead (offset -180) — a faixa "bom" da
 * barbearia (9h-11h30). `AGORA` (10h UTC) é 7h lá, antes de abrir: bom para
 * os testes de bloqueio, inútil para os de elegível.
 */
function emJanelaBoa() {
  vi.setSystemTime(new Date("2026-03-10T13:00:00Z"));
}

function semearPool(ids: string[], geradoEm = AGORA.toISOString()) {
  db.seed("filaCandidatos/pool", {
    geradoEm,
    candidatos: ids.map((id, i) => ({
      id,
      nicho: "barbearia masculina",
      offset: -180,
      faixas: [],
      criadoEm: `2026-03-0${i + 1}T00:00:00.000Z`,
    })),
    lidos: ids.length,
    truncado: false,
    estrutural: estruturalVazio(),
  });
}

describe("GET /api/fila/diagnostico — contador do dia", () => {
  it("enviados, meta, restante e QUANDO o dia operacional vira", async () => {
    db.seed("config/fila", { metaDiaria: 15, inicioDiaOperacionalHora: 6 });
    db.seed("filaContadores/2026-03-10", {
      enviados: 4,
      envios: ["2026-03-10T09:50:00.000Z"],
      ultimoEventoEm: "2026-03-10T09:50:00.000Z",
    });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const { contador } = await (await diagnostico(cookie)).json();

    expect(contador).toEqual({
      diaOperacional: "2026-03-10",
      enviados: 4,
      meta: 15,
      restante: 11,
      viraEm: "2026-03-11T09:00:00.000Z",
      inicioHora: 6,
      ultimaHora: 1,
      tetoPorHora: 4,
    });
  });

  it("dia sem nenhum envio: contador zerado, nunca erro", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const { contador } = await (await diagnostico(cookie)).json();

    expect(contador).toMatchObject({ enviados: 0, restante: 15, ultimaHora: 0 });
  });
});

describe("GET /api/fila/diagnostico — as listas da tela", () => {
  it("próximos elegíveis com nome, nicho cru, nível e hora local do lead", async () => {
    emJanelaBoa();
    semearPool(["a"]);
    semearLead("a", "Barbearia do Zé");
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (await diagnostico(cookie)).json();

    expect(corpo.elegiveis).toBe(1);
    expect(corpo.proximos).toEqual([
      {
        leadId: "a",
        nome: "Barbearia do Zé",
        nicho: "Barbearia Masculina",
        nivel: "bom",
        horaLocal: "10h",
        proximaFaixa: null,
      },
    ]);
    expect(corpo.bloqueados).toEqual([]);
  });

  it("a ordem dos próximos é a da SELEÇÃO — quem esperou mais primeiro", async () => {
    emJanelaBoa();
    semearPool(["velho", "novo"]);
    semearLead("velho", "Primeiro da fila");
    semearLead("novo", "Chegou depois");
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const { proximos } = await (await diagnostico(cookie)).json();

    expect(proximos.map((l: { leadId: string }) => l.leadId)).toEqual(["velho", "novo"]);
  });

  it("bloqueado por janela: nível de agora e a próxima faixa ACEITA", async () => {
    // 3h UTC = meia-noite em Brasília: fechado.
    vi.setSystemTime(new Date("2026-03-10T03:00:00Z"));
    semearPool(["a"]);
    semearLead("a", "Barbearia do Zé");
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (await diagnostico(cookie)).json();

    expect(corpo.proximos).toEqual([]);
    expect(corpo.janela).toEqual({ razoavel: 0, ruim: 0, semNivel: 1 });
    expect(corpo.bloqueados).toEqual([
      {
        leadId: "a",
        nome: "Barbearia do Zé",
        nicho: "Barbearia Masculina",
        nivel: null,
        horaLocal: "0h",
        proximaFaixa: { rotuloDia: "hoje", hora: "9h" },
      },
    ]);
  });

  it("a próxima faixa aceita segue exigirJanelaBoa — nunca o 'próximo bom' fixo", async () => {
    // Sexta 6h local: fechado, e o próximo BOM da barbearia só na segunda.
    vi.setSystemTime(new Date("2026-03-13T09:00:00Z"));
    semearPool(["a"]);
    semearLead("a", "Barbearia do Zé");
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const comExigencia = await (await diagnostico(cookie)).json();
    expect(comExigencia.bloqueados[0].proximaFaixa).toEqual({ rotuloDia: "segunda", hora: "9h" });

    db.seed("config/fila", { exigirJanelaBoa: false });
    const semExigencia = await (await diagnostico(cookie)).json();
    expect(semExigencia.bloqueados[0].proximaFaixa).toEqual({ rotuloDia: "hoje", hora: "9h" });
  });

  it("lê lead POR ID: nem as listas disparam varredura de /leads", async () => {
    emJanelaBoa();
    semearPool(["a"]);
    semearLead("a", "Barbearia do Zé");
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const { db: dbContado, leituras } = contandoLeituraDeLeads(db);
    db = dbContado as unknown as FakeFirestore;

    const { proximos } = await (await diagnostico(cookie)).json();

    expect(proximos).toHaveLength(1);
    expect(leituras()).toBe(0);
  });

  it("lead descartado desde o rebuild sai da lista — o pool oferece, a tela não mostra", async () => {
    emJanelaBoa();
    semearPool(["a", "b"]);
    semearLead("a", "Descartado à mão", { descartado: true });
    semearLead("b", "Segue na fila");
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const { proximos } = await (await diagnostico(cookie)).json();

    expect(proximos.map((l: { leadId: string }) => l.leadId)).toEqual(["b"]);
  });

  it("as listas são CURTAS: no máximo PAINEL_LINHAS linhas, e só esses leads são lidos", async () => {
    emJanelaBoa();
    const ids = Array.from({ length: PAINEL_LINHAS + 3 }, (_, i) => `lead-${i}`);
    semearPool(ids);
    for (const id of ids) semearLead(id, `Lead ${id}`);
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (await diagnostico(cookie)).json();

    expect(corpo.elegiveis).toBe(ids.length);
    expect(corpo.proximos).toHaveLength(PAINEL_LINHAS);
  });

  it("pool nunca construído: listas vazias, sem erro", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (await diagnostico(cookie)).json();

    expect(corpo.proximos).toEqual([]);
    expect(corpo.bloqueados).toEqual([]);
    expect(corpo.contador).toBeDefined();
  });
});
