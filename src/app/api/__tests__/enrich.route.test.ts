import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { POST } from "../leads/[id]/enrich/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const fetchMock = vi.fn();

const GOOGLE_DETAILS = {
  id: "ChIJ001",
  nationalPhoneNumber: "(44) 3264-0000",
  internationalPhoneNumber: "+55 44 3264-0000",
  websiteUri: "https://clinicasorriso.com.br",
  rating: 4.7,
  userRatingCount: 132,
};

beforeEach(() => {
  db = new FakeFirestore();
  db.seed("leads/ChIJ001", {
    placeId: "ChIJ001",
    nome: "Clínica Sorriso",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
  });
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    async () => new Response(JSON.stringify(GOOGLE_DETAILS), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "chave-teste");
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function enrich(id: string, cookie?: string): Promise<Response> {
  return POST(
    new Request(`http://localhost/api/leads/${id}/enrich`, {
      method: "POST",
      ...(cookie && { headers: { cookie } }),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function usageDoc(): Record<string, unknown> | undefined {
  return db.getDoc(`usage/${new Date().toISOString().slice(0, 7)}`);
}

describe("POST /api/leads/[id]/enrich", () => {
  it("enriquece sob demanda com o mask Pro e persiste os detalhes", async () => {
    const res = await enrich("ChIJ001");

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.enriquecido).toBe(true);
    expect(lead.detalhes).toMatchObject({
      telefone: "(44) 3264-0000",
      telefoneIntl: "+55 44 3264-0000",
      site: "https://clinicasorriso.com.br",
      rating: 4.7,
      totalAvaliacoes: 132,
    });
    expect(lead.status).toBe("novo");

    // Enriquecimento persiste a classificação de site (definitiva).
    expect(db.getDoc("leads/ChIJ001")).toMatchObject({
      enriquecido: true,
      temSite: true,
      siteProprio: true,
      siteUrl: "https://clinicasorriso.com.br",
    });
    expect(usageDoc()).toMatchObject({ detailsEnterprise: 1 });
  });

  it("enriquecimento com site de rede social persiste siteProprio=false", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(
        JSON.stringify({ id: "ChIJ001", websiteUri: "https://wa.me/5544999990000" }),
        { status: 200 },
      ),
    );

    const res = await enrich("ChIJ001");

    expect(res.status).toBe(200);
    expect(db.getDoc("leads/ChIJ001")).toMatchObject({
      enriquecido: true,
      temSite: true,
      siteProprio: false,
      siteUrl: "https://wa.me/5544999990000",
    });
  });

  it("enriquecimento sem site persiste temSite/siteProprio=false (definitivo)", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ id: "ChIJ001", rating: 4.0 }), { status: 200 }),
    );

    const res = await enrich("ChIJ001");

    expect(res.status).toBe(200);
    expect(db.getDoc("leads/ChIJ001")).toMatchObject({
      enriquecido: true,
      temSite: false,
      siteProprio: false,
    });
  });

  it("lead já enriquecido → retorna do cache SEM chamar o Google", async () => {
    await enrich("ChIJ001");

    const res = await enrich("ChIJ001");

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.detalhes.site).toBe("https://clinicasorriso.com.br");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(usageDoc()).toMatchObject({ detailsEnterprise: 1 });
  });

  it("lead inexistente → 404 sem consumir cota", async () => {
    const res = await enrich("ChIJ999");

    expect(res.status).toBe(404);
    expect(usageDoc()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("teto detailsEnterprise estourado → 429 e o lead fica intacto", async () => {
    db.seed("config/app", { caps: { detailsEnterprise: 0 } });

    const res = await enrich("ChIJ001");

    expect(res.status).toBe(429);
    const { error } = await res.json();
    expect(error).toMatchObject({ code: "quota_exceeded", sku: "detailsEnterprise" });
    expect(db.getDoc("leads/ChIJ001")).toMatchObject({ enriquecido: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("com sessão, registra enriquecidoPor e a quebra porUsuario da cota", async () => {
    const cookie = await cookieDeSessao(db, { id: "ana", papel: "membro" });

    const res = await enrich("ChIJ001", cookie);

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.detalhes.enriquecidoPor).toBe("ana");
    const usage = usageDoc();
    expect(
      (usage?.porUsuario as Record<string, { detailsEnterprise: number }>).ana
        .detailsEnterprise,
    ).toBe(1);
  });

  it("erro do Google → 502, cota consumida, lead NÃO marcado como enriquecido", async () => {
    fetchMock.mockImplementation(async () => new Response("boom", { status: 500 }));

    const res = await enrich("ChIJ001");

    expect(res.status).toBe(502);
    const { error } = await res.json();
    expect(error.code).toBe("places_error");
    expect(error.detail).toBe("boom");
    expect(db.getDoc("leads/ChIJ001")).toMatchObject({ enriquecido: false });
    expect(usageDoc()).toMatchObject({ detailsEnterprise: 1 });
  });
});
