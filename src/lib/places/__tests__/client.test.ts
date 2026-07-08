import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CAPS, FIELD_MASKS, QuotaExceededError } from "@/lib/costs";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { PlacesError, placeDetails, searchText } from "../client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function usageDoc(db: FakeFirestore): Record<string, unknown> | undefined {
  const period = new Date().toISOString().slice(0, 7);
  return db.getDoc(`usage/${period}`);
}

function googlePlaces(inicio: number, total: number, comSite = false) {
  return Array.from({ length: total }, (_, i) => ({
    id: `ChIJ${String(inicio + i).padStart(3, "0")}`,
    displayName: { text: `Lugar ${inicio + i}` },
    formattedAddress: `Rua ${inicio + i} - Sarandi, PR`,
    ...(comSite && inicio + i === 1 && { websiteUri: "https://lugar1.com.br" }),
  }));
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>, call = 0): Record<string, unknown> {
  return JSON.parse(
    (fetchMock.mock.calls[call][1] as RequestInit).body as string,
  ) as Record<string, unknown>;
}

function sentMask(fetchMock: ReturnType<typeof vi.fn>, call = 0): string {
  const headers = (fetchMock.mock.calls[call][1] as RequestInit).headers as Record<
    string,
    string
  >;
  return headers["X-Goog-FieldMask"];
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

describe("searchText — básica (SKU textSearch)", () => {
  it("usa o field mask Pro, mapeia resultados e não marca temSite", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ places: googlePlaces(1, 2) }),
    );

    const result = await searchText(db, "dentista Sarandi PR", DEFAULT_CAPS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentMask(fetchMock)).toBe(FIELD_MASKS.textSearch);
    expect(sentBody(fetchMock)).toMatchObject({
      textQuery: "dentista Sarandi PR",
      languageCode: "pt-BR",
      pageSize: 20,
    });
    expect(result.paginas).toBe(1);
    // Pediu 20 (default) e o Google só tinha 2 — aviso de busca parcial.
    expect(result.aviso).toContain("resultados esgotados");
    expect(result.novos).toBe(2);
    expect(result.places).toHaveLength(2);
    expect(result.places[0]).toEqual({
      placeId: "ChIJ001",
      nome: "Lugar 1",
      endereco: "Rua 1 - Sarandi, PR",
      location: undefined,
    });
    expect(result.places[0].temSite).toBeUndefined();
    expect(result.places[0].temTelefone).toBeUndefined();
    expect(usageDoc(db)).toMatchObject({ textSearch: 1 });
  });

  it("resultado sem Place ID é ignorado", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ places: [{ displayName: { text: "Sem ID" } }, ...googlePlaces(1, 1)] }),
    );

    const result = await searchText(db, "dentista", DEFAULT_CAPS);

    expect(result.places).toHaveLength(1);
  });

  it("teto estourado na 1ª página → QuotaExceededError e o Google NÃO é chamado", async () => {
    await expect(
      searchText(db, "dentista", { ...DEFAULT_CAPS, textSearch: 0 }),
    ).rejects.toThrow(QuotaExceededError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("erro do Google na 1ª página → PlacesError com detalhe, cota consumida", async () => {
    fetchMock.mockImplementation(
      async () => new Response("API key inválida", { status: 403 }),
    );

    const error = await searchText(db, "dentista", DEFAULT_CAPS).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PlacesError);
    expect((error as PlacesError).googleStatus).toBe(403);
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

describe("searchText — quantidade e paginação", () => {
  it("quantidade ≤ 20 vira pageSize de 1 request", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ places: googlePlaces(1, 5) }),
    );

    const result = await searchText(db, "dentista", DEFAULT_CAPS, { quantidade: 5 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBody(fetchMock).pageSize).toBe(5);
    expect(result.paginas).toBe(1);
    expect(result.novos).toBe(5);
    expect(result.aviso).toBeUndefined();
    expect(usageDoc(db)).toMatchObject({ textSearch: 1 });
  });

  it("21–40 pagina com nextPageToken, cada página consumindo 1 de cota", async () => {
    fetchMock
      .mockImplementationOnce(async () =>
        jsonResponse({ places: googlePlaces(1, 20), nextPageToken: "tok-2" }),
      )
      .mockImplementationOnce(async () =>
        jsonResponse({ places: googlePlaces(21, 20) }),
      );

    const result = await searchText(db, "dentista", DEFAULT_CAPS, { quantidade: 30 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // pageSize constante entre páginas (exigência da API de continuação).
    expect(sentBody(fetchMock, 0).pageSize).toBe(20);
    expect(sentBody(fetchMock, 0).pageToken).toBeUndefined();
    expect(sentBody(fetchMock, 1)).toMatchObject({ pageToken: "tok-2", pageSize: 20 });
    expect(result.paginas).toBe(2);
    // A 2ª página inteira fica (já foi paga), mesmo passando da quantidade.
    expect(result.places).toHaveLength(40);
    expect(result.novos).toBe(40);
    expect(usageDoc(db)).toMatchObject({ textSearch: 2 });
  });

  it("para cedo quando o Google não devolve nextPageToken, com aviso de esgotado", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ places: googlePlaces(1, 8) }),
    );

    const result = await searchText(db, "dentista", DEFAULT_CAPS, { quantidade: 40 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.places).toHaveLength(8);
    expect(result.aviso).toContain("resultados esgotados");
  });

  it("só NOVOS contam para a quantidade: pagina até juntar N inéditos", async () => {
    // Página 1: 20 resultados, mas 15 já existem na base → 5 novos.
    // Página 2: mais 20, todos novos → para com 25 novos (≥ 20 pedidos).
    fetchMock
      .mockImplementationOnce(async () =>
        jsonResponse({ places: googlePlaces(1, 20), nextPageToken: "tok-2" }),
      )
      .mockImplementationOnce(async () =>
        jsonResponse({ places: googlePlaces(21, 20), nextPageToken: "tok-3" }),
      );
    const existentes = new Set(
      Array.from({ length: 15 }, (_, i) => `ChIJ${String(1 + i).padStart(3, "0")}`),
    );

    const result = await searchText(db, "dentista", DEFAULT_CAPS, {
      quantidade: 20,
      isNovo: async (placeId) => !existentes.has(placeId),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.paginas).toBe(2);
    expect(result.novos).toBe(25);
    // Os existentes continuam no retorno — o upsert anexa a busca a eles.
    expect(result.places).toHaveLength(40);
    expect(result.aviso).toBeUndefined();
    expect(usageDoc(db)).toMatchObject({ textSearch: 2 });
  });

  it("respeita o limite de 3 páginas do Google mesmo faltando novos", async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { pageToken?: string };
      const inicio = body.pageToken === "tok-3" ? 41 : body.pageToken === "tok-2" ? 21 : 1;
      return jsonResponse({
        places: googlePlaces(inicio, 20),
        nextPageToken: inicio === 1 ? "tok-2" : inicio === 21 ? "tok-3" : "tok-4",
      });
    });

    const result = await searchText(db, "dentista", DEFAULT_CAPS, {
      quantidade: 40,
      isNovo: async () => false, // tudo já existe na base
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.paginas).toBe(3);
    expect(result.novos).toBe(0);
    expect(result.aviso).toContain("limite de 3 páginas");
    expect(usageDoc(db)).toMatchObject({ textSearch: 3 });
  });

  it("repassa o locationRestriction (retângulo) no corpo de todas as páginas", async () => {
    fetchMock
      .mockImplementationOnce(async () =>
        jsonResponse({ places: googlePlaces(1, 20), nextPageToken: "tok-2" }),
      )
      .mockImplementationOnce(async () => jsonResponse({ places: googlePlaces(21, 5) }));
    const rect = {
      low: { latitude: -23.5, longitude: -51.95 },
      high: { latitude: -23.38, longitude: -51.8 },
    };

    await searchText(db, "dentista", DEFAULT_CAPS, {
      quantidade: 40,
      locationRestriction: rect,
    });

    expect(sentBody(fetchMock, 0).locationRestriction).toEqual({ rectangle: rect });
    expect(sentBody(fetchMock, 1).locationRestriction).toEqual({ rectangle: rect });
  });

  it("teto no meio da paginação → devolve a 1ª página com aviso", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ places: googlePlaces(1, 20), nextPageToken: "tok-2" }),
    );

    const result = await searchText(
      db,
      "dentista",
      { ...DEFAULT_CAPS, textSearch: 1 },
      { quantidade: 40 },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.places).toHaveLength(20);
    expect(result.paginas).toBe(1);
    expect(result.aviso).toContain("teto mensal");
    expect(usageDoc(db)).toMatchObject({ textSearch: 1 });
  });

  it("erro do Google na 2ª página → devolve a 1ª com aviso (cota das 2 consumida)", async () => {
    fetchMock
      .mockImplementationOnce(async () =>
        jsonResponse({ places: googlePlaces(1, 20), nextPageToken: "tok-2" }),
      )
      .mockImplementationOnce(async () => new Response("boom", { status: 500 }));

    const result = await searchText(db, "dentista", DEFAULT_CAPS, { quantidade: 40 });

    expect(result.places).toHaveLength(20);
    expect(result.paginas).toBe(1);
    expect(result.aviso).toContain("página 2");
    expect(usageDoc(db)).toMatchObject({ textSearch: 2 });
  });

  it("quantidade é limitada a 1..40", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ places: googlePlaces(1, 1) }),
    );

    await searchText(db, "dentista", DEFAULT_CAPS, { quantidade: 999 });
    expect(sentBody(fetchMock, 0).pageSize).toBe(20);

    fetchMock.mockClear();
    fetchMock.mockImplementation(async () =>
      jsonResponse({ places: googlePlaces(1, 1) }),
    );
    await searchText(db, "dentista", DEFAULT_CAPS, { quantidade: 0 });
    expect(sentBody(fetchMock, 0).pageSize).toBe(1);
  });
});

describe("searchText — qualificada (SKU textSearchEnterprise)", () => {
  it("usa o mask com websiteUri e telefones, conta no SKU Enterprise e marca temSite", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({
        places: [
          {
            id: "ChIJ001",
            displayName: { text: "Lugar 1" },
            websiteUri: "https://lugar1.com.br",
            nationalPhoneNumber: "(44) 3264-0000",
            internationalPhoneNumber: "+55 44 3264-0000",
          },
          { id: "ChIJ002", displayName: { text: "Lugar 2" } },
        ],
      }),
    );

    const result = await searchText(db, "dentista", DEFAULT_CAPS, { qualificada: true });

    expect(sentMask(fetchMock)).toBe(FIELD_MASKS.textSearchEnterprise);
    expect(sentMask(fetchMock)).toContain("places.websiteUri");
    expect(sentMask(fetchMock)).toContain("places.nationalPhoneNumber");
    expect(sentMask(fetchMock)).toContain("places.internationalPhoneNumber");
    expect(usageDoc(db)).toMatchObject({ textSearchEnterprise: 1, textSearch: 0 });

    expect(result.places[0]).toMatchObject({
      placeId: "ChIJ001",
      temSite: true,
      siteProprio: true,
      siteUrl: "https://lugar1.com.br",
      temTelefone: true,
      telefone: "(44) 3264-0000",
      telefoneIntl: "+55 44 3264-0000",
    });
    expect(result.places[1]).toMatchObject({
      placeId: "ChIJ002",
      temSite: false,
      siteProprio: false,
      temTelefone: false,
    });
    expect(result.places[1].siteUrl).toBeUndefined();
    expect(result.places[1].telefone).toBeUndefined();
  });

  it("na qualificada NADA fica desconhecido: temSite/siteProprio definidos em todo resultado", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({
        places: [
          { id: "ChIJ_a", displayName: { text: "A" }, websiteUri: "https://a.com.br" },
          { id: "ChIJ_b", displayName: { text: "B" } },
          { id: "ChIJ_c", displayName: { text: "C" }, websiteUri: "" },
        ],
      }),
    );

    const result = await searchText(db, "dentista", DEFAULT_CAPS, { qualificada: true });

    for (const place of result.places) {
      expect(typeof place.temSite).toBe("boolean");
      expect(typeof place.siteProprio).toBe("boolean");
    }
    // Ausência de websiteUri = NÃO tem site, definitivo (o campo foi pedido no mask).
    expect(result.places[1]).toMatchObject({ temSite: false, siteProprio: false });
    expect(result.places[2]).toMatchObject({ temSite: false, siteProprio: false });
  });

  it("websiteUri de rede social/agregador → temSite=true mas siteProprio=false", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({
        places: [
          {
            id: "ChIJ_ig",
            displayName: { text: "Só Instagram" },
            websiteUri: "https://www.instagram.com/soinstagram",
          },
          {
            id: "ChIJ_wa",
            displayName: { text: "Só WhatsApp" },
            websiteUri: "https://wa.me/5544999990000",
          },
          {
            id: "ChIJ_ok",
            displayName: { text: "Site de verdade" },
            websiteUri: "https://sitedeverdade.com.br",
          },
        ],
      }),
    );

    const result = await searchText(db, "dentista", DEFAULT_CAPS, { qualificada: true });

    // Tem URL (temSite=true), mas não é site próprio — lead segue quente.
    expect(result.places[0]).toMatchObject({
      temSite: true,
      siteProprio: false,
      siteUrl: "https://www.instagram.com/soinstagram",
    });
    expect(result.places[1]).toMatchObject({ temSite: true, siteProprio: false });
    expect(result.places[2]).toMatchObject({ temSite: true, siteProprio: true });
  });

  it("teto do SKU Enterprise separado do básico", async () => {
    await expect(
      searchText(db, "dentista", { ...DEFAULT_CAPS, textSearchEnterprise: 0 }, {
        qualificada: true,
      }),
    ).rejects.toThrow(QuotaExceededError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("placeDetails (SKU detailsEnterprise)", () => {
  it("chama o endpoint do lugar com o field mask Enterprise e mapeia os campos", async () => {
    fetchMock.mockImplementation(async () =>
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

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(
      "https://places.googleapis.com/v1/places/ChIJ001?languageCode=pt-BR",
    );
    expect(sentMask(fetchMock)).toBe(FIELD_MASKS.detailsEnterprise);

    expect(detalhes).toEqual({
      telefone: "(44) 3264-0000",
      telefoneIntl: "+55 44 3264-0000",
      site: "https://clinicasorriso.com.br",
      rating: 4.7,
      totalAvaliacoes: 132,
    });
    expect(usageDoc(db)).toMatchObject({ detailsEnterprise: 1 });
  });

  it("lugar sem site/telefone → campos undefined (lead quente)", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ id: "ChIJ003", rating: 4.1 }));

    const detalhes = await placeDetails(db, "ChIJ003", DEFAULT_CAPS);

    expect(detalhes.site).toBeUndefined();
    expect(detalhes.telefone).toBeUndefined();
    expect(detalhes.rating).toBe(4.1);
  });

  it("teto detailsEnterprise estourado → QuotaExceededError sem chamar o Google", async () => {
    await expect(
      placeDetails(db, "ChIJ001", { ...DEFAULT_CAPS, detailsEnterprise: 0 }),
    ).rejects.toThrow(QuotaExceededError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("404 do Google → PlacesError com status e detalhe", async () => {
    fetchMock.mockImplementation(async () => new Response("Not Found", { status: 404 }));

    const error = await placeDetails(db, "ChIJ404", DEFAULT_CAPS).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PlacesError);
    expect((error as PlacesError).googleStatus).toBe(404);
    expect((error as PlacesError).detail).toBe("Not Found");
  });
});
