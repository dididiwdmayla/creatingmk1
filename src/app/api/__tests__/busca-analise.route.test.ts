import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { POST } from "../buscas/[id]/analise/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const fetchMock = vi.fn();

const ANALISE_TEXTO =
  "Priorize a Barbearia do Zé e o Salão da Ana primeiro, ambos sem site próprio e com telefone.";

function respostaGemini(json: unknown): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }],
    }),
    { status: 200 },
  );
}

beforeEach(() => {
  db = new FakeFirestore();
  db.seed("buscas/b1", {
    id: "b1",
    nome: "dentista 01/07",
    nicho: "dentista",
    regiao: "Sarandi PR",
    cor: "#2f82e0",
    criadaEm: "2026-07-01T10:00:00.000Z",
    totalCriados: 2,
    totalExistentes: 0,
  });
  db.seed("leads/L1", {
    placeId: "L1",
    nome: "Barbearia do Zé",
    status: "novo",
    enriquecido: false,
    temSite: false,
    temTelefone: true,
    buscaId: ["b1"],
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
  });
  db.seed("leads/L2", {
    placeId: "L2",
    nome: "Salão da Ana",
    status: "novo",
    enriquecido: false,
    temSite: true,
    siteUrl: "https://salaodaana.com",
    temTelefone: false,
    buscaId: ["b1"],
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
  });
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => respostaGemini({ analise: ANALISE_TEXTO }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GEMINI_API_KEY", "chave-teste");
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function analisar(id: string, cookie?: string): Promise<Response> {
  return POST(
    new Request(`http://localhost/api/buscas/${id}/analise`, {
      method: "POST",
      ...(cookie && { headers: { cookie } }),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function usageDoc(): Record<string, unknown> | undefined {
  return db.getDoc(`usage/${new Date().toISOString().slice(0, 7)}`);
}

describe("POST /api/buscas/[id]/analise", () => {
  it("gera a análise numa ÚNICA chamada, consome 1 de aiGeneration e cacheia no doc da busca", async () => {
    const res = await analisar("b1");

    expect(res.status).toBe(200);
    const { busca } = await res.json();
    expect(busca.analiseIA).toMatchObject({ texto: ANALISE_TEXTO });
    expect(typeof busca.analiseIA.geradaEm).toBe("string");
    expect(usageDoc()).toMatchObject({ aiGeneration: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/models/gemini-3.5-flash:generateContent");
    const corpo = JSON.parse(init.body as string);
    expect(corpo.contents[0].parts[0].text).toContain("Barbearia do Zé");
    expect(corpo.contents[0].parts[0].text).toContain("Salão da Ana");

    expect(db.getDoc("buscas/b1")).toMatchObject({
      analiseIA: { texto: ANALISE_TEXTO },
    });
  });

  it("regenerar sobrescreve a análise cacheada", async () => {
    await analisar("b1");
    fetchMock.mockImplementation(async () =>
      respostaGemini({ analise: "Nova recomendação, priorize outros leads." }),
    );

    const res = await analisar("b1");

    expect(res.status).toBe(200);
    const { busca } = await res.json();
    expect(busca.analiseIA.texto).toBe("Nova recomendação, priorize outros leads.");
    expect(usageDoc()).toMatchObject({ aiGeneration: 2 });
  });

  it("sem GEMINI_API_KEY → 503 ai_unavailable sem tocar cota nem rede", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const res = await analisar("b1");

    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("ai_unavailable");
    expect(usageDoc()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resposta fora do schema → 502 ai_error SEM retry (uma única chamada)", async () => {
    fetchMock.mockImplementation(async () => respostaGemini({ qualquer: "coisa" }));

    const res = await analisar("b1");

    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("ai_error");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(usageDoc()).toMatchObject({ aiGeneration: 1 });
  });

  it("erro HTTP do Gemini → 502 com a cota já consumida", async () => {
    fetchMock.mockImplementation(async () => new Response("boom", { status: 500 }));

    const res = await analisar("b1");

    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("ai_error");
    expect(usageDoc()).toMatchObject({ aiGeneration: 1 });
  });

  it("teto aiGeneration estourado → 429 sem chamar o Gemini", async () => {
    db.seed("config/app", { caps: { aiGeneration: 0 } });

    const res = await analisar("b1");

    expect(res.status).toBe(429);
    const { error } = await res.json();
    expect(error).toMatchObject({ code: "quota_exceeded", sku: "aiGeneration" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("busca inexistente → 404 sem cota nem rede", async () => {
    const res = await analisar("b-fantasma");

    expect(res.status).toBe(404);
    expect(usageDoc()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("grupo sem leads → 400 sem cota nem rede", async () => {
    db.seed("buscas/vazia", {
      id: "vazia",
      nome: "grupo vazio",
      nicho: "dentista",
      regiao: "Sarandi PR",
      cor: "#2f82e0",
      criadaEm: "2026-07-01T10:00:00.000Z",
      totalCriados: 0,
      totalExistentes: 0,
    });

    const res = await analisar("vazia");

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_error");
    expect(usageDoc()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("com sessão, a reserva registra a quebra porUsuario", async () => {
    const cookie = await cookieDeSessao(db, { id: "ana", papel: "membro" });

    const res = await analisar("b1", cookie);

    expect(res.status).toBe(200);
    const usage = usageDoc();
    expect(
      (usage?.porUsuario as Record<string, { aiGeneration: number }>).ana.aiGeneration,
    ).toBe(1);
  });
});
