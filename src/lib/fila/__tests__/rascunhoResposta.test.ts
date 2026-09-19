import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG } from "@/lib/config";
import { AiIndisponivelError } from "@/lib/ai/gemini";
import { QuotaExceededError } from "@/lib/costs";
import { saveContextoComercial } from "@/lib/contextoComercial";
import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { gerarRascunhoResposta } from "../rascunhoResposta";

function baseLead(extra: Partial<Lead> = {}): Lead {
  return {
    placeId: "ChIJlead1",
    nome: "Barbearia do Zé",
    status: "respondeu",
    enriquecido: false,
    telefoneIntl: "+55 16 98213-3909",
    criadoEm: "2026-02-01T00:00:00.000Z",
    atualizadoEm: "2026-02-01T00:00:00.000Z",
    ...extra,
  };
}

function respostaGemini(json: unknown): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }),
    { status: 200 },
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => respostaGemini({ rascunho: "Oi! Claro, posso te mostrar agora." }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GEMINI_API_KEY", "chave-teste");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("gerarRascunhoResposta", () => {
  it("reserva cota, chama o Gemini uma vez e devolve o rascunho validado", async () => {
    const db = new FakeFirestore();
    const lead = baseLead();

    const rascunho = await gerarRascunhoResposta(
      db,
      lead,
      [{ texto: "Oi, tenho interesse!", recebidoEm: "2026-03-01T10:00:00.000Z" }],
      DEFAULT_CONFIG,
    );

    expect(rascunho).toBe("Oi! Claro, posso te mostrar agora.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("o prompt inclui a mensagem que o Radar mandou e as mensagens do grupo, na ordem", async () => {
    const db = new FakeFirestore();
    const lead = baseLead();

    await gerarRascunhoResposta(
      db,
      lead,
      [
        { texto: "Oi, tenho interesse!", recebidoEm: "2026-03-01T10:00:00.000Z" },
        { texto: "Quanto custa?", recebidoEm: "2026-03-01T10:00:10.000Z" },
      ],
      DEFAULT_CONFIG,
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const prompt: string = body.contents[0].parts[0].text;
    expect(prompt).toContain("Oi, tenho interesse!");
    expect(prompt).toContain("Quanto custa?");
    expect(prompt).toContain(DEFAULT_CONFIG.mensagemPadrao.replace("{nome}", lead.nome));
  });

  it("sem GEMINI_API_KEY, propaga AiIndisponivelError (503 na rota) sem reservar cota", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const db = new FakeFirestore();

    await expect(
      gerarRascunhoResposta(db, baseLead(), [{ texto: "oi", recebidoEm: "2026-03-01T10:00:00.000Z" }], DEFAULT_CONFIG),
    ).rejects.toThrow(AiIndisponivelError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cota aiGeneration estourada lança QuotaExceededError antes do fetch", async () => {
    const db = new FakeFirestore();
    const caps = { ...DEFAULT_CONFIG.caps, aiGeneration: 0 };

    await expect(
      gerarRascunhoResposta(
        db,
        baseLead(),
        [{ texto: "oi", recebidoEm: "2026-03-01T10:00:00.000Z" }],
        { ...DEFAULT_CONFIG, caps },
      ),
    ).rejects.toThrow(QuotaExceededError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resposta fora do schema (sem \"rascunho\") lança erro — sem retry, uma chamada só", async () => {
    fetchMock.mockImplementation(async () => respostaGemini({ algoErrado: true }));
    const db = new FakeFirestore();

    await expect(
      gerarRascunhoResposta(db, baseLead(), [{ texto: "oi", recebidoEm: "2026-03-01T10:00:00.000Z" }], DEFAULT_CONFIG),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("gerarRascunhoResposta — contexto comercial e as regras duras", () => {
  async function prompt(db: FakeFirestore): Promise<string> {
    await gerarRascunhoResposta(
      db,
      baseLead(),
      [{ texto: "Quanto custa?", recebidoEm: "2026-03-01T10:00:00.000Z" }],
      DEFAULT_CONFIG,
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    return body.contents[0].parts[0].text;
  }

  it("sem o documento preenchido, o prompt não traz seção de contexto comercial, mas traz a regra dura", async () => {
    const db = new FakeFirestore();

    const texto = await prompt(db);

    expect(texto).not.toContain("Contexto comercial declarado");
    expect(texto).toContain("NUNCA invente um número absoluto");
    expect(texto).toContain("[PREENCHER:");
  });

  it("com o documento preenchido, o texto entra no prompt tal como escrito", async () => {
    const db = new FakeFirestore();
    await saveContextoComercial(db, {
      texto: "Fazemos site institucional a partir de R$1.500, prazo de 10 dias úteis.",
    });

    const texto = await prompt(db);

    expect(texto).toContain("Contexto comercial declarado");
    expect(texto).toContain("Fazemos site institucional a partir de R$1.500, prazo de 10 dias úteis.");
  });

  it("a regra dura de não inventar prazo/escopo/condição está sempre no prompt", async () => {
    const db = new FakeFirestore();
    await saveContextoComercial(db, { texto: "Vendemos site institucional." });

    const texto = await prompt(db);

    expect(texto).toContain("NUNCA prometa prazo, escopo");
  });

  it("documento só com espaço em branco é tratado como vazio (nenhuma seção, mas a regra continua lá)", async () => {
    const db = new FakeFirestore();
    await saveContextoComercial(db, { texto: "   " });

    const texto = await prompt(db);

    expect(texto).not.toContain("Contexto comercial declarado");
    expect(texto).toContain("REGRAS DURAS");
  });
});
