import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET, POST } from "../demos-avulsas/importar-maps/route";

let db: FakeFirestore;
let cookie: string;
const fetchMock = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(async () => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "chave-teste");
  cookie = await cookieDeSessao(db, {
    id: "membro-1",
    papel: "membro",
  });
  db.seed("usuarios/membro-1", {
    ...db.getDoc("usuarios/membro-1"),
    limites: { enriquecimentosDia: 2 },
  });
  fetchMock.mockReset();
  fetchMock
    .mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://www.google.com/maps/place/Caf%C3%A9+Central/@-23.4,-51.9,17z" },
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        places: [
          {
            id: "ChIJCafe",
            displayName: { text: "Café Central" },
            formattedAddress: "Av. Brasil, 10, Maringá - PR, Brasil",
            addressComponents: [
              { longText: "Maringá", types: ["locality"] },
              { longText: "Brasil", types: ["country"] },
            ],
            nationalPhoneNumber: "(44) 3000-1000",
            internationalPhoneNumber: "+55 44 3000-1000",
            websiteUri: "https://www.instagram.com/cafecentral/",
            regularOpeningHours: { weekdayDescriptions: ["segunda-feira: 09:00–18:00"] },
          },
        ],
      }),
    );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function importar(link = "https://maps.app.goo.gl/abc") {
  return POST(
    new Request("http://localhost/api/demos-avulsas/importar-maps", {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({ link }),
    }),
  );
}

describe("/api/demos-avulsas/importar-maps", () => {
  it("informa 1 chamada Enterprise e o custo antes de qualquer request externo", async () => {
    const res = await GET(
      new Request("http://localhost/api/demos-avulsas/importar-maps", { headers: { cookie } }),
    );
    expect(await res.json()).toMatchObject({ chamadas: 1, sku: "textSearchEnterprise" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("expande o link grátis, reserva antes do Places e devolve identidade revisável", async () => {
    db.seed("leads/ChIJCafe", { placeId: "ChIJCafe", nome: "Café Central" });
    const res = await importar();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      identidade: {
        placeId: "ChIJCafe",
        nome: "Café Central",
        endereco: "Av. Brasil, 10, Maringá - PR, Brasil",
        cidade: "Maringá",
        pais: "Brasil",
        telefone: "(44) 3000-1000",
        whatsapp: "+55 44 3000-1000",
        horarios: "segunda-feira: 09:00–18:00",
        instagram: "@cafecentral",
      },
      leadExistente: { id: "ChIJCafe" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers["X-Goog-FieldMask"]).not.toContain("photos");
    expect(db.getDoc(`usage/${new Date().toISOString().slice(0, 7)}`)).toMatchObject({
      textSearchEnterprise: 1,
    });
    expect(db.getDoc("usage_users/membro-1/dias/2026-08-29")).toMatchObject({
      enriquecimentos: 1,
    });
  });

  it("cota individual estourada impede o request pago, mas não o modo manual", async () => {
    db.seed("usage_users/membro-1/dias/2026-08-29", { enriquecimentos: 2 });
    const res = await importar();
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("user_quota_exceeded");
    expect(fetchMock).toHaveBeenCalledTimes(1); // apenas o redirect HTTP gratuito
  });

  it("link inválido falha sem chamada externa nem reserva", async () => {
    const res = await importar("https://example.com/negocio");
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.getDoc(`usage/${new Date().toISOString().slice(0, 7)}`)).toBeUndefined();
  });
});
