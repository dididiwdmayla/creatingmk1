import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { USAGE_COLLECTION, periodKey } from "@/lib/costs";
import { FRASES_COLLECTION } from "@/lib/frases/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { POST } from "../frases/traduzir/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const fetchMock = vi.fn();

const SKIN = "barbearia-editorial";

function respostaGemini(json: unknown): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }),
    { status: 200 },
  );
}

function seedLead(id: string, endereco: string, skinId?: string) {
  db.seed(`leads/${id}`, {
    placeId: id,
    nome: "Barbería del Che",
    endereco,
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-08-01T00:00:00.000Z",
    atualizadoEm: "2026-08-01T00:00:00.000Z",
    ...(skinId && { demo: { skinId, themeId: "meia-noite", atualizadoEm: "2026-08-01T00:00:00.000Z" } }),
  });
}

function seedFrases(frases: string[]) {
  db.seed(`${FRASES_COLLECTION}/${SKIN}`, { frases, indice: 0 });
}

const req = (body: unknown) =>
  new Request("http://localhost/api/frases/traduzir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  db = new FakeFirestore();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () =>
    respostaGemini({ frases: ["Hola {nome}, mirá: {demo}", "Che {nome}"] }),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GEMINI_API_KEY", "chave-teste");
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/frases/traduzir", () => {
  it("traduz para o idioma do PAÍS do lead e grava a tradução", async () => {
    seedLead("ChIJ001", "Av. Corrientes 1234, Buenos Aires, Argentina", SKIN);
    seedFrases(["Oi {nome}, veja: {demo}", "Olá {nome}", ""]);

    const res = await POST(req({ leadId: "ChIJ001" }));

    expect(res.status).toBe(200);
    const { conjunto, idioma } = await res.json();
    expect(idioma).toBe("es-AR");
    expect(conjunto.traducoes["es-AR"].frases).toEqual(["Hola {nome}, mirá: {demo}", "Che {nome}", ""]);
    expect(conjunto.traducoes["es-AR"].origem).toEqual(["Oi {nome}, veja: {demo}", "Olá {nome}", ""]);
    // Uma chamada só: as frases vão juntas no mesmo request.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("o prompt pede a variante regional argentina", async () => {
    seedLead("ChIJ001", "Buenos Aires, Argentina", SKIN);
    seedFrases(["Oi {nome}", "", ""]);
    fetchMock.mockImplementation(async () => respostaGemini({ frases: ["Hola {nome}"] }));

    await POST(req({ leadId: "ChIJ001" }));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).toContain("espanhol (Argentina)");
  });

  it("conta o SKU aiTraducao, não o de sugestões", async () => {
    seedLead("ChIJ001", "Buenos Aires, Argentina", SKIN);
    seedFrases(["Oi {nome}", "", ""]);
    fetchMock.mockImplementation(async () => respostaGemini({ frases: ["Hola {nome}"] }));

    await POST(req({ leadId: "ChIJ001" }));

    const contadores = db.getDoc(`${USAGE_COLLECTION}/${periodKey(new Date())}`);
    expect(contadores?.aiTraducao).toBe(1);
    expect(contadores?.aiGeneration ?? 0).toBe(0);
  });

  it("marcador perdido vira retry e, na segunda resposta boa, grava", async () => {
    seedLead("ChIJ001", "Buenos Aires, Argentina", SKIN);
    seedFrases(["Oi {nome}, veja: {demo}", "", ""]);
    fetchMock
      .mockImplementationOnce(async () => respostaGemini({ frases: ["Hola, mirá el sitio"] }))
      .mockImplementationOnce(async () => respostaGemini({ frases: ["Hola {nome}, mirá: {demo}"] }));

    const res = await POST(req({ leadId: "ChIJ001" }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("insistindo em perder o marcador → 502, e nada é gravado", async () => {
    seedLead("ChIJ001", "Buenos Aires, Argentina", SKIN);
    seedFrases(["Oi {nome}, veja: {demo}", "", ""]);
    fetchMock.mockImplementation(async () => respostaGemini({ frases: ["Hola, mirá el sitio"] }));

    const res = await POST(req({ leadId: "ChIJ001" }));

    expect(res.status).toBe(502);
    expect(db.getDoc(`${FRASES_COLLECTION}/${SKIN}`)?.traducoes).toBeUndefined();
  });

  it("lead do Brasil → 400 (as frases já estão em português)", async () => {
    seedLead("ChIJ002", "Av. Brasil, 123 - Sarandi, PR, Brasil", SKIN);
    seedFrases(["Oi {nome}", "", ""]);

    const res = await POST(req({ leadId: "ChIJ002" }));

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lead sem demo → 400 (não há skin cuja frase traduzir)", async () => {
    seedLead("ChIJ003", "Buenos Aires, Argentina");

    const res = await POST(req({ leadId: "ChIJ003" }));

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skin sem frase preenchida → 400, sem gastar chamada", async () => {
    seedLead("ChIJ001", "Buenos Aires, Argentina", SKIN);
    seedFrases(["", "", ""]);

    const res = await POST(req({ leadId: "ChIJ001" }));

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sem GEMINI_API_KEY → 503, sem tocar no banco", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    seedLead("ChIJ001", "Buenos Aires, Argentina", SKIN);
    seedFrases(["Oi {nome}", "", ""]);

    const res = await POST(req({ leadId: "ChIJ001" }));

    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("ai_unavailable");
  });

  it("lead inexistente → 404", async () => {
    expect((await POST(req({ leadId: "nao-existe" }))).status).toBe(404);
  });

  it("corpo sem leadId → 400", async () => {
    expect((await POST(req({}))).status).toBe(400);
  });
});
