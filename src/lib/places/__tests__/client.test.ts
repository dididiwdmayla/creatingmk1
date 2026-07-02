import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CAPS, FIELD_MASKS, QuotaExceededError } from "@/lib/costs";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { PlacesError, placeDetails, searchText } from "../client";

const NOW_PERIOD_DOC_PREFIX = "usage/";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function usageDoc(db: FakeFirestore): Record<string, unknown> | undefined {
  const period = new Date().toISOString().slice(0, 7);
  return db.getDoc(`${NOW_PERIOD_DOC_PREFIX}${period}`);
}

let db: FakeFirestore;
const fetchMock = vi.fn();

beforeEach(() => {
  db = new FakeFirestore();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "chave-teste");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("searchText", () => {
  it("chama o endpoint com o field mask do SKU textSearch e mapeia os resultados", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        places: [
          {
            id: "ChIJ001",
            displayName: { text: "Clínica Sorriso" },
            formattedAddress: "Av. Brasil, 123 - Sarandi, PR",
            location: { latitude: -23.44, longitude: -51.87 },
          },
          { displayName: { text: "Sem ID, ignorado" } },
          { id: "ChIJ002" },
        ],
      }),
    );

    const places = await searchText(db, "dentista em Sarandi PR", DEFAULT_CAPS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Goog-FieldMask"]).toBe(FIELD_MASKS.textSearch);
    expect(headers["X-Goog-Api-Key"]).toBe("chave-teste");
    expect(JSON.parse(init.body as string)).toEqual({
      textQuery: "dentista em Sarandi PR",
      languageCode: "pt-BR",
      pageSize: 20,
    });

    expect(places).toEqual([
      {
        placeId: "ChIJ001",
        nome: "Clínica Sorriso",
        endereco: "Av. Brasil, 123 - Sarandi, PR",
        location: { lat: -23.44, lng: -51.87 },
      },
      { placeId: "ChIJ002", nome: "(sem nome)", endereco: undefined, location: undefined },
    ]);
  });

  it("consome 1 de cota textSearch por chamada", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ places: [] }));

    await searchText(db, "dentista em Sarandi PR", DEFAULT_CAPS);
    await searchText(db, "dentista em Sarandi PR", DEFAULT_CAPS);

    expect(usageDoc(db)).toMatchObject({ textSearch: 2 });
  });

  it("teto estourado → QuotaExceededError e o Google NÃO é chamado", async () => {
    await expect(
      searchText(db, "dentista", { ...DEFAULT_CAPS, textSearch: 0 }),
    ).rejects.toThrow(QuotaExceededError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("erro do Google → PlacesError com detalhe, e a cota fica consumida", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: "API key inválida" } }, 403),
    );

    const error = await searchText(db, "dentista", DEFAULT_CAPS).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(PlacesError);
    expect((error as PlacesError).googleStatus).toBe(403);
    expect((error as PlacesError).detail).toContain("API key inválida");
    expect(usageDoc(db)).toMatchObject({ textSearch: 1 });
  });

  it("sem GOOGLE_PLACES_API_KEY → erro antes de consumir cota", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");

    await expect(searchText(db, "dentista", DEFAULT_CAPS)).rejects.toThrow(
      /GOOGLE_PLACES_API_KEY/,
    );
    expect(usageDoc(db)).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("placeDetails", () => {
  it("chama o endpoint do lugar com o field mask Pro e mapeia os campos", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: "ChIJ001",
        nationalPhoneNumber: "(44) 3264-0000",
        internationalPhoneNumber: "+55 44 3264-0000",
        websiteUri: "https://clinicasorriso.com.br",
        rating: 4.7,
        userRatingCount: 132,
      }),
    );

    const detalhes = await placeDetails(db, "ChIJ001", DEFAULT_CAPS);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://places.googleapis.com/v1/places/ChIJ001?languageCode=pt-BR",
    );
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Goog-FieldMask"]).toBe(FIELD_MASKS.detailsPro);

    expect(detalhes).toEqual({
      telefone: "(44) 3264-0000",
      telefoneIntl: "+55 44 3264-0000",
      site: "https://clinicasorriso.com.br",
      rating: 4.7,
      totalAvaliacoes: 132,
    });
    expect(usageDoc(db)).toMatchObject({ detailsPro: 1 });
  });

  it("lugar sem site/telefone → campos undefined (lead quente)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "ChIJ003", rating: 4.1 }));

    const detalhes = await placeDetails(db, "ChIJ003", DEFAULT_CAPS);

    expect(detalhes.site).toBeUndefined();
    expect(detalhes.telefone).toBeUndefined();
    expect(detalhes.rating).toBe(4.1);
  });

  it("teto detailsPro estourado → QuotaExceededError sem chamar o Google", async () => {
    await expect(
      placeDetails(db, "ChIJ001", { ...DEFAULT_CAPS, detailsPro: 0 }),
    ).rejects.toThrow(QuotaExceededError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("404 do Google → PlacesError com status e detalhe", async () => {
    fetchMock.mockResolvedValue(new Response("Not Found", { status: 404 }));

    const error = await placeDetails(db, "ChIJ404", DEFAULT_CAPS).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(PlacesError);
    expect((error as PlacesError).googleStatus).toBe(404);
    expect((error as PlacesError).detail).toBe("Not Found");
  });
});
