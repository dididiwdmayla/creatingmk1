import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { GET } from "../search/termo-local/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const GEOCODE_MIAMI = {
  status: "OK",
  results: [
    {
      formatted_address: "Miami, FL, Estados Unidos",
      geometry: {
        location: { lat: 25.76, lng: -80.19 },
        viewport: {
          northeast: { lat: 25.9, lng: -80.1 },
          southwest: { lat: 25.6, lng: -80.3 },
        },
      },
    },
  ],
};

const GEOCODE_SARANDI = {
  status: "OK",
  results: [
    {
      formatted_address: "Sarandi, PR, Brasil",
      geometry: {
        location: { lat: -23.44, lng: -51.87 },
        viewport: {
          northeast: { lat: -23.38, lng: -51.8 },
          southwest: { lat: -23.5, lng: -51.95 },
        },
      },
    },
  ],
};

function respostaGemini(json: unknown): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }],
    }),
    { status: 200 },
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  db = new FakeFirestore();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes("generativelanguage.googleapis.com")) {
      return respostaGemini({ termo: "barbershop" });
    }
    return new Response(JSON.stringify(GEOCODE_MIAMI), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "chave-places");
  vi.stubEnv("GEMINI_API_KEY", "chave-gemini");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function get(query: string): Promise<Response> {
  return GET(new Request(`http://localhost/api/search/termo-local${query}`));
}

describe("GET /api/search/termo-local", () => {
  it("região de país não-lusófono, sem cache: gera via Gemini (1 chamada) e cacheia", async () => {
    const res = await get("?nicho=barbearia&regiao=Miami FL");

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      disponivel: true,
      pais: "Estados Unidos",
      idioma: "inglês",
      termo: "barbershop",
    });
    expect(db.getDoc(`traducoesNicho/${encodeURIComponent("barbearia::en-US")}`)).toMatchObject({
      termo: "barbershop",
    });
  });

  it("segunda chamada do mesmo par nicho+idioma vem do cache — sem chamar o Gemini de novo", async () => {
    await get("?nicho=barbearia&regiao=Miami FL");
    fetchMock.mockClear();

    const res = await get("?nicho=Barbearia&regiao=miami fl");

    expect(res.status).toBe(200);
    expect((await res.json()).termo).toBe("barbershop");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("região brasileira (lusófona): disponivel false, sem chamar o Gemini", async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify(GEOCODE_SARANDI), { status: 200 }),
    );

    const res = await get("?nicho=barbearia&regiao=Sarandi PR");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ disponivel: false });
    expect(fetchMock).toHaveBeenCalledTimes(1); // só o geocoding, nunca o Gemini
  });

  it("sem GEMINI_API_KEY: disponivel false, sem chamar geocode nem Gemini", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const res = await get("?nicho=barbearia&regiao=Miami FL");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ disponivel: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("nicho vazio: disponivel false, sem chamar geocode nem Gemini", async () => {
    const res = await get("?nicho=&regiao=Miami FL");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ disponivel: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sem ?regiao= e sem região default na config → 400", async () => {
    const res = await get("?nicho=barbearia");

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resposta do Gemini fora do schema → 502 ai_error", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("generativelanguage.googleapis.com")) {
        return respostaGemini({ qualquer: "coisa" });
      }
      return new Response(JSON.stringify(GEOCODE_MIAMI), { status: 200 });
    });

    const res = await get("?nicho=barbearia&regiao=Miami FL");

    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("ai_error");
  });
});
