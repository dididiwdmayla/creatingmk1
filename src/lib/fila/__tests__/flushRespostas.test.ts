import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG } from "@/lib/config";
import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { DEFAULT_FILA_CONFIG } from "../config";
import { flushGruposMaduros, FILA_RESPOSTAS_COLLECTION, type FilaRespostaDoc } from "../flushRespostas";
import { EXCECAO_GRUPO_ID } from "../mensagemRecebida";
import { listarTarefasResposta, type RespostaTarefaDoc } from "../respostaAutomatica";
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

describe("flushGruposMaduros — quando o rascunho vira TAREFA automática", () => {
  const LIGADA = {
    ...DEFAULT_FILA_CONFIG,
    respostaAutomatica: true,
    respostaDelayMinSegundos: 300,
    respostaDelayMaxSegundos: 300,
  };

  async function responder(
    db: FakeFirestore,
    config = LIGADA,
    texto = "Oi",
    quando = T0,
  ): Promise<void> {
    await adicionarMensagemAoGrupo(db, "ChIJlead1", { texto, recebidoEm: quando.toISOString() }, quando);
    await flushGruposMaduros(
      db,
      new Date(quando.getTime() + (JANELA + 1) * 1000),
      config,
      DEFAULT_CONFIG,
    );
  }

  async function tarefas(db: FakeFirestore): Promise<RespostaTarefaDoc[]> {
    return listarTarefasResposta(db);
  }

  it("desligada (o padrão), o rascunho é gravado e NENHUMA tarefa nasce", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);

    await responder(db, DEFAULT_FILA_CONFIG);

    expect(await todasAsRespostas(db)).toHaveLength(1);
    expect(await tarefas(db)).toHaveLength(0);
  });

  it("ligada, o rascunho vira tarefa com número, texto e o ATRASO já aplicado", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);

    await responder(db);

    const [tarefa] = await tarefas(db);
    const [rascunho] = await todasAsRespostas(db);
    expect(tarefa).toMatchObject({
      id: rascunho.id,
      leadId: "ChIJlead1",
      // Dígitos puros com DDI, mesma normalização do envio.
      numero: "5516982133909",
      texto: "Rascunho gerado.",
      estado: "aguardando",
    });
    expect(new Date(tarefa.disponivelEm).getTime() - new Date(rascunho.geradoEm).getTime()).toBe(
      300 * 1000,
    );
  });

  it("apenasPrimeira LIGADO: a segunda resposta do mesmo lead vai para o painel", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);

    await responder(db, LIGADA, "Oi", T0);
    await responder(db, LIGADA, "e o preço?", depois(600));

    expect(await todasAsRespostas(db)).toHaveLength(2);
    // Uma tarefa só: a da primeira resposta. A segunda é negociação, e
    // negociar sozinho é outro risco.
    expect(await tarefas(db)).toHaveLength(1);
  });

  it("apenasPrimeira DESLIGADO: a segunda também vira tarefa", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);
    const config = { ...LIGADA, respostaAutomaticaApenasPrimeira: false };

    await responder(db, config, "Oi", T0);
    await responder(db, config, "e o preço?", depois(600));

    expect(await tarefas(db)).toHaveLength(2);
  });

  it("lead SEM telefone gera rascunho, nunca tarefa — não há conversa para abrir", async () => {
    const db = new FakeFirestore();
    db.seed(
      "leads/ChIJlead1",
      baseLead({ telefoneIntl: undefined }) as unknown as Record<string, unknown>,
    );

    await responder(db);

    expect(await todasAsRespostas(db)).toHaveLength(1);
    expect(await tarefas(db)).toHaveLength(0);
  });

  it("o telefone ENRIQUECIDO tem precedência, como no envio", async () => {
    const db = new FakeFirestore();
    db.seed(
      "leads/ChIJlead1",
      baseLead({ detalhes: { telefoneIntl: "+55 44 99154-3803" } } as Partial<Lead>) as unknown as Record<
        string,
        unknown
      >,
    );

    await responder(db);

    expect((await tarefas(db))[0].numero).toBe("5544991543803");
  });

  it("o atraso é SORTEADO dentro da faixa, não fixo", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);

    await responder(db, {
      ...LIGADA,
      respostaAutomaticaApenasPrimeira: false,
      respostaDelayMinSegundos: 180,
      respostaDelayMaxSegundos: 720,
    }, "Oi", T0);

    const [tarefa] = await tarefas(db);
    const atraso =
      (new Date(tarefa.disponivelEm).getTime() - new Date(tarefa.criadoEm).getTime()) / 1000;
    expect(atraso).toBeGreaterThanOrEqual(180);
    expect(atraso).toBeLessThanOrEqual(720);
  });
});

describe("flushGruposMaduros — o grupo de EXCEÇÃO (número de teste da resposta)", () => {
  const COM_CONTEXTO = {
    ...DEFAULT_FILA_CONFIG,
    numeroExcecao: "5544999998888",
    leadContextoExcecao: "ChIJcontexto",
  };

  async function tarefas(db: FakeFirestore): Promise<RespostaTarefaDoc[]> {
    return listarTarefasResposta(db);
  }

  it("gera rascunho usando o LEAD DE CONTEXTO, marcado como teste", async () => {
    const db = new FakeFirestore();
    db.seed(
      "leads/ChIJcontexto",
      baseLead({ placeId: "ChIJcontexto", nome: "Lead de Contexto" }) as unknown as Record<
        string,
        unknown
      >,
    );
    await adicionarMensagemAoGrupo(
      db,
      EXCECAO_GRUPO_ID,
      { texto: "quanto custa?", recebidoEm: T0.toISOString() },
      T0,
    );

    await flushGruposMaduros(db, depois(JANELA), COM_CONTEXTO, DEFAULT_CONFIG);

    const respostas = await todasAsRespostas(db);
    expect(respostas).toHaveLength(1);
    expect(respostas[0].leadId).toBe("ChIJcontexto");
    expect(respostas[0].mensagens.map((m) => m.texto)).toEqual(["quanto custa?"]);
    expect(respostas[0].teste).toBe(true);
    // O prompt de fato usou o lead de contexto (nome no corpo da chamada).
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.contents[0].parts[0].text).toContain("Lead de Contexto");
  });

  it("NUNCA vira tarefa automática, mesmo com respostaAutomatica ligado", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJcontexto", baseLead({ placeId: "ChIJcontexto" }) as unknown as Record<string, unknown>);
    await adicionarMensagemAoGrupo(
      db,
      EXCECAO_GRUPO_ID,
      { texto: "Oi", recebidoEm: T0.toISOString() },
      T0,
    );

    await flushGruposMaduros(
      db,
      depois(JANELA),
      { ...COM_CONTEXTO, respostaAutomatica: true, respostaAutomaticaApenasPrimeira: false },
      DEFAULT_CONFIG,
    );

    expect(await todasAsRespostas(db)).toHaveLength(1);
    expect(await tarefas(db)).toHaveLength(0);
  });

  it("sem leadContextoExcecao configurado, as mensagens se perdem — mesmo tratamento de 'lead sumiu'", async () => {
    const db = new FakeFirestore();
    await adicionarMensagemAoGrupo(
      db,
      EXCECAO_GRUPO_ID,
      { texto: "Oi", recebidoEm: T0.toISOString() },
      T0,
    );

    await expect(
      flushGruposMaduros(
        db,
        depois(JANELA),
        { ...DEFAULT_FILA_CONFIG, numeroExcecao: "5544999998888", leadContextoExcecao: "" },
        DEFAULT_CONFIG,
      ),
    ).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await todasAsRespostas(db)).toHaveLength(0);
  });

  it("um rascunho de exceção NÃO conta como 'primeira resposta' do lead de contexto para o automático real", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJcontexto", baseLead({ placeId: "ChIJcontexto" }) as unknown as Record<string, unknown>);
    // Um ensaio primeiro...
    await adicionarMensagemAoGrupo(
      db,
      EXCECAO_GRUPO_ID,
      { texto: "ensaio", recebidoEm: T0.toISOString() },
      T0,
    );
    await flushGruposMaduros(db, depois(JANELA), COM_CONTEXTO, DEFAULT_CONFIG);

    // ...depois o lead de contexto responde DE VERDADE, com a automática ligada.
    const t2 = depois(JANELA + 60);
    await adicionarMensagemAoGrupo(db, "ChIJcontexto", { texto: "de verdade", recebidoEm: t2.toISOString() }, t2);
    await flushGruposMaduros(
      db,
      new Date(t2.getTime() + (JANELA + 1) * 1000),
      { ...COM_CONTEXTO, respostaAutomatica: true },
      DEFAULT_CONFIG,
    );

    // A resposta de verdade ainda é tratada como "primeira" (o ensaio não conta) → vira tarefa.
    const tarefasCriadas = await tarefas(db);
    expect(tarefasCriadas).toHaveLength(1);
    expect(tarefasCriadas[0].leadId).toBe("ChIJcontexto");
  });

  it("dois grupos maduros ao mesmo tempo — o de exceção e um lead real — geram dois rascunhos independentes", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead({ placeId: "ChIJlead1" }) as unknown as Record<string, unknown>);
    db.seed("leads/ChIJcontexto", baseLead({ placeId: "ChIJcontexto" }) as unknown as Record<string, unknown>);
    await adicionarMensagemAoGrupo(db, "ChIJlead1", { texto: "Oi real", recebidoEm: T0.toISOString() }, T0);
    await adicionarMensagemAoGrupo(
      db,
      EXCECAO_GRUPO_ID,
      { texto: "Oi ensaio", recebidoEm: T0.toISOString() },
      T0,
    );

    await flushGruposMaduros(db, depois(JANELA), COM_CONTEXTO, DEFAULT_CONFIG);

    const respostas = await todasAsRespostas(db);
    expect(respostas).toHaveLength(2);
    const doLead = respostas.find((r) => r.leadId === "ChIJlead1");
    const doEnsaio = respostas.find((r) => r.leadId === "ChIJcontexto");
    expect(doLead?.teste).toBeFalsy();
    expect(doEnsaio?.teste).toBe(true);
  });
});
