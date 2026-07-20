import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { POST } from "../leads/[id]/demo/sugestao/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const fetchMock = vi.fn();

const SUGESTAO_VALIDA = {
  themeId: "meia-noite",
  destaque: "#8c4a2b",
  fonteDisplay: "playfair",
  animacao: "sutil",
  slogan: "Tradição de navalha.",
  descricao: "Cortes clássicos no coração de Sarandi.",
  titulosSecoes: { filosofia: "Nossa filosofia" },
};

/** Resposta do generateContent com o JSON dado no primeiro candidato. */
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
  db.seed("leads/ChIJ001", {
    placeId: "ChIJ001",
    nome: "Barbearia do Zé",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
  });
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => respostaGemini(SUGESTAO_VALIDA));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GEMINI_API_KEY", "chave-teste");
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function sugerir(
  id: string,
  body: Record<string, unknown> = { skinId: "barbearia-editorial" },
  cookie?: string,
): Promise<Response> {
  return POST(
    new Request(`http://localhost/api/leads/${id}/demo/sugestao`, {
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

describe("POST /api/leads/[id]/demo/sugestao", () => {
  it("gera sugestão validada e consome 1 de aiGeneration", async () => {
    const res = await sugerir("ChIJ001");

    expect(res.status).toBe(200);
    const { sugestao } = await res.json();
    expect(sugestao).toEqual(SUGESTAO_VALIDA);
    expect(usageDoc()).toMatchObject({ aiGeneration: 1 });

    // Chamada certa: modelo flash atual, chave só no header, pedindo JSON.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/models/gemini-3.5-flash:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("chave-teste");
    const corpo = JSON.parse(init.body as string);
    expect(corpo.generationConfig.responseMimeType).toBe("application/json");
    expect(corpo.contents[0].parts[0].text).toContain("Barbearia do Zé");
  });

  it("sem GEMINI_API_KEY → 503 ai_unavailable sem tocar cota nem rede", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const res = await sugerir("ChIJ001");

    expect(res.status).toBe(503);
    const { error } = await res.json();
    expect(error.code).toBe("ai_unavailable");
    expect(usageDoc()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resposta inválida ganha UM retry (com os problemas no prompt) e cada tentativa reserva cota", async () => {
    fetchMock
      .mockImplementationOnce(async () =>
        respostaGemini({ ...SUGESTAO_VALIDA, themeId: "inexistente" }),
      )
      .mockImplementationOnce(async () => respostaGemini(SUGESTAO_VALIDA));

    const res = await sugerir("ChIJ001");

    expect(res.status).toBe(200);
    expect((await res.json()).sugestao).toEqual(SUGESTAO_VALIDA);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(usageDoc()).toMatchObject({ aiGeneration: 2 });

    const [, initRetry] = fetchMock.mock.calls[1] as [string, RequestInit];
    const promptRetry = JSON.parse(initRetry.body as string).contents[0].parts[0].text;
    expect(promptRetry).toContain("rejeitada");
    expect(promptRetry).toContain("themeId deve ser um preset da skin");
  });

  it("inválida também no retry → 502 ai_error (cota das 2 tentativas consumida)", async () => {
    fetchMock.mockImplementation(async () => respostaGemini({ qualquer: "coisa" }));

    const res = await sugerir("ChIJ001");

    expect(res.status).toBe(502);
    const { error } = await res.json();
    expect(error.code).toBe("ai_error");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(usageDoc()).toMatchObject({ aiGeneration: 2 });
  });

  it("erro HTTP do Gemini → 502 com a cota já consumida (reserva antes do request)", async () => {
    fetchMock.mockImplementation(async () => new Response("boom", { status: 500 }));

    const res = await sugerir("ChIJ001");

    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("ai_error");
    expect(usageDoc()).toMatchObject({ aiGeneration: 1 });
  });

  it("teto aiGeneration estourado → 429 sem chamar o Gemini", async () => {
    db.seed("config/app", { caps: { aiGeneration: 0 } });

    const res = await sugerir("ChIJ001");

    expect(res.status).toBe(429);
    const { error } = await res.json();
    expect(error).toMatchObject({ code: "quota_exceeded", sku: "aiGeneration" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skinId ausente/desconhecida → 400 sem cota nem rede", async () => {
    const res = await sugerir("ChIJ001", { skinId: "skin-fantasma" });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_error");
    expect(usageDoc()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lead inexistente → 404 sem cota nem rede", async () => {
    const res = await sugerir("ChIJ999");

    expect(res.status).toBe(404);
    expect(usageDoc()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("com sessão, a reserva registra a quebra porUsuario", async () => {
    const cookie = await cookieDeSessao(db, { id: "ana", papel: "membro" });

    const res = await sugerir("ChIJ001", { skinId: "barbearia-editorial" }, cookie);

    expect(res.status).toBe(200);
    const usage = usageDoc();
    expect(
      (usage?.porUsuario as Record<string, { aiGeneration: number }>).ana.aiGeneration,
    ).toBe(1);
  });
});
