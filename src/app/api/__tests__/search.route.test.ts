import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { regiaoCacheKey } from "@/lib/geo/geocode";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { POST } from "../search/route";
import { PATCH } from "../leads/[id]/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const fetchMock = vi.fn();

const GOOGLE_PLACES = {
  places: [
    {
      id: "ChIJ001",
      displayName: { text: "Clínica Sorriso" },
      formattedAddress: "Av. Brasil, 123 - Sarandi, PR",
      location: { latitude: -23.44, longitude: -51.87 },
    },
    { id: "ChIJ002", displayName: { text: "Odonto Vida" } },
  ],
};

const VIEWPORT = {
  low: { latitude: -23.5, longitude: -51.95 },
  high: { latitude: -23.38, longitude: -51.8 },
};

const GEOCODE_OK = {
  status: "OK",
  results: [
    {
      formatted_address: "Sarandi, PR, Brasil",
      geometry: {
        location: { lat: -23.4444, lng: -51.8739 },
        viewport: {
          northeast: { lat: -23.38, lng: -51.8 },
          southwest: { lat: -23.5, lng: -51.95 },
        },
      },
    },
  ],
};

/** Região default já resolvida no cache — a maioria dos testes não geocodifica. */
function seedGeocache(regiao = "Sarandi PR", endereco = "Sarandi, PR, Brasil") {
  db.seed(`geocache/${regiaoCacheKey(regiao)}`, {
    regiao,
    endereco,
    location: { lat: -23.4444, lng: -51.8739 },
    viewport: VIEWPORT,
    criadoEm: "2026-07-01T00:00:00.000Z",
  });
}

beforeEach(() => {
  db = new FakeFirestore();
  db.seed("config/app", { nicho: "dentista", regiao: "Sarandi PR" });
  seedGeocache();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) =>
    String(url).includes("maps/api/geocode")
      ? new Response(JSON.stringify(GEOCODE_OK), { status: 200 })
      : new Response(JSON.stringify(GOOGLE_PLACES), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "chave-teste");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function searchRequest(body?: unknown): Request {
  return new Request("http://localhost/api/search", {
    method: "POST",
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

/** Chamadas ao Text Search (ignora as de geocoding). */
function searchCalls(): RequestInit[] {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).includes("places:searchText"))
    .map(([, init]) => init as RequestInit);
}

function sentSearchBody(call = 0): Record<string, unknown> {
  return JSON.parse(searchCalls()[call].body as string) as Record<string, unknown>;
}

function sentQuery(call = 0): string {
  return sentSearchBody(call).textQuery as string;
}

describe("POST /api/search", () => {
  it("sem corpo usa nicho/regiao da config e cria leads com status novo", async () => {
    const res = await POST(searchRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.criados).toBe(2);
    expect(data.existentes).toBe(0);
    expect(data.leads).toHaveLength(2);
    expect(data.leads[0]).toMatchObject({
      placeId: "ChIJ001",
      nome: "Clínica Sorriso",
      status: "novo",
      enriquecido: false,
      busca: { nicho: "dentista", regiao: "Sarandi PR" },
    });

    expect(sentQuery()).toBe("dentista Sarandi PR");
    expect(db.getDoc("leads/ChIJ001")).toMatchObject({ status: "novo" });
  });

  it("corpo sobrepõe a config", async () => {
    await POST(searchRequest({ nicho: "pizzaria", regiao: "Maringá PR" }));

    expect(sentQuery()).toBe("pizzaria Maringá PR");
  });

  it("subNicho entra na query entre nicho e região", async () => {
    await POST(searchRequest({ subNicho: "implante" }));

    expect(sentQuery()).toBe("dentista implante Sarandi PR");
  });

  it("registra a busca em /buscas com totais e devolve no corpo", async () => {
    const res = await POST(
      searchRequest({ subNicho: "implante", nome: "Implantes Sarandi" }),
    );

    const { busca } = await res.json();
    expect(busca).toMatchObject({
      nome: "Implantes Sarandi",
      nicho: "dentista",
      subNicho: "implante",
      regiao: "Sarandi PR",
      totalCriados: 2,
      totalExistentes: 0,
    });
    expect(typeof busca.id).toBe("string");
    expect(typeof busca.criadaEm).toBe("string");

    expect(db.getDoc(`buscas/${busca.id}`)).toMatchObject({
      nome: "Implantes Sarandi",
      totalCriados: 2,
    });
  });

  it("nome ausente → default '{nicho} {DD/MM}'", async () => {
    const res = await POST(searchRequest());

    const { busca } = await res.json();
    expect(busca.nome).toMatch(/^dentista \d{2}\/\d{2}$/);
  });

  it("cada lead ganha o buscaId da busca (array)", async () => {
    const res = await POST(searchRequest());

    const { busca } = await res.json();
    expect(db.getDoc("leads/ChIJ001")).toMatchObject({ buscaId: [busca.id] });
    expect(db.getDoc("leads/ChIJ002")).toMatchObject({ buscaId: [busca.id] });
  });

  it("busca repetida ANEXA o novo buscaId sem apagar o anterior", async () => {
    const primeira = await (await POST(searchRequest())).json();
    const segunda = await (await POST(searchRequest())).json();

    expect(segunda.busca.id).not.toBe(primeira.busca.id);
    expect(db.getDoc("leads/ChIJ001")).toMatchObject({
      buscaId: [primeira.busca.id, segunda.busca.id],
    });
  });

  it("busca repetida não rebaixa status nem duplica leads", async () => {
    await POST(searchRequest());
    const patch = await PATCH(
      new Request("http://localhost/api/leads/ChIJ001", {
        method: "PATCH",
        body: JSON.stringify({ status: "contactado" }),
      }),
      { params: Promise.resolve({ id: "ChIJ001" }) },
    );
    expect(patch.status).toBe(200);

    const res = await POST(searchRequest());

    const data = await res.json();
    expect(data.criados).toBe(0);
    expect(data.existentes).toBe(2);
    expect(data.busca.totalCriados).toBe(0);
    expect(data.busca.totalExistentes).toBe(2);
    expect(db.getDoc("leads/ChIJ001")).toMatchObject({ status: "contactado" });
  });

  it("consome 1 de cota textSearch por busca", async () => {
    await POST(searchRequest());
    await POST(searchRequest());

    const period = new Date().toISOString().slice(0, 7);
    expect(db.getDoc(`usage/${period}`)).toMatchObject({ textSearch: 2 });
  });

  it("teto estourado → 429 quota_exceeded ANTES de chamar o Google, sem doc de busca", async () => {
    db.seed("config/app", {
      nicho: "dentista",
      regiao: "Sarandi PR",
      caps: { textSearch: 0 },
    });

    const res = await POST(searchRequest());

    expect(res.status).toBe(429);
    const { error } = await res.json();
    expect(error).toMatchObject({
      code: "quota_exceeded",
      sku: "textSearch",
      used: 0,
      cap: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("erro do Google → 502 places_error com detalhe", async () => {
    fetchMock.mockImplementation(
      async () => new Response("quota do projeto excedida", { status: 500 }),
    );

    const res = await POST(searchRequest());

    expect(res.status).toBe(502);
    const { error } = await res.json();
    expect(error.code).toBe("places_error");
    expect(error.googleStatus).toBe(500);
    expect(error.detail).toBe("quota do projeto excedida");
  });

  it("sem nicho/regiao no corpo nem na config → 400", async () => {
    db.seed("config/app", { nicho: "", regiao: "" });

    const res = await POST(searchRequest());

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("validation_error");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("nicho não-string → 400", async () => {
    const res = await POST(searchRequest({ nicho: 42 }));

    expect(res.status).toBe(400);
  });

  it("subNicho/nome não-string → 400", async () => {
    const res = await POST(searchRequest({ subNicho: 1, nome: [] }));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.problemas).toEqual([
      "subNicho deve ser string",
      "nome deve ser string",
    ]);
  });

  it("quantidade fora de 1–40 ou não-inteira → 400", async () => {
    for (const quantidade of [0, 41, 2.5, "20"]) {
      const res = await POST(searchRequest({ quantidade }));
      expect(res.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("qualificada não-booleana → 400", async () => {
    const res = await POST(searchRequest({ qualificada: "sim" }));

    expect(res.status).toBe(400);
  });

  it("resposta informa quantas páginas foram consumidas e a região resolvida", async () => {
    const res = await POST(searchRequest({ quantidade: 2 }));

    const data = await res.json();
    expect(data.paginas).toBe(1);
    expect(data.aviso).toBeUndefined();
    expect(data.regiaoResolvida).toBe("Sarandi, PR, Brasil");
  });

  it("menos resultados que o pedido → aviso de resultados esgotados", async () => {
    const res = await POST(searchRequest()); // pediu 20 (default), só há 2

    const data = await res.json();
    expect(data.criados).toBe(2);
    expect(data.aviso).toContain("resultados esgotados");
  });

  it("aplica o locationRestriction (viewport geocodificado) no Text Search", async () => {
    await POST(searchRequest());

    expect(sentSearchBody(0).locationRestriction).toEqual({ rectangle: VIEWPORT });
  });

  it("região sem cache: geocodifica 1 vez, grava /geocache e conta no SKU geocoding", async () => {
    const res = await POST(searchRequest({ regiao: "Maringá PR" }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.regiaoResolvida).toBe("Sarandi, PR, Brasil"); // fixture do geocode
    const geocodeCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("maps/api/geocode"),
    );
    expect(geocodeCalls).toHaveLength(1);
    expect(db.getDoc(`geocache/${regiaoCacheKey("Maringá PR")}`)).toBeDefined();

    const period = new Date().toISOString().slice(0, 7);
    expect(db.getDoc(`usage/${period}`)).toMatchObject({ geocoding: 1 });

    // Segunda busca na mesma região: cache, sem novo geocoding.
    await POST(searchRequest({ regiao: "Maringá PR" }));
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("maps/api/geocode")),
    ).toHaveLength(1);
  });

  it("região que o Google não encontra → 400 validation_error", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes("maps/api/geocode")
        ? new Response(JSON.stringify({ status: "ZERO_RESULTS", results: [] }), {
            status: 200,
          })
        : new Response(JSON.stringify(GOOGLE_PLACES), { status: 200 }),
    );

    const res = await POST(searchRequest({ regiao: "Xyzlândia QQ" }));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("validation_error");
    expect(searchCalls()).toHaveLength(0); // não chegou ao Text Search
  });

  it("teto de geocoding estourado (região sem cache) → 429 do SKU geocoding", async () => {
    db.seed("config/app", {
      nicho: "dentista",
      regiao: "Sarandi PR",
      caps: { geocoding: 0 },
    });

    const res = await POST(searchRequest({ regiao: "Maringá PR" }));

    expect(res.status).toBe(429);
    const { error } = await res.json();
    expect(error.sku).toBe("geocoding");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("20 = 20 novos: pagina até juntar a quantidade de leads INÉDITOS", async () => {
    // ChIJ001 e ChIJ002 já existem na base.
    await POST(searchRequest({ quantidade: 2 }));
    fetchMock.mockClear();

    // Página 1: os 2 existentes + token; página 2: 2 inéditos.
    fetchMock
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({ places: GOOGLE_PLACES.places, nextPageToken: "tok-2" }),
          { status: 200 },
        ),
      )
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            places: [
              { id: "ChIJ003", displayName: { text: "Odonto Nova" } },
              { id: "ChIJ004", displayName: { text: "Sorriso Novo" } },
            ],
          }),
          { status: 200 },
        ),
      );

    const res = await POST(searchRequest({ quantidade: 2 }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.criados).toBe(2); // os 2 inéditos pedidos
    expect(data.existentes).toBe(2); // os repetidos também entram na busca
    expect(data.paginas).toBe(2);
    expect(data.aviso).toBeUndefined();

    const period = new Date().toISOString().slice(0, 7);
    expect(db.getDoc(`usage/${period}`)).toMatchObject({ textSearch: 3 });
  });

  it("quantidade > 20 pagina e o contador reflete as páginas", async () => {
    const muitos = (inicio: number) =>
      Array.from({ length: 20 }, (_, i) => ({
        id: `ChIJ_pg${inicio + i}`,
        displayName: { text: `Lugar ${inicio + i}` },
      }));
    fetchMock
      .mockImplementationOnce(async () =>
        new Response(JSON.stringify({ places: muitos(0), nextPageToken: "tok" }), {
          status: 200,
        }),
      )
      .mockImplementationOnce(async () =>
        new Response(JSON.stringify({ places: muitos(20) }), { status: 200 }),
      );

    const res = await POST(searchRequest({ quantidade: 40 }));

    const data = await res.json();
    expect(data.paginas).toBe(2);
    expect(data.criados).toBe(40);
    const period = new Date().toISOString().slice(0, 7);
    expect(db.getDoc(`usage/${period}`)).toMatchObject({ textSearch: 2 });
  });

  it("teto no meio da paginação → 200 parcial com aviso, leads da 1ª página salvos", async () => {
    db.seed("config/app", {
      nicho: "dentista",
      regiao: "Sarandi PR",
      caps: { textSearch: 1 },
    });
    fetchMock.mockImplementationOnce(async () =>
      new Response(
        JSON.stringify({ places: GOOGLE_PLACES.places, nextPageToken: "tok" }),
        { status: 200 },
      ),
    );

    const res = await POST(searchRequest({ quantidade: 40 }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.criados).toBe(2);
    expect(data.paginas).toBe(1);
    expect(data.aviso).toContain("teto mensal");
  });

  it("busca qualificada marca temSite/siteUrl/siteProprio nos leads salvos — nada fica desconhecido", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          places: [
            {
              id: "ChIJ_qs1",
              displayName: { text: "Com Site" },
              websiteUri: "https://comsite.com.br",
            },
            { id: "ChIJ_qs2", displayName: { text: "Sem Site" } },
            {
              id: "ChIJ_qs3",
              displayName: { text: "Só Instagram" },
              websiteUri: "https://instagram.com/negocio",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const res = await POST(searchRequest({ qualificada: true }));

    expect(res.status).toBe(200);
    expect(db.getDoc("leads/ChIJ_qs1")).toMatchObject({
      temSite: true,
      siteProprio: true,
      siteUrl: "https://comsite.com.br",
      enriquecido: false,
    });
    // Ausência de websiteUri = definitivo (o campo foi pedido no mask).
    expect(db.getDoc("leads/ChIJ_qs2")).toMatchObject({
      temSite: false,
      siteProprio: false,
    });
    // Rede social: tem URL, mas sem site próprio → entra no filtro "sem".
    expect(db.getDoc("leads/ChIJ_qs3")).toMatchObject({
      temSite: true,
      siteProprio: false,
      siteUrl: "https://instagram.com/negocio",
    });

    const period = new Date().toISOString().slice(0, 7);
    expect(db.getDoc(`usage/${period}`)).toMatchObject({ textSearchEnterprise: 1 });
  });

  it("busca básica repetida não apaga o temSite vindo da qualificada", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          places: [{ id: "ChIJ001", displayName: { text: "Clínica Sorriso" } }],
        }),
        { status: 200 },
      ),
    );
    db.seed("leads/ChIJ001", {
      placeId: "ChIJ001",
      nome: "Clínica Sorriso",
      status: "novo",
      temSite: false,
      enriquecido: false,
      buscaId: ["antiga"],
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    await POST(searchRequest());

    expect(db.getDoc("leads/ChIJ001")).toMatchObject({ temSite: false });
  });

  it("a busca criada ganha cor da paleta em rotação", async () => {
    const primeira = await (await POST(searchRequest())).json();
    const segunda = await (await POST(searchRequest())).json();

    expect(typeof primeira.busca.cor).toBe("string");
    expect(primeira.busca.cor).toMatch(/^#/);
    expect(segunda.busca.cor).not.toBe(primeira.busca.cor);
  });
});
