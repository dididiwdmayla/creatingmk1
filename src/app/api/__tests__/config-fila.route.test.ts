import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_FILA_CONFIG } from "@/lib/fila/config";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET, PUT } from "../config/fila/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function getRequest(cookie?: string): Request {
  return new Request("http://localhost/api/config/fila", {
    headers: { ...(cookie && { cookie }) },
  });
}

function putRequest(body: unknown, cookie?: string): Request {
  return new Request("http://localhost/api/config/fila", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(cookie && { cookie }),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("GET /api/config/fila (restrito ao admin)", () => {
  it("retorna os defaults quando não há doc", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    const res = await GET(getRequest(cookie));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ fila: DEFAULT_FILA_CONFIG });
  });

  it("sem sessão → 401 unauthorized", async () => {
    const res = await GET(getRequest());

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });

  it("membro → 403, e a config da fila não vaza no corpo", async () => {
    // O painel inteiro é do admin, não só a escrita: a fila é global (um
    // config/fila, um pool, um contador) e drenada por UM aparelho físico.
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    const res = await GET(getRequest(cookie));

    expect(res.status).toBe(403);
    const corpo = await res.json();
    expect(corpo.error.code).toBe("forbidden");
    expect(corpo.fila).toBeUndefined();
  });
});

describe("PUT /api/config/fila (restrito ao admin)", () => {
  it("admin aplica patch parcial e o GET seguinte reflete", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    const res = await PUT(putRequest({ ativo: false, metaDiaria: 20 }, cookie));

    expect(res.status).toBe(200);
    const { fila } = await res.json();
    expect(fila.ativo).toBe(false);
    expect(fila.metaDiaria).toBe(20);
    expect(fila.tetoPorHora).toBe(DEFAULT_FILA_CONFIG.tetoPorHora);

    const after = await (await GET(getRequest(cookie))).json();
    expect(after.fila.ativo).toBe(false);
  });

  it("sem sessão → 401 unauthorized", async () => {
    const res = await PUT(putRequest({ ativo: false }));

    expect(res.status).toBe(401);
    const { error } = await res.json();
    expect(error.code).toBe("unauthorized");
  });

  it("membro → 403 forbidden (fila é do admin)", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    const res = await PUT(putRequest({ ativo: false }, cookie));

    expect(res.status).toBe(403);
    const { error } = await res.json();
    expect(error.code).toBe("forbidden");
  });

  it("patch inválido → 400 validation_error com problemas", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    const res = await PUT(putRequest({ metaDiaria: -1, typo: 1 }, cookie));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("validation_error");
    expect(error.problemas).toEqual([
      "chave desconhecida: typo",
      "metaDiaria deve ser inteiro ≥ 0",
    ]);
  });

  it("corpo que não é JSON → 400", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    const res = await PUT(putRequest("ativo=false", cookie));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("validation_error");
  });
});

/**
 * "pausada pelo aparelho às 03:12" responde sozinho uma pergunta que hoje
 * exige adivinhação — mas só quando `ativo` de fato muda. Editar outro campo
 * ao lado não pode fazer parecer que o admin acabou de mexer na pausa.
 */
describe("PUT /api/config/fila — registro de quem alterou `ativo`", () => {
  it("mudar ativo carimba ativoAlteradoPor com o userId do admin", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin-1", papel: "admin" });

    const res = await PUT(putRequest({ ativo: false }, cookie));

    const { fila } = await res.json();
    expect(fila.ativoAlteradoPor).toBe("admin-1");
    expect(fila.ativoAlteradoEm).toEqual(expect.any(String));
  });

  it("mandar o mesmo valor de ativo (sem mudar) NÃO carimba nada", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin-1", papel: "admin" });
    // ativo já é `true` (default) — reenviar o mesmo valor não é uma mudança.
    const res = await PUT(putRequest({ ativo: true }, cookie));

    const { fila } = await res.json();
    expect(fila.ativoAlteradoPor).toBeNull();
    expect(fila.ativoAlteradoEm).toBeNull();
  });

  it("editar outro campo sem tocar ativo não mexe no carimbo", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin-1", papel: "admin" });
    await PUT(putRequest({ ativo: false }, cookie));

    const res = await PUT(putRequest({ metaDiaria: 30 }, cookie));

    const { fila } = await res.json();
    expect(fila.metaDiaria).toBe(30);
    expect(fila.ativo).toBe(false);
    // O carimbo continua sendo o da mudança de ativo anterior, não apagado
    // nem reescrito por um PUT que nem tocou o campo.
    expect(fila.ativoAlteradoPor).toBe("admin-1");
  });
});

/**
 * REGRA DE SEGURANÇA CONTRA COLAPSO: alteração de configuração NUNCA
 * invalida claim já emitida. Um humano edita a /config enquanto o celular
 * pode estar no meio de um ciclo — lead reservado segue reservado até
 * confirmar ou expirar. Quem decide a vida da claim é `expiraEm`, e nada
 * nesta rota escreve em `filaEnvios`.
 */
describe("PUT /api/config/fila — não encosta nas claims", () => {
  it("pausar a fila deixa a reserva viva intacta", async () => {
    const claim = {
      leadId: "ChIJa",
      estado: "reservado",
      claimId: "claim-viva",
      reservadoEm: "2026-03-10T10:00:00.000Z",
      expiraEm: "2026-03-10T10:05:00.000Z",
      dispositivo: "android",
      tentativas: 0,
      ultimoErro: null,
      enviadoEm: null,
    };
    db.seed("filaEnvios/ChIJa", claim);
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PUT(
      putRequest({ ativo: false, metaDiaria: 0, exigirJanelaBoa: false }, cookie),
      );

    expect(res.status).toBe(200);
    expect(db.getDoc("filaEnvios/ChIJa")).toEqual(claim);
  });
});
