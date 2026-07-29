import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { regiaoCacheKey } from "@/lib/geo/geocode";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { PATCH as ajustar } from "../regioes/ajustar/route";
import { GET } from "../regioes/route";
import { POST as regenerar } from "../regioes/regenerar/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const GEOCODE_ZURIQUE = {
  status: "OK",
  results: [
    {
      formatted_address: "Zürich, Suíça",
      geometry: {
        location: { lat: 47.37, lng: 8.54 },
        viewport: {
          northeast: { lat: 47.43, lng: 8.62 },
          southwest: { lat: 47.32, lng: 8.45 },
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

const INDICE_ZURIQUE = {
  indice: 3.5,
  moedaLocal: "CHF",
  cambioAproxBRL: 6.1,
  faixaMercadoLocal: "300–800 CHF",
  justificativa: "Zurique tem alto custo de vida e forte poder aquisitivo.",
  confianca: "alta",
};

const fetchMock = vi.fn();

beforeEach(() => {
  db = new FakeFirestore();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes("generativelanguage.googleapis.com")) {
      return respostaGemini(INDICE_ZURIQUE);
    }
    return new Response(JSON.stringify(GEOCODE_ZURIQUE), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "chave-places");
  vi.stubEnv("GEMINI_API_KEY", "chave-gemini");
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function get(query: string): Promise<Response> {
  return GET(new Request(`http://localhost/api/regioes${query}`));
}

const SLUG = regiaoCacheKey("Zurique");

function usageDoc(): Record<string, unknown> | undefined {
  return db.getDoc(`usage/${new Date().toISOString().slice(0, 7)}`);
}

describe("GET /api/regioes", () => {
  it("primeira vez: geocodifica, gera via IA (1 chamada) e cacheia PERMANENTEMENTE", async () => {
    const res = await get("?regiao=Zurique");

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cached).toBe(false);
    expect(data.regiao).toMatchObject({
      slug: SLUG,
      cidade: "Zürich",
      pais: "Suíça",
      indice: 3.5,
      moedaLocal: "CHF",
      confianca: "alta",
    });
    expect(typeof data.regiao.geradoEm).toBe("string");
    expect(usageDoc()).toMatchObject({ geocoding: 1, aiGeneration: 1 });
    expect(db.getDoc(`regioes/${SLUG}`)).toMatchObject({ indice: 3.5 });
  });

  it("segunda chamada vem do cache PERMANENTE — sem geocoding nem Gemini de novo", async () => {
    await get("?regiao=Zurique");
    fetchMock.mockClear();

    const res = await get("?regiao=zurique");

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cached).toBe(true);
    expect(data.regiao.indice).toBe(3.5);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("indiceAjustado (quando presente) vem junto no doc devolvido", async () => {
    await get("?regiao=Zurique");
    await ajustar(
      new Request("http://localhost/api/regioes/ajustar", {
        method: "PATCH",
        body: JSON.stringify({ regiao: "Zurique", indiceAjustado: 2.2 }),
        headers: { cookie: await cookieDeSessao(db, { id: "chefe", papel: "admin" }) },
      }),
    );

    const res = await get("?regiao=Zurique");
    const data = await res.json();
    expect(data.regiao.indice).toBe(3.5);
    expect(data.regiao.indiceAjustado).toBe(2.2);
  });

  it("sem GEMINI_API_KEY e sem cache ainda → 503 ai_unavailable (mas geocoding já rodou)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const res = await get("?regiao=Zurique");

    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("ai_unavailable");
    expect(db.getDoc(`regioes/${SLUG}`)).toBeUndefined();
  });

  it("resposta do Gemini fora do schema → 502 ai_error", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("generativelanguage.googleapis.com")) {
        return respostaGemini({ qualquer: "coisa" });
      }
      return new Response(JSON.stringify(GEOCODE_ZURIQUE), { status: 200 });
    });

    const res = await get("?regiao=Zurique");

    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("ai_error");
  });

  it("sem ?regiao= e sem região default na config → 400", async () => {
    const res = await get("");
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/regioes/regenerar", () => {
  function post(regiao: unknown, cookie?: string): Promise<Response> {
    return regenerar(
      new Request("http://localhost/api/regioes/regenerar", {
        method: "POST",
        body: JSON.stringify({ regiao }),
        ...(cookie && { headers: { cookie } }),
      }),
    );
  }

  it("sem sessão → 401", async () => {
    expect((await post("Zurique")).status).toBe(401);
  });

  it("membro (não admin) → 403", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    expect((await post("Zurique", cookie)).status).toBe(403);
  });

  it("região sem índice gerado ainda → 404", async () => {
    const cookie = await cookieDeSessao(db, { id: "chefe", papel: "admin" });
    expect((await post("Zurique", cookie)).status).toBe(404);
  });

  it("admin regenera: sobrescreve indice, PRESERVA indiceAjustado, sem geocodificar de novo", async () => {
    await get("?regiao=Zurique");
    const cookie = await cookieDeSessao(db, { id: "chefe", papel: "admin" });
    await ajustar(
      new Request("http://localhost/api/regioes/ajustar", {
        method: "PATCH",
        body: JSON.stringify({ regiao: "Zurique", indiceAjustado: 2.2 }),
        headers: { cookie },
      }),
    );
    fetchMock.mockClear();
    fetchMock.mockImplementation(async () =>
      respostaGemini({ ...INDICE_ZURIQUE, indice: 4.1, justificativa: "Nova análise." }),
    );

    const res = await post("Zurique", cookie);

    expect(res.status).toBe(200);
    const { regiao } = await res.json();
    expect(regiao.indice).toBe(4.1);
    expect(regiao.indiceAjustado).toBe(2.2);
    // Só 1 chamada de rede (Gemini) — não geocodificou de novo.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(usageDoc()).toMatchObject({ geocoding: 1, aiGeneration: 2 });
  });
});

describe("PATCH /api/regioes/ajustar", () => {
  function patch(body: unknown, cookie?: string): Promise<Response> {
    return ajustar(
      new Request("http://localhost/api/regioes/ajustar", {
        method: "PATCH",
        body: JSON.stringify(body),
        ...(cookie && { headers: { cookie } }),
      }),
    );
  }

  it("sem sessão → 401", async () => {
    expect((await patch({ regiao: "Zurique", indiceAjustado: 2 })).status).toBe(401);
  });

  it("membro (não admin) → 403", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    expect((await patch({ regiao: "Zurique", indiceAjustado: 2 }, cookie)).status).toBe(403);
  });

  it("admin seta o ajuste, que passa a valer sobre o gerado", async () => {
    await get("?regiao=Zurique");
    const cookie = await cookieDeSessao(db, { id: "chefe", papel: "admin" });

    const res = await patch({ regiao: "Zurique", indiceAjustado: 2.2 }, cookie);

    expect(res.status).toBe(200);
    const { regiao } = await res.json();
    expect(regiao.indiceAjustado).toBe(2.2);
    expect(regiao.indice).toBe(3.5);
  });

  it("null limpa o ajuste", async () => {
    await get("?regiao=Zurique");
    const cookie = await cookieDeSessao(db, { id: "chefe", papel: "admin" });
    await patch({ regiao: "Zurique", indiceAjustado: 2.2 }, cookie);

    const res = await patch({ regiao: "Zurique", indiceAjustado: null }, cookie);

    expect(res.status).toBe(200);
    expect((await res.json()).regiao.indiceAjustado).toBeUndefined();
  });

  it("indiceAjustado inválido (≤0) → 400", async () => {
    await get("?regiao=Zurique");
    const cookie = await cookieDeSessao(db, { id: "chefe", papel: "admin" });

    expect((await patch({ regiao: "Zurique", indiceAjustado: 0 }, cookie)).status).toBe(400);
  });

  it("região sem índice gerado ainda → 404", async () => {
    const cookie = await cookieDeSessao(db, { id: "chefe", papel: "admin" });
    expect((await patch({ regiao: "Fantasma", indiceAjustado: 2 }, cookie)).status).toBe(404);
  });
});
