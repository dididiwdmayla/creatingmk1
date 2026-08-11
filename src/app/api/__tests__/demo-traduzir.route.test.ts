import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { POST } from "../leads/[id]/demo/traduzir/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const fetchMock = vi.fn();

/** DemoData efetivo típico enviado pelo editor (só os campos relevantes à tradução). */
const DADOS_EDITOR = {
  slogan: "Tradição de navalha.",
  secoes: {
    hero: { titulo: "Barbearia do Zé", texto: "O melhor corte da cidade." },
    filosofia: { titulo: "Nossa filosofia" },
  },
  servicos: [{ nome: "Corte masculino", preco: "R$ 60", precoPrefixo: "A partir de", precoValor: 60 }],
  depoimentos: [{ autor: "João Silva", texto: "Ótimo atendimento!", nota: 5 }],
};

const TRADUCAO_VALIDA = {
  slogan: "Razor tradition.",
  secoes: {
    hero: { texto: "The best haircut in town." },
    filosofia: { titulo: "Our philosophy" },
  },
  servicos: [{ nome: "Men's haircut", precoPrefixo: "Starting at" }],
  depoimentos: [{ texto: "Great service!" }],
};

function respostaGemini(json: unknown): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }),
    { status: 200 },
  );
}

beforeEach(() => {
  db = new FakeFirestore();
  db.seed("leads/ChIJ001", {
    placeId: "ChIJ001",
    nome: "Barbearia do Zé",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
  });
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => respostaGemini(TRADUCAO_VALIDA));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GEMINI_API_KEY", "chave-teste");
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function traduzir(
  id: string,
  body: Record<string, unknown> = { skinId: "barbearia-editorial", idioma: "en-US", dados: DADOS_EDITOR },
  cookie?: string,
): Promise<Response> {
  return POST(
    new Request(`http://localhost/api/leads/${id}/demo/traduzir`, {
      method: "POST",
      body: JSON.stringify(body),
      ...(cookie && { headers: { cookie } }),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function usageDoc(): Record<string, unknown> | undefined {
  return db.getDoc(`usage/${new Date().toISOString().slice(0, 7)}`);
}

describe("POST /api/leads/[id]/demo/traduzir", () => {
  it("traduz o conteúdo atual e consome 1 de aiGeneration", async () => {
    const res = await traduzir("ChIJ001");

    expect(res.status).toBe(200);
    const { traducao, idioma } = await res.json();
    expect(idioma).toBe("en-US");
    expect(traducao).toEqual({
      slogan: "Razor tradition.",
      secoes: {
        hero: { texto: "The best haircut in town." },
        filosofia: { titulo: "Our philosophy" },
      },
      servicos: [{ nome: "Men's haircut", precoPrefixo: "Starting at" }],
      depoimentos: [{ texto: "Great service!" }],
    });
    expect(usageDoc()).toMatchObject({ aiGeneration: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/models/gemini-3.5-flash:generateContent");
    const corpo = JSON.parse(init.body as string);
    // O nome do negócio (identidade) e o preço numérico nunca vazam pro prompt.
    expect(corpo.contents[0].parts[0].text).not.toContain("Barbearia do Zé");
    expect(corpo.contents[0].parts[0].text).not.toContain("60");
    expect(corpo.contents[0].parts[0].text).toContain("Tradição de navalha.");
  });

  it("sem GEMINI_API_KEY → 503 ai_unavailable sem tocar cota nem rede", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const res = await traduzir("ChIJ001");

    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("ai_unavailable");
    expect(usageDoc()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resposta fora do schema → 502 ai_error, SEM retry (1 chamada só)", async () => {
    fetchMock.mockImplementation(async () => respostaGemini({ slogan: "" }));

    const res = await traduzir("ChIJ001");

    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("ai_error");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(usageDoc()).toMatchObject({ aiGeneration: 1 });
  });

  it("teto aiGeneration estourado → 429 sem chamar o Gemini", async () => {
    db.seed("config/app", { caps: { aiGeneration: 0 } });

    const res = await traduzir("ChIJ001");

    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatchObject({ code: "quota_exceeded", sku: "aiGeneration" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skinId ausente/desconhecida → 400 sem cota nem rede", async () => {
    const res = await traduzir("ChIJ001", { ...DADOS_EDITOR, skinId: "skin-fantasma", idioma: "en-US", dados: DADOS_EDITOR });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_error");
    expect(usageDoc()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("idioma fora de IDIOMAS_SUPORTADOS → 400", async () => {
    const res = await traduzir("ChIJ001", {
      skinId: "barbearia-editorial",
      idioma: "klingon",
      dados: DADOS_EDITOR,
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_error");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("idioma pt-BR → 400, nada para traduzir", async () => {
    const res = await traduzir("ChIJ001", {
      skinId: "barbearia-editorial",
      idioma: "pt-BR",
      dados: DADOS_EDITOR,
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_error");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("editor sem nenhum campo de conteúdo preenchido → 400 sem cota nem rede", async () => {
    const res = await traduzir("ChIJ001", {
      skinId: "barbearia-editorial",
      idioma: "en-US",
      dados: { secoes: { hero: { titulo: "Barbearia do Zé" } }, servicos: [], depoimentos: [] },
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_error");
    expect(usageDoc()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lead inexistente → 404 sem cota nem rede", async () => {
    const res = await traduzir("ChIJ999");

    expect(res.status).toBe(404);
    expect(usageDoc()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("com sessão, a reserva registra a quebra porUsuario", async () => {
    const cookie = await cookieDeSessao(db, { id: "ana", papel: "membro" });

    const res = await traduzir(
      "ChIJ001",
      { skinId: "barbearia-editorial", idioma: "en-US", dados: DADOS_EDITOR },
      cookie,
    );

    expect(res.status).toBe(200);
    const usage = usageDoc();
    expect(
      (usage?.porUsuario as Record<string, { aiGeneration: number }>).ana.aiGeneration,
    ).toBe(1);
  });
});
