import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { estruturalVazio } from "@/lib/fila/candidatos";
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
