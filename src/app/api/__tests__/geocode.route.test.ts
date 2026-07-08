import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { regiaoCacheKey } from "@/lib/geo/geocode";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { GET } from "../geocode/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const fetchMock = vi.fn();

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

beforeEach(() => {
  db = new FakeFirestore();
  db.seed("config/app", { nicho: "dentista", regiao: "Sarandi PR" });
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    async () => new Response(JSON.stringify(GEOCODE_OK), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "chave-teste");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function geocode(query = ""): Promise<Response> {
  return GET(new Request(`http://localhost/api/geocode${query}`));
}

describe("GET /api/geocode", () => {
  it("resolve a região informada e grava o cache", async () => {
    const res = await geocode("?regiao=Sarandi%20PR");

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      regiao: "Sarandi PR",
      endereco: "Sarandi, PR, Brasil",
      cached: false,
    });
    expect(data.viewport.low.latitude).toBe(-23.5);
    expect(db.getDoc(`geocache/${regiaoCacheKey("Sarandi PR")}`)).toBeDefined();
  });

  it("segunda chamada vem do cache (cached: true, sem fetch)", async () => {
    await geocode("?regiao=Sarandi%20PR");
    fetchMock.mockClear();

    const res = await geocode("?regiao=sarandi+pr");

    const data = await res.json();
    expect(data.cached).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sem ?regiao= usa a região default da config", async () => {
    const res = await geocode();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.regiao).toBe("Sarandi PR");
  });

  it("sem ?regiao= e config vazia → 400", async () => {
    db.seed("config/app", { nicho: "dentista", regiao: "" });

    const res = await geocode();

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ZERO_RESULTS → 400 validation_error", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ status: "ZERO_RESULTS", results: [] }), {
          status: 200,
        }),
    );

    const res = await geocode("?regiao=Xyzl%C3%A2ndia");

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("validation_error");
  });

  it("teto de geocoding estourado → 429 quota_exceeded", async () => {
    db.seed("config/app", {
      nicho: "dentista",
      regiao: "Sarandi PR",
      caps: { geocoding: 0 },
    });

    const res = await geocode("?regiao=Maring%C3%A1%20PR");

    expect(res.status).toBe(429);
    const { error } = await res.json();
    expect(error).toMatchObject({ code: "quota_exceeded", sku: "geocoding" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
