import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  db = new FakeFirestore();
  db.seed("config/app", { nicho: "dentista", regiao: "Sarandi PR" });
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    async () => new Response(JSON.stringify(GOOGLE_PLACES), { status: 200 }),
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

    const query = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(query.textQuery).toBe("dentista em Sarandi PR");

    expect(db.getDoc("leads/ChIJ001")).toMatchObject({ status: "novo" });
  });

  it("corpo sobrepõe a config", async () => {
    await POST(searchRequest({ nicho: "pizzaria", regiao: "Maringá PR" }));

    const query = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(query.textQuery).toBe("pizzaria em Maringá PR");
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
    expect(db.getDoc("leads/ChIJ001")).toMatchObject({ status: "contactado" });
  });

  it("consome 1 de cota textSearch por busca", async () => {
    await POST(searchRequest());
    await POST(searchRequest());

    const period = new Date().toISOString().slice(0, 7);
    expect(db.getDoc(`usage/${period}`)).toMatchObject({ textSearch: 2 });
  });

  it("teto estourado → 429 quota_exceeded ANTES de chamar o Google", async () => {
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
});
