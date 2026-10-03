import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppDb } from "@/lib/firestore-like";
import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";

import { GET as getEventos } from "../config/fila/eventos/route";
import { POST as confirmar } from "../fila/confirmar/route";
import { GET as getProximo } from "../fila/proximo/route";

/**
 * O RASTRO DAS RESPOSTAS DE ERRO — ver "Eventos da fila" em ARCHITECTURE.md.
 *
 * Toda resposta não-200 de `/api/fila/proximo` e `/api/fila/confirmar` (400,
 * 409, 500, 503) grava um evento com rota, status, leadId e claimId quando
 * houver, motivo e horário. Foi a falta disto que escondeu por semanas o 503
 * de TODO confirmar: o aparelho recebia o erro, o servidor não guardava nada,
 * e ninguém via. 401 NÃO grava no banco (quem não tem a chave do aparelho
 * não pode ganhar o poder de escrever no Firestore) — só log.
 *
 * Gravar o evento nunca muda a resposta: se a escrita falhar, a rota
 * responde exatamente o mesmo.
 */

let db: AppDb;
let fake: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const CHAVE = "chave-do-celular";
const AGORA = new Date("2026-03-10T10:00:00Z");
const DIA = "2026-03-10";

function lead(id: string): Lead {
  return {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    busca: { nicho: "barbearia", regiao: "Maringá", em: "2026-03-01T00:00:00.000Z" },
    demo: { skinId: "barbearia-editorial" },
    horarios: { faixas: [], utcOffsetMinutes: 0, obtidoEm: "2026-03-01T00:00:00.000Z" },
    capturas: {
      estado: "pronto",
      execucaoId: "exec-1",
      pedidoEm: "2026-03-01T00:00:00.000Z",
      imagens: [{ ancora: "hero", tela: "celular", ordem: 1, url: "https://storage/hero.png", largura: 1, altura: 1 }],
    },
    criadoEm: "2026-03-01T00:00:00.000Z",
    atualizadoEm: "2026-03-01T00:00:00.000Z",
  } as unknown as Lead;
}

function postConfirmar(corpo: unknown, chave = CHAVE) {
  return confirmar(
    new Request("http://localhost/api/fila/confirmar", {
      method: "POST",
      headers: { authorization: `Bearer ${chave}`, "content-type": "application/json" },
      body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    }),
  );
}

function proximo(chave = CHAVE) {
  return getProximo(new Request("http://localhost/api/fila/proximo", { headers: { authorization: `Bearer ${chave}` } }));
}

async function eventosGravados(dia = DIA) {
  const snap = await fake.collection(`filaEventos/${dia}/itens`).get();
  return snap.docs.map((d) => d.data());
}

beforeEach(() => {
  fake = new FakeFirestore();
  db = fake;
  fake.seed("config/automacao", { corteLegado: "2000-01-01" });
  vi.stubEnv("RADAR_DEVICE_KEY", CHAVE);
  vi.stubEnv("RADAR_DEVICE_USER_ID", "admin");
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/fila/confirmar — resposta não-200 grava evento", () => {
  it("409: rota, status, leadId, claimId, motivo e horário; total do dia soma 1", async () => {
    const res = await postConfirmar({ id: "claim-x", leadId: "ChIJa", resultado: "enviado", detalhe: "" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ erro: "claim_invalida" });
    expect(await eventosGravados()).toEqual([
      {
        rota: "confirmar",
        status: 409,
        leadId: "ChIJa",
        claimId: "claim-x",
        motivo: "claim_invalida",
        em: AGORA.toISOString(),
      },
    ]);
    expect(fake.getDoc(`filaEventos/${DIA}`)).toMatchObject({ total: 1, porStatus: { "409": 1 } });
  });

  it("400 com corpo malformado: motivo do corpo, leadId/claimId nulos quando não vieram", async () => {
    const res = await postConfirmar({ resultado: "talvez" });

    expect(res.status).toBe(400);
    const [evento] = await eventosGravados();
    expect(evento).toMatchObject({ rota: "confirmar", status: 400, leadId: null, claimId: null, motivo: "corpo_invalido" });
  });

  it("400 com JSON quebrado também grava (e não derruba nada)", async () => {
    const res = await postConfirmar("{isto não é json");

    expect(res.status).toBe(400);
    expect((await eventosGravados())[0]).toMatchObject({ status: 400, leadId: null, claimId: null });
  });

  it("503 sem RADAR_DEVICE_USER_ID — o erro que ninguém viu — fica registrado", async () => {
    vi.stubEnv("RADAR_DEVICE_USER_ID", "");

    const res = await postConfirmar({ id: "claim-y", leadId: "ChIJb", resultado: "enviado", detalhe: "" });

    expect(res.status).toBe(503);
    expect((await eventosGravados())[0]).toMatchObject({
      rota: "confirmar",
      status: 503,
      leadId: "ChIJb",
      claimId: "claim-y",
      motivo: "config_error",
    });
  });

  it("200 não grava evento nenhum", async () => {
    fake.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    const tarefa = await (await proximo()).json();

    const res = await postConfirmar({ id: tarefa.id, leadId: "ChIJa", resultado: "enviado", detalhe: "" });

    expect(res.status).toBe(200);
    expect(await eventosGravados()).toEqual([]);
    expect(fake.getDoc(`filaEventos/${DIA}`)).toBeUndefined();
  });

  it("401 NÃO escreve no banco — sem a chave, ninguém ganha escrita no Firestore", async () => {
    const res = await postConfirmar({ id: "c", leadId: "ChIJa", resultado: "enviado" }, "chave-errada");

    expect(res.status).toBe(401);
    expect(await eventosGravados()).toEqual([]);
    expect(fake.getDoc(`filaEventos/${DIA}`)).toBeUndefined();
  });

  it("falha ao gravar o evento NÃO muda a resposta", async () => {
    const real = fake.collection.bind(fake);
    db = {
      collection: (nome: string) => {
        if (nome.startsWith("filaEventos")) throw new Error("Firestore indisponível");
        return real(nome);
      },
      runTransaction: (fn) => fake.runTransaction(fn),
    };
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await postConfirmar({ id: "claim-x", leadId: "ChIJa", resultado: "enviado", detalhe: "" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ erro: "claim_invalida" });
    expect(erro).toHaveBeenCalled();
  });
});

describe("GET /api/fila/proximo — resposta não-200 grava evento", () => {
  it("500 (erro inesperado) grava rota proximo, status 500 e o código do erro", async () => {
    fake.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    // A primeira transação (a reserva) explode; as seguintes (o evento) passam.
    const original = fake.runTransaction.bind(fake);
    let chamadas = 0;
    vi.spyOn(fake, "runTransaction").mockImplementation((fn) => {
      chamadas += 1;
      if (chamadas === 1) return Promise.reject(new Error("contention"));
      return original(fn);
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await proximo();

    expect(res.status).toBe(500);
    expect((await eventosGravados())[0]).toMatchObject({
      rota: "proximo",
      status: 500,
      leadId: null,
      claimId: null,
      motivo: "internal_error",
    });
  });

  it("200 sem tarefa (motivo de ritmo) não é erro e não grava evento", async () => {
    fake.seed("config/fila", { ativo: false });

    const res = await proximo();

    expect(res.status).toBe(200);
    expect((await res.json()).motivo).toBe("pausado");
    expect(await eventosGravados()).toEqual([]);
  });
});

describe("GET /api/config/fila/eventos (restrito ao admin)", () => {
  function request(cookie?: string) {
    return new Request("http://localhost/api/config/fila/eventos", { headers: { ...(cookie && { cookie }) } });
  }

  it("sem sessão → 401; membro → 403", async () => {
    expect((await getEventos(request())).status).toBe(401);
    const membro = await cookieDeSessao(fake, { id: "m1", papel: "membro" });
    expect((await getEventos(request(membro))).status).toBe(403);
  });

  it("contagem do dia e os últimos eventos, mais recente primeiro, ontem incluído", async () => {
    // Ontem (dia operacional anterior): entra na lista, não na contagem de hoje.
    vi.setSystemTime(new Date("2026-03-09T22:00:00Z"));
    await postConfirmar({ id: "c-ontem", leadId: "ChIJontem", resultado: "enviado", detalhe: "" });
    vi.setSystemTime(new Date("2026-03-10T09:00:00Z"));
    await postConfirmar({ resultado: "x" });
    vi.setSystemTime(new Date("2026-03-10T09:30:00Z"));
    await postConfirmar({ id: "c-hoje", leadId: "ChIJhoje", resultado: "falhou", detalhe: "" });
    vi.setSystemTime(AGORA);
    const admin = await cookieDeSessao(fake, { id: "admin", papel: "admin" });

    const corpo = await (await getEventos(request(admin))).json();

    expect(corpo.totalHoje).toBe(2);
    expect(corpo.diaOperacional).toBe(DIA);
    expect(corpo.eventos.map((e: { em: string }) => e.em)).toEqual([
      "2026-03-10T09:30:00.000Z",
      "2026-03-10T09:00:00.000Z",
      "2026-03-09T22:00:00.000Z",
    ]);
    expect(corpo.eventos[0]).toMatchObject({ rota: "confirmar", status: 409, leadId: "ChIJhoje", claimId: "c-hoje" });
  });

  it("no máximo 20 eventos na lista; a contagem do dia é a de verdade", async () => {
    for (let i = 0; i < 25; i += 1) {
      vi.setSystemTime(new Date(AGORA.getTime() - (25 - i) * 60_000));
      await postConfirmar({ id: `c-${i}`, leadId: `ChIJ${i}`, resultado: "enviado", detalhe: "" });
    }
    vi.setSystemTime(AGORA);
    const admin = await cookieDeSessao(fake, { id: "admin", papel: "admin" });

    const corpo = await (await getEventos(request(admin))).json();

    expect(corpo.totalHoje).toBe(25);
    expect(corpo.eventos).toHaveLength(20);
    expect(corpo.eventos[0].claimId).toBe("c-24");
  });

  it("cada evento traz o NOME do lead (lido por id), nunca só o placeId; lead excluído vem vazio", async () => {
    fake.seed("leads/ChIJhoje", { ...(lead("ChIJhoje") as unknown as Record<string, unknown>), nome: "Barbearia do Zé" });
    await postConfirmar({ id: "c1", leadId: "ChIJhoje", resultado: "enviado", detalhe: "" });
    await postConfirmar({ id: "c2", leadId: "ChIJsumiu", resultado: "enviado", detalhe: "" });
    const admin = await cookieDeSessao(fake, { id: "admin", papel: "admin" });

    const { eventos } = await (await getEventos(request(admin))).json();

    const porLead = Object.fromEntries(eventos.map((e: { leadId: string; nomeLead: string }) => [e.leadId, e.nomeLead]));
    expect(porLead).toEqual({ ChIJhoje: "Barbearia do Zé", ChIJsumiu: "" });
  });

  it("dia sem erro nenhum: zero e lista vazia, nunca erro", async () => {
    const admin = await cookieDeSessao(fake, { id: "admin", papel: "admin" });
    expect(await (await getEventos(request(admin))).json()).toMatchObject({ totalHoje: 0, eventos: [] });
  });
});
