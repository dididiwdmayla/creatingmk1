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

describe("GET /api/config/fila", () => {
  it("retorna os defaults quando não há doc", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ fila: DEFAULT_FILA_CONFIG });
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

    const after = await (await GET()).json();
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
