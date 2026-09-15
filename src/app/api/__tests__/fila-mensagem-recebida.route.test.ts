import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CANAL_INDIVIDUAL } from "@/lib/fila/mensagemRecebida";
import { listarGruposPendentes } from "@/lib/fila/respostasPendentes";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import type { Lead } from "@/lib/leads/types";
import { POST } from "../fila/mensagem-recebida/route";

/**
 * `POST /api/fila/mensagem-recebida` — a macro do MacroDroid captura cada
 * notificação do WhatsApp Business no celular PESSOAL do operador. O que
 * estes testes protegem, acima de tudo, é a PRIVACIDADE (descarte
 * silencioso sem lead ou em canal de grupo — nada persiste) e o DEDUPE por
 * chave — não o "recebidoEm mudou" que a macro pode reenviar.
 */

const CHAVE = "chave-do-celular";
const T0 = new Date("2026-03-10T10:00:00Z");

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: id,
    nome: `Lead ${id}`,
    status: "contactado",
    enriquecido: false,
    telefoneIntl: "+55 16 98213-3909",
    criadoEm: "2026-03-01T00:00:00.000Z",
    atualizadoEm: "2026-03-01T00:00:00.000Z",
    ...overrides,
  } as Lead;
}

function semear(...leads: Lead[]) {
  for (const l of leads) db.seed(`leads/${l.placeId}`, l as unknown as Record<string, unknown>);
}

function corpoPadrao(overrides: Record<string, unknown> = {}) {
  return {
    remetente: "+55 16 98213-3909",
    texto: "Oi, tenho interesse!",
    canal: CANAL_INDIVIDUAL,
    recebidoEm: T0.toISOString(),
    chave: "hash-1",
    ...overrides,
  };
}

function mensagemRecebida(
  body: unknown,
  headers: Record<string, string> = { authorization: `Bearer ${CHAVE}` },
) {
  return POST(
    new Request("http://localhost/api/fila/mensagem-recebida", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("RADAR_DEVICE_KEY", CHAVE);
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("POST /api/fila/mensagem-recebida — autenticação", () => {
  it("sem a RADAR_DEVICE_KEY correta devolve 401", async () => {
    semear(lead("ChIJa"));
    const res = await mensagemRecebida(corpoPadrao(), { authorization: "Bearer errada" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ erro: "nao_autorizado" });
  });

  it("sem header nenhum devolve 401", async () => {
    expect((await mensagemRecebida(corpoPadrao(), {})).status).toBe(401);
  });

  it("sem RADAR_DEVICE_KEY configurada no servidor devolve 503", async () => {
    vi.unstubAllEnvs();
    const res = await mensagemRecebida(corpoPadrao());
    expect(res.status).toBe(503);
  });
});

describe("POST /api/fila/mensagem-recebida — corpo", () => {
  it("corpo incompleto é 400 e não persiste nada", async () => {
    semear(lead("ChIJa"));
    const res = await mensagemRecebida({ remetente: "+55 16 98213-3909" });
    expect(res.status).toBe(400);
    expect(db.getDoc("leads/ChIJa/respostas/hash-1")).toBeUndefined();
  });
});

describe("POST /api/fila/mensagem-recebida — privacidade", () => {
  it("remetente sem lead correspondente: 200, nada persiste em lugar nenhum", async () => {
    semear(lead("ChIJa", { telefoneIntl: "+55 44 90000-0000" }));

    const res = await mensagemRecebida(corpoPadrao());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(db.getDoc("leads/ChIJa/respostas/hash-1")).toBeUndefined();
    expect(await listarGruposPendentes(db)).toEqual([]);
  });

  it("canal de grupo: 200, descartado, nada persiste", async () => {
    semear(lead("ChIJa"));

    const res = await mensagemRecebida(corpoPadrao({ canal: "group_chat_defaults_1" }));

    expect(res.status).toBe(200);
    expect(db.getDoc("leads/ChIJa/respostas/hash-1")).toBeUndefined();
    expect(await listarGruposPendentes(db)).toEqual([]);
  });
});

describe("POST /api/fila/mensagem-recebida — dedupe por chave", () => {
  it("chave repetida devolve 200 sem reprocessar (recebidoEm novo não muda isso)", async () => {
    semear(lead("ChIJa"));
    await mensagemRecebida(corpoPadrao());

    const t2 = new Date(T0.getTime() + 30_000);
    vi.setSystemTime(t2);
    const res = await mensagemRecebida(corpoPadrao({ recebidoEm: t2.toISOString() }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const [grupo] = await listarGruposPendentes(db);
    expect(grupo.mensagens).toHaveLength(1);
  });
});

describe("POST /api/fila/mensagem-recebida — telefone normalizado", () => {
  it("remetente com espaços/parênteses casa com o telefone do lead", async () => {
    semear(lead("ChIJa", { telefoneIntl: "+55 (16) 98213-3909" }));

    const res = await mensagemRecebida(corpoPadrao({ remetente: "+55 16 98213-3909" }));

    expect(res.status).toBe(200);
    expect(db.getDoc("leads/ChIJa/respostas/hash-1")).toMatchObject({ texto: "Oi, tenho interesse!" });
  });
});

describe("POST /api/fila/mensagem-recebida — status", () => {
  it("contactado -> respondeu", async () => {
    semear(lead("ChIJa", { status: "contactado" }));
    await mensagemRecebida(corpoPadrao());
    expect(db.getDoc("leads/ChIJa")?.status).toBe("respondeu");
  });

  it("fechado nunca é rebaixado", async () => {
    semear(lead("ChIJa", { status: "fechado" }));
    await mensagemRecebida(corpoPadrao());
    expect(db.getDoc("leads/ChIJa")?.status).toBe("fechado");
    expect(db.getDoc("leads/ChIJa/respostas/hash-1")).toBeDefined();
  });
});
