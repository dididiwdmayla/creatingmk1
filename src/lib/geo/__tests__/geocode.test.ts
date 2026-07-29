import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CAPS, QuotaExceededError } from "@/lib/costs";
import { ValidationError } from "@/lib/errors";
import { PlacesError } from "@/lib/places/client";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { geocodeRegion, idiomaDoEndereco, regiaoCacheKey } from "../geocode";

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

let db: FakeFirestore;
const fetchMock = vi.fn();

beforeEach(() => {
  db = new FakeFirestore();
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

function usageDoc(): Record<string, unknown> | undefined {
  const period = new Date().toISOString().slice(0, 7);
  return db.getDoc(`usage/${period}`);
}

describe("regiaoCacheKey", () => {
  it("normaliza caixa e espaços e escapa separadores", () => {
    expect(regiaoCacheKey("  Sarandi   PR ")).toBe("sarandi%20pr");
    expect(regiaoCacheKey("Sarandi PR")).toBe(regiaoCacheKey("sarandi pr"));
    expect(regiaoCacheKey("a/b")).not.toContain("/");
  });
});

describe("geocodeRegion", () => {
  it("resolve via Google, consome 1 de cota geocoding e grava o cache", async () => {
    const geo = await geocodeRegion(db, "Sarandi PR", DEFAULT_CAPS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("maps/api/geocode/json");
    expect(url).toContain("address=Sarandi%20PR");
    expect(url).toContain("language=pt-BR");

    expect(geo.cached).toBe(false);
    expect(geo.endereco).toBe("Sarandi, PR, Brasil");
    expect(geo.viewport).toEqual({
      low: { latitude: -23.5, longitude: -51.95 },
      high: { latitude: -23.38, longitude: -51.8 },
    });
    expect(geo.idioma).toBe("pt-BR");
    expect(usageDoc()).toMatchObject({ geocoding: 1 });
    expect(db.getDoc(`geocache/${regiaoCacheKey("Sarandi PR")}`)).toMatchObject({
      endereco: "Sarandi, PR, Brasil",
      idioma: "pt-BR",
    });
  });

  it("cache hit: não chama o Google nem consome cota", async () => {
    await geocodeRegion(db, "Sarandi PR", DEFAULT_CAPS);
    fetchMock.mockClear();

    const geo = await geocodeRegion(db, "  sarandi  pr ", DEFAULT_CAPS);

    expect(geo.cached).toBe(true);
    expect(geo.endereco).toBe("Sarandi, PR, Brasil");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(usageDoc()).toMatchObject({ geocoding: 1 });
  });

  it("teto geocoding estourado → QuotaExceededError sem chamar o Google", async () => {
    await expect(
      geocodeRegion(db, "Sarandi PR", { ...DEFAULT_CAPS, geocoding: 0 }),
    ).rejects.toThrow(QuotaExceededError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ZERO_RESULTS → ValidationError (região não encontrada), sem cache", async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ status: "ZERO_RESULTS", results: [] }), { status: 200 }),
    );

    await expect(geocodeRegion(db, "Xyzlândia QQ", DEFAULT_CAPS)).rejects.toThrow(
      ValidationError,
    );
    expect(db.getDoc(`geocache/${regiaoCacheKey("Xyzlândia QQ")}`)).toBeUndefined();
    // A cota foi reservada antes do request — lado seguro.
    expect(usageDoc()).toMatchObject({ geocoding: 1 });
  });

  it("status de erro do Google → PlacesError com detalhe", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ status: "REQUEST_DENIED", error_message: "chave inválida" }),
          { status: 200 },
        ),
    );

    const error = await geocodeRegion(db, "Sarandi PR", DEFAULT_CAPS).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(PlacesError);
    expect((error as PlacesError).detail).toContain("REQUEST_DENIED");
    expect((error as PlacesError).detail).toContain("chave inválida");
  });

  it("HTTP não-ok → PlacesError com o status", async () => {
    fetchMock.mockImplementation(async () => new Response("boom", { status: 500 }));

    const error = await geocodeRegion(db, "Sarandi PR", DEFAULT_CAPS).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(PlacesError);
    expect((error as PlacesError).googleStatus).toBe(500);
  });

  it("região vazia → ValidationError sem custo", async () => {
    await expect(geocodeRegion(db, "   ", DEFAULT_CAPS)).rejects.toThrow(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(usageDoc()).toBeUndefined();
  });

  it("região de país não-lusófono resolve o idioma-alvo da IA (ver 'Idioma da IA na demo')", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
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
          }),
          { status: 200 },
        ),
    );

    const geo = await geocodeRegion(db, "Miami FL", DEFAULT_CAPS);

    expect(geo.idioma).toBe("en-US");
  });

  it("cache antigo sem idioma deriva na leitura, sem regravar o doc", async () => {
    db.seed(`geocache/${regiaoCacheKey("Zurique")}`, {
      regiao: "Zurique",
      endereco: "Zürich, Suíça",
      location: { lat: 47.37, lng: 8.54 },
      viewport: {
        low: { latitude: 47.3, longitude: 8.4 },
        high: { latitude: 47.43, longitude: 8.6 },
      },
      criadoEm: "2026-01-01T00:00:00.000Z",
    });

    const geo = await geocodeRegion(db, "Zurique", DEFAULT_CAPS);

    expect(geo.cached).toBe(true);
    expect(geo.idioma).toBe("de-CH");
    expect(db.getDoc(`geocache/${regiaoCacheKey("Zurique")}`)).not.toHaveProperty("idioma");
  });
});

describe("idiomaDoEndereco", () => {
  it("default pt-BR pro Brasil e países desconhecidos", () => {
    expect(idiomaDoEndereco("Sarandi, PR, Brasil")).toBe("pt-BR");
    expect(idiomaDoEndereco("Nárnia")).toBe("pt-BR");
  });

  it("resolve países fora do Brasil", () => {
    expect(idiomaDoEndereco("Lisboa, Portugal")).toBe("pt-PT");
    expect(idiomaDoEndereco("Madrid, Espanha")).toBe("es-ES");
    expect(idiomaDoEndereco("Paris, França")).toBe("fr-FR");
  });
});
