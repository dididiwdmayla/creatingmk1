import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { regiaoCacheKey } from "@/lib/geo/geocode";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { GET } from "../cron/route";
import { GET as STATUS } from "../cron/status/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const fetchMock = vi.fn();

const VIEWPORT = {
  low: { latitude: -23.5, longitude: -51.95 },
  high: { latitude: -23.38, longitude: -51.8 },
};

function seedGeocache(regiao: string) {
  db.seed(`geocache/${regiaoCacheKey(regiao)}`, {
    regiao,
    endereco: `${regiao}, Brasil`,
    location: { lat: -23.4444, lng: -51.8739 },
    viewport: VIEWPORT,
    criadoEm: "2026-07-01T00:00:00.000Z",
  });
}

function seedBusca(
  id: string,
  overrides: Record<string, unknown> = {},
): void {
  db.seed(`buscas/${id}`, {
    id,
    nome: `busca ${id}`,
    nicho: "dentista",
    regiao: "Sarandi PR",
    cor: "#2f82e0",
    criadaEm: "2026-07-01T00:00:00.000Z",
    totalCriados: 1,
    totalExistentes: 0,
    ...overrides,
  });
}

function placesResponse(ids: string[]) {
  return new Response(
    JSON.stringify({
      places: ids.map((id) => ({ id, displayName: { text: `Lugar ${id}` } })),
    }),
    { status: 200 },
  );
}

function cronRequest(auth?: string): Request {
  return new Request("http://localhost/api/cron", {
    ...(auth && { headers: { authorization: auth } }),
  });
}

/** Docs da subcoleção de execuções de uma busca. */
async function execucoesDe(buscaId: string) {
  const { docs } = await db.collection(`buscas/${buscaId}/execucoes`).get();
  return docs.map((doc) => doc.data());
}

beforeEach(() => {
  db = new FakeFirestore();
  seedGeocache("Sarandi PR");
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => placesResponse(["ChIJ001", "ChIJ002"]));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "chave-teste");
  vi.stubEnv("CRON_SECRET", "segredo-cron");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GET /api/cron — proteção", () => {
  it("sem CRON_SECRET configurada → 503 config_error, nada roda", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const res = await GET(cronRequest("Bearer qualquer"));

    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("config_error");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Authorization ausente ou errado → 401, nada roda", async () => {
    for (const req of [cronRequest(), cronRequest("Bearer errado")]) {
      const res = await GET(req);
      expect(res.status).toBe(401);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron — execução", () => {
  it("sem buscas recorrentes: rodada vazia registrada em /cron/ultima", async () => {
    seedBusca("b1"); // não recorrente

    const res = await GET(cronRequest("Bearer segredo-cron"));

    expect(res.status).toBe(200);
    const { execucao } = await res.json();
    expect(execucao).toMatchObject({
      recorrentes: 0,
      buscas: [],
      totalNovos: 0,
      totalExistentes: 0,
    });
    expect(db.getDoc("cron/ultima")).toMatchObject({ recorrentes: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("re-executa a recorrente com o mesmo pipeline: upsert no MESMO grupo + execução gravada", async () => {
    seedBusca("b1", { recorrente: true, totalCriados: 5, totalExistentes: 2 });
    db.seed("leads/ChIJ001", {
      placeId: "ChIJ001",
      nome: "Lugar ChIJ001",
      status: "contactado",
      enriquecido: false,
      buscaId: ["b1"],
      contato: { primeiroContatoEm: "2026-07-10T00:00:00.000Z" },
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    const res = await GET(cronRequest("Bearer segredo-cron"));

    expect(res.status).toBe(200);
    const { execucao } = await res.json();
    expect(execucao.buscas).toEqual([
      { buscaId: "b1", nome: "busca b1", novos: 1, existentes: 1 },
    ]);
    expect(execucao.totalNovos).toBe(1);

    // Upsert não rebaixa: o lead contactado continua contactado.
    expect(db.getDoc("leads/ChIJ001")).toMatchObject({
      status: "contactado",
      buscaId: ["b1"],
    });
    // Lead novo entra no grupo da busca recorrente.
    expect(db.getDoc("leads/ChIJ002")).toMatchObject({ status: "novo", buscaId: ["b1"] });

    // Execução gravada na subcoleção + totais do grupo somados.
    const execucoes = await execucoesDe("b1");
    expect(execucoes).toHaveLength(1);
    expect(execucoes[0]).toMatchObject({ novos: 1, existentes: 1 });
    expect(typeof execucoes[0].em).toBe("string");
    expect(db.getDoc("buscas/b1")).toMatchObject({ totalCriados: 6, totalExistentes: 3 });

    // /cron/ultima guarda o resumo para o widget do dashboard.
    expect(db.getDoc("cron/ultima")).toMatchObject({ totalNovos: 1, recorrentes: 1 });
  });

  it("ordem determinística (criadaEm asc) e teto maxBuscasRecorrentes recorta a fila", async () => {
    seedBusca("b-nova", { recorrente: true, criadaEm: "2026-07-03T00:00:00.000Z" });
    seedBusca("b-velha", { recorrente: true, criadaEm: "2026-07-01T00:00:00.000Z" });
    seedBusca("b-media", { recorrente: true, criadaEm: "2026-07-02T00:00:00.000Z" });
    db.seed("config/app", { maxBuscasRecorrentes: 2 });

    const { execucao } = await (await GET(cronRequest("Bearer segredo-cron"))).json();

    expect(execucao.recorrentes).toBe(3);
    expect(execucao.buscas.map((b: { buscaId: string }) => b.buscaId)).toEqual([
      "b-velha",
      "b-media",
    ]);
    expect(await execucoesDe("b-nova")).toHaveLength(0);
  });

  it("cota estourada no meio: para a fila e registra a interrupção", async () => {
    seedBusca("b1", { recorrente: true, criadaEm: "2026-07-01T00:00:00.000Z" });
    seedBusca("b2", { recorrente: true, criadaEm: "2026-07-02T00:00:00.000Z" });
    // Teto de 1 request de Text Search no mês: a b1 consome, a b2 estoura.
    db.seed("config/app", { caps: { textSearch: 1 } });

    const res = await GET(cronRequest("Bearer segredo-cron"));

    expect(res.status).toBe(200);
    const { execucao } = await res.json();
    expect(execucao.buscas.map((b: { buscaId: string }) => b.buscaId)).toEqual(["b1"]);
    expect(execucao.interrompida).toMatchObject({ buscaId: "b2" });
    expect(execucao.interrompida.motivo).toContain("Teto");
    // b1 executou e gravou; b2 não tem execução.
    expect(await execucoesDe("b1")).toHaveLength(1);
    expect(await execucoesDe("b2")).toHaveLength(0);
    expect(db.getDoc("cron/ultima")).toMatchObject({
      interrompida: { buscaId: "b2" },
    });
  });

  it("erro do Google numa busca não trava as demais (registra o erro e segue)", async () => {
    seedBusca("b1", { recorrente: true, criadaEm: "2026-07-01T00:00:00.000Z" });
    seedBusca("b2", { recorrente: true, criadaEm: "2026-07-02T00:00:00.000Z" });
    fetchMock
      .mockImplementationOnce(async () => new Response("boom", { status: 500 }))
      .mockImplementationOnce(async () => placesResponse(["ChIJ009"]));

    const { execucao } = await (await GET(cronRequest("Bearer segredo-cron"))).json();

    expect(execucao.buscas).toHaveLength(2);
    expect(execucao.buscas[0]).toMatchObject({ buscaId: "b1", novos: 0 });
    expect(execucao.buscas[0].erro).toContain("500");
    expect(execucao.buscas[1]).toMatchObject({ buscaId: "b2", novos: 1 });
    expect(execucao.interrompida).toBeUndefined();
  });

  it("GET /api/cron/status devolve a última execução e o total de recorrentes", async () => {
    seedBusca("b1", { recorrente: true });

    const antes = await (await STATUS()).json();
    expect(antes).toEqual({ ultima: null, recorrentes: 1 });

    await GET(cronRequest("Bearer segredo-cron"));

    const depois = await (await STATUS()).json();
    expect(depois.recorrentes).toBe(1);
    expect(depois.ultima).toMatchObject({ totalNovos: 2, recorrentes: 1 });
  });

  it("busca qualificada recorrente re-executa qualificada (SKU Enterprise + site definitivo)", async () => {
    seedBusca("b1", { recorrente: true, qualificada: true });
    fetchMock.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          places: [{ id: "ChIJ010", displayName: { text: "Sem Site" } }],
        }),
        { status: 200 },
      ),
    );

    await GET(cronRequest("Bearer segredo-cron"));

    const period = new Date().toISOString().slice(0, 7);
    expect(db.getDoc(`usage/${period}`)).toMatchObject({ textSearchEnterprise: 1 });
    expect(db.getDoc("leads/ChIJ010")).toMatchObject({ temSite: false, siteProprio: false });
  });
});
