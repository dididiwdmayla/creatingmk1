import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "@/lib/config";
import { QuotaExceededError, UserQuotaExceededError } from "@/lib/costs";
import { geocodeRegion, regiaoCacheKey } from "@/lib/geo/geocode";
import type { PenetracaoSite } from "@/lib/leads/penetracao";
import { getLead, upsertLeads } from "@/lib/leads/repo";
import { searchText, type GooglePlace } from "@/lib/places/client";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { executarBuscasRecorrentes } from "../cron";
import { recalcularPenetracao } from "../penetracao";
import { listBuscasRecorrentes, registrarExecucao } from "../repo";
import type { Busca } from "../types";

/**
 * Penetração recalculada UMA vez no fim da rodada do cron, contra o
 * comportamento anterior (um `recalcularPenetracao` por busca, logo depois
 * dela rodar). O oráculo `rodadaLegada` é a cópia do laço antigo — mesmas
 * chamadas, na mesma ordem —, e roda num banco semeado IGUAL ao do código
 * novo. Relógio congelado e Google determinístico (resposta por nicho, o
 * mesmo lugar sempre com os mesmos dados).
 */

const AGORA = new Date("2026-07-21T06:00:00.000Z");

/* ── Oráculo: o laço de antes desta mudança ─────────────────────────── */

async function executarBuscaLegada(db: FakeFirestore, busca: Busca, caps: Awaited<ReturnType<typeof loadConfig>>["caps"], now: Date) {
  const geo = await geocodeRegion(db, busca.regiao, caps, {});
  const query = [busca.nicho, busca.subNicho, busca.regiao].filter(Boolean).join(" ");
  const resultado = await searchText(db, query, caps, {
    quantidade: busca.quantidade,
    qualificada: busca.qualificada,
    soSemSite: busca.soSemSite,
    locationRestriction: geo.viewport,
    isNovo: async (placeId) => !(await getLead(db, placeId)),
  });
  const { criados, existentes } = await upsertLeads(
    db,
    resultado.places,
    { nicho: busca.nicho, subNicho: busca.subNicho, regiao: busca.regiao },
    busca.id,
    now,
  );
  await registrarExecucao(db, busca.id, { em: now.toISOString(), novos: criados, existentes });
  await recalcularPenetracao(db, busca.id);
  return { aviso: resultado.aviso };
}

async function rodadaLegada(db: FakeFirestore, now: Date): Promise<void> {
  const config = await loadConfig(db);
  const fila = (await listBuscasRecorrentes(db)).slice(0, Math.max(config.maxBuscasRecorrentes, 0));
  for (const busca of fila) {
    try {
      const { aviso } = await executarBuscaLegada(db, busca, config.caps, now);
      if (aviso?.startsWith("teto mensal")) break;
    } catch (error) {
      if (error instanceof UserQuotaExceededError) continue;
      if (error instanceof QuotaExceededError) break;
    }
  }
}

/* ── Banco de entrada ───────────────────────────────────────────────── */

/** O "Google": um lugar tem sempre os mesmos dados, em qualquer busca. */
const LUGARES: Record<string, Partial<GooglePlace>> = {
  L1: { websiteUri: "https://clinica-l1.com.br" },
  L3: {},
  L5: { websiteUri: "https://barbearia-l5.com.br" },
  N1: { websiteUri: "https://instagram.com/n1" },
  N2: { websiteUri: "https://n2.com.br" },
  N3: {},
  N4: { websiteUri: "https://n4.com.br" },
  N5: {},
  N6: {},
  N7: { websiteUri: "https://n7.com.br" },
  N8: { websiteUri: "https://n8.com.br" },
  N9: {},
  // Aparece na busca de dentista E na de lancheria (regiões se sobrepõem).
  X1: { websiteUri: "https://x1.com.br" },
};

/** Resposta por palavra do textQuery — independente da ordem das chamadas. */
const RESPOSTAS: Array<[string, string[]]> = [
  ["ortodontia", ["N8", "N9", "L3"]],
  ["dentista", ["L1", "L3", "N1", "N2", "N3", "X1"]],
  ["barbearia", ["L5", "N4", "N5"]],
  ["lancheria", ["N6", "N7", "X1"]],
];

let fetchFalhaEm: string | undefined;

async function google(_url: string, init?: RequestInit): Promise<Response> {
  const { textQuery } = JSON.parse(String(init?.body)) as { textQuery: string };
  const q = textQuery.toLowerCase();
  if (fetchFalhaEm && q.includes(fetchFalhaEm)) return new Response("boom", { status: 500 });
  const ids = RESPOSTAS.find(([palavra]) => q.includes(palavra))?.[1] ?? [];
  return new Response(
    JSON.stringify({
      places: ids.map((id) => ({ id, displayName: { text: `Lugar ${id}` }, ...LUGARES[id] })),
    }),
    { status: 200 },
  );
}

function seedBusca(db: FakeFirestore, id: string, extra: Record<string, unknown>) {
  db.seed(`buscas/${id}`, {
    id,
    nome: `busca ${id}`,
    cor: "#2f82e0",
    criadaEm: "2026-06-01T00:00:00.000Z",
    totalCriados: 0,
    totalExistentes: 0,
    ...extra,
  });
}

function seedLead(db: FakeFirestore, placeId: string, buscaId: string[], extra: Record<string, unknown> = {}) {
  db.seed(`leads/${placeId}`, {
    placeId,
    nome: `Lugar ${placeId}`,
    status: "novo",
    enriquecido: false,
    buscaId,
    criadoEm: "2026-06-01T00:00:00.000Z",
    atualizadoEm: "2026-06-01T00:00:00.000Z",
    ...extra,
  });
}

const PENETRACAO_VELHA = {
  total: 1,
  comSiteProprio: 1,
  soRedeSocial: 0,
  semNada: 0,
  desconhecidos: 0,
};

/**
 * Três pares nicho+região distintos, cada um com UMA recorrente; buscas
 * manuais nos mesmos pares (inclusive com grafia diferente — o grupo é
 * normalizado), leads de todo tipo de `siteProprio` e um lugar que aparece
 * em dois pares.
 */
function semear(db: FakeFirestore, extra: { caps?: Record<string, number> } = {}) {
  for (const regiao of ["Sarandi PR", "Maringá PR", "  sarandi   PR"]) {
    db.seed(`geocache/${regiaoCacheKey(regiao)}`, {
      regiao,
      endereco: `${regiao}, Brasil`,
      location: { lat: -23.44, lng: -51.87 },
      viewport: {
        low: { latitude: -23.5, longitude: -51.95 },
        high: { latitude: -23.38, longitude: -51.8 },
      },
      criadoEm: "2026-06-01T00:00:00.000Z",
    });
  }
  db.seed("config/app", { maxBuscasRecorrentes: 3, ...(extra.caps && { caps: extra.caps }) });

  seedBusca(db, "m1", { nicho: "dentista", regiao: "Sarandi PR" });
  seedBusca(db, "m2", { nicho: "barbearia", regiao: "Maringá PR", penetracao: PENETRACAO_VELHA });
  seedBusca(db, "r1", {
    nicho: "Dentista",
    subNicho: "implante",
    regiao: "  sarandi   PR",
    recorrente: true,
    qualificada: true,
    criadaEm: "2026-07-01T00:00:00.000Z",
  });
  seedBusca(db, "r2", {
    nicho: "barbearia",
    regiao: "Maringá PR",
    recorrente: true,
    criadaEm: "2026-07-02T00:00:00.000Z",
    penetracao: PENETRACAO_VELHA,
  });
  seedBusca(db, "r3", {
    nicho: "lancheria",
    regiao: "Sarandi PR",
    recorrente: true,
    qualificada: true,
    criadaEm: "2026-07-03T00:00:00.000Z",
  });

  seedLead(db, "L1", ["m1"], { temSite: true, siteProprio: true });
  seedLead(db, "L2", ["m1"], { temSite: true, siteProprio: false });
  seedLead(db, "L3", ["m1"], { temSite: false, siteProprio: false });
  seedLead(db, "L4", ["m1"]);
  seedLead(db, "L7", ["m1"], { temSite: true, siteProprio: true });
  seedLead(db, "L5", ["m2"], { temSite: true, siteProprio: true });
  seedLead(db, "L6", ["m2"]);
}

const BUSCAS = ["m1", "m2", "r1", "r2", "r3"];
const LEADS = ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "N1", "N2", "N3", "N4", "N5", "N6", "N7", "X1"];

function penetracoes(db: FakeFirestore, ids = BUSCAS): Record<string, PenetracaoSite | undefined> {
  return Object.fromEntries(
    ids.map((id) => [id, db.getDoc(`buscas/${id}`)?.penetracao as PenetracaoSite | undefined]),
  );
}

/** Conta varreduras de coleção inteira (`collection(x).get()`). */
function contarVarreduras(db: FakeFirestore): Record<string, number> {
  const contagem: Record<string, number> = {};
  const original = db.collection.bind(db);
  vi.spyOn(db, "collection").mockImplementation((nome: string) => {
    const ref = original(nome);
    return {
      ...ref,
      get: async () => {
        contagem[nome] = (contagem[nome] ?? 0) + 1;
        return ref.get();
      },
    };
  });
  return contagem;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
  fetchFalhaEm = undefined;
  vi.stubGlobal("fetch", vi.fn(google));
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "chave-teste");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("penetração no fim da rodada do cron — equivalência com o comportamento anterior", () => {
  const cenarios: Array<{ nome: string; caps?: Record<string, number>; falha?: string }> = [
    { nome: "rodada completa" },
    // r1 consome o único request Enterprise; r2 (básica) roda; r3 estoura e para a fila.
    { nome: "cota estourada no meio (fila interrompida)", caps: { textSearchEnterprise: 1 } },
    // Google falha na r2: ela não conclui, as outras seguem.
    { nome: "erro do Google numa busca", falha: "barbearia" },
  ];

  for (const cenario of cenarios) {
    it(`penetração final idêntica à do comportamento atual — ${cenario.nome}`, async () => {
      const legado = new FakeFirestore();
      semear(legado, cenario);
      fetchFalhaEm = cenario.falha;
      await rodadaLegada(legado, AGORA);

      const novo = new FakeFirestore();
      semear(novo, cenario);
      await executarBuscasRecorrentes(novo, AGORA);

      expect(penetracoes(novo)).toEqual(penetracoes(legado));
      // O resto do banco também: leads e totais das buscas idênticos.
      for (const id of LEADS) expect(novo.getDoc(`leads/${id}`)).toEqual(legado.getDoc(`leads/${id}`));
      for (const id of BUSCAS) expect(novo.getDoc(`buscas/${id}`)).toEqual(legado.getDoc(`buscas/${id}`));
    });
  }

  it("o cenário não é vazio: grupos com base cheia, cache velho de busca não rodada preservado", async () => {
    const db = new FakeFirestore();
    semear(db);
    await executarBuscasRecorrentes(db, AGORA);

    const p = penetracoes(db);
    // Dentista/Sarandi: m1 (L1–L4, L7) + r1 (N1, N2, N3, X1) — L4 desconhecido.
    expect(p.r1).toMatchObject({ total: 8, comSiteProprio: 4, soRedeSocial: 2, semNada: 2, desconhecidos: 1 });
    expect(p.r1?.percentuais).toBeDefined();
    expect(p.r2).toMatchObject({ total: 1, desconhecidos: 3 }); // L5; L6 e a básica (N4/N5) sem site conhecido
    expect(p.r3).toMatchObject({ total: 3 }); // N6, N7, X1
    // m1/m2 não rodaram: m1 continua sem cache, m2 com o velho.
    expect(p.m1).toBeUndefined();
    expect(p.m2).toEqual(PENETRACAO_VELHA);
  });

  it("mesmo par duas vezes na rodada: a ÚLTIMA fica idêntica; a anterior deixa de ficar defasada", async () => {
    function semearDuplo(db: FakeFirestore) {
      semear(db);
      // r1b: mesmo nicho+região de r1 (sub-nicho diferente), roda DEPOIS dela.
      seedBusca(db, "r1b", {
        nicho: "dentista",
        subNicho: "ortodontia",
        regiao: "Sarandi PR",
        recorrente: true,
        qualificada: true,
        criadaEm: "2026-07-01T12:00:00.000Z",
      });
      db.seed("config/app", { maxBuscasRecorrentes: 4 });
    }

    const legado = new FakeFirestore();
    semearDuplo(legado);
    await rodadaLegada(legado, AGORA);
    const novo = new FakeFirestore();
    semearDuplo(novo);
    await executarBuscasRecorrentes(novo, AGORA);

    const [pl, pn] = [penetracoes(legado, [...BUSCAS, "r1b"]), penetracoes(novo, [...BUSCAS, "r1b"])];
    // Valor final do PAR (o da última busca dele) e dos outros pares: idênticos.
    expect(pn.r1b).toEqual(pl.r1b);
    for (const id of ["m1", "m2", "r2", "r3"]) expect(pn[id]).toEqual(pl[id]);
    // A diferença: antes, r1 guardava o valor de ANTES de r1b trazer N8/N9
    // (defasado já no fim da própria rodada); agora guarda o valor final do par.
    expect(pl.r1).not.toEqual(pl.r1b);
    expect(pn.r1).toEqual(pn.r1b);
  });

  it("lê /buscas e /leads inteiras UMA vez para a penetração, não uma por busca", async () => {
    const legado = new FakeFirestore();
    semear(legado);
    const varredurasLegado = contarVarreduras(legado);
    await rodadaLegada(legado, AGORA);

    const novo = new FakeFirestore();
    semear(novo);
    const varredurasNovo = contarVarreduras(novo);
    await executarBuscasRecorrentes(novo, AGORA);

    // Antes: 1 por busca concluída (3). Agora: 1 na rodada.
    expect(varredurasLegado.leads).toBe(3);
    expect(varredurasNovo.leads).toBe(1);
    // /buscas: a fila (1) + 1 por busca antes; a fila + 1 no fim agora.
    expect(varredurasLegado.buscas).toBe(4);
    expect(varredurasNovo.buscas).toBe(2);
  });
});

describe("rota /api/cron", () => {
  it("declara maxDuration = 300 (plano Hobby: padrão e máximo)", async () => {
    const rota = await import("@/app/api/cron/route");
    expect(rota.maxDuration).toBe(300);
  });
});
