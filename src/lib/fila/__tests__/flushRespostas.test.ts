import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG } from "@/lib/config";
import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { DEFAULT_FILA_CONFIG } from "../config";
import { flushGruposMaduros, FILA_RESPOSTAS_COLLECTION, type FilaRespostaDoc } from "../flushRespostas";
import { adicionarMensagemAoGrupo, listarGruposPendentes } from "../respostasPendentes";

const T0 = new Date("2026-03-01T10:00:00.000Z");
const JANELA = DEFAULT_FILA_CONFIG.respostaAgrupamentoSegundos; // 45s

function depois(segundos: number): Date {
  return new Date(T0.getTime() + segundos * 1000);
}

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

async function todasAsRespostas(db: FakeFirestore): Promise<FilaRespostaDoc[]> {
  const snap = await db.collection(FILA_RESPOSTAS_COLLECTION).get();
  return snap.docs.map((doc) => doc.data() as unknown as FilaRespostaDoc);
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => respostaGemini({ rascunho: "Rascunho gerado." }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GEMINI_API_KEY", "chave-teste");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("flushGruposMaduros", () => {
  it("três mensagens dentro da janela geram UM rascunho só", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);
    await adicionarMensagemAoGrupo(db, "ChIJlead1", { texto: "Oi", recebidoEm: T0.toISOString() }, T0);
    await adicionarMensagemAoGrupo(
      db,
      "ChIJlead1",
      { texto: "tudo bem?", recebidoEm: depois(5).toISOString() },
      depois(5),
    );
    await adicionarMensagemAoGrupo(
      db,
      "ChIJlead1",
      { texto: "quero saber mais", recebidoEm: depois(10).toISOString() },
      depois(10),
    );

    await flushGruposMaduros(db, depois(10 + JANELA), DEFAULT_FILA_CONFIG, DEFAULT_CONFIG);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const respostas = await todasAsRespostas(db);
    expect(respostas).toHaveLength(1);
    expect(respostas[0].mensagens.map((m) => m.texto)).toEqual(["Oi", "tudo bem?", "quero saber mais"]);
    expect(respostas[0].rascunho).toBe("Rascunho gerado.");
    expect(respostas[0].estado).toBe("pendente");
    expect(respostas[0].leadId).toBe("ChIJlead1");

    const pendentes = await listarGruposPendentes(db);
    expect(pendentes[0].mensagens).toEqual([]);
  });

  it("grupo ainda dentro da janela não é liberado", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);
    await adicionarMensagemAoGrupo(db, "ChIJlead1", { texto: "Oi", recebidoEm: T0.toISOString() }, T0);

    await flushGruposMaduros(db, depois(10), DEFAULT_FILA_CONFIG, DEFAULT_CONFIG);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await todasAsRespostas(db)).toHaveLength(0);
    const [pendente] = await listarGruposPendentes(db);
    expect(pendente.mensagens).toHaveLength(1);
  });

  it("ISOLAMENTO: falha na geração do rascunho não lança — marca o grupo com erro, retentável", async () => {
    fetchMock.mockImplementation(async () => new Response("erro", { status: 500 }));
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);
    await adicionarMensagemAoGrupo(db, "ChIJlead1", { texto: "Oi", recebidoEm: T0.toISOString() }, T0);

    await expect(
      flushGruposMaduros(db, depois(JANELA), DEFAULT_FILA_CONFIG, DEFAULT_CONFIG),
    ).resolves.toBeUndefined();

    expect(await todasAsRespostas(db)).toHaveLength(0);
    const [pendente] = await listarGruposPendentes(db);
    expect(pendente.mensagens.map((m) => m.texto)).toEqual(["Oi"]);
    expect(pendente.tentativas).toBe(1);
    expect(pendente.ultimoErro).toBeTruthy();
  });

  it("grupo com erro é retentado e some quando a IA volta a funcionar", async () => {
    fetchMock.mockImplementationOnce(async () => new Response("erro", { status: 500 }));
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);
    await adicionarMensagemAoGrupo(db, "ChIJlead1", { texto: "Oi", recebidoEm: T0.toISOString() }, T0);

    await flushGruposMaduros(db, depois(JANELA), DEFAULT_FILA_CONFIG, DEFAULT_CONFIG);
    await flushGruposMaduros(db, depois(JANELA + 1), DEFAULT_FILA_CONFIG, DEFAULT_CONFIG);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await todasAsRespostas(db)).toHaveLength(1);
  });

  it("dois leads maduros ao mesmo tempo geram dois rascunhos independentes", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead({ placeId: "ChIJlead1" }) as unknown as Record<string, unknown>);
    db.seed(
      "leads/ChIJlead2",
      baseLead({ placeId: "ChIJlead2", nome: "Pet Shop Amigo", telefoneIntl: "+55 16 99999-1111" }) as unknown as Record<
        string,
        unknown
      >,
    );
    await adicionarMensagemAoGrupo(db, "ChIJlead1", { texto: "Oi 1", recebidoEm: T0.toISOString() }, T0);
    await adicionarMensagemAoGrupo(db, "ChIJlead2", { texto: "Oi 2", recebidoEm: T0.toISOString() }, T0);

    await flushGruposMaduros(db, depois(JANELA), DEFAULT_FILA_CONFIG, DEFAULT_CONFIG);

    const respostas = await todasAsRespostas(db);
    expect(respostas).toHaveLength(2);
    expect(new Set(respostas.map((r) => r.leadId))).toEqual(new Set(["ChIJlead1", "ChIJlead2"]));
  });
});
