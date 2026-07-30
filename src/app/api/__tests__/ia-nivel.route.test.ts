import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET, PUT } from "../ia/nivel/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function getReq(cookie?: string): Request {
  return new Request("http://localhost/api/ia/nivel", {
    ...(cookie && { headers: { cookie } }),
  });
}

function putReq(nivel: unknown, cookie?: string): Request {
  return new Request("http://localhost/api/ia/nivel", {
    method: "PUT",
    body: JSON.stringify({ nivel }),
    ...(cookie && { headers: { cookie } }),
  });
}

describe("GET /api/ia/nivel", () => {
  it("sem sessão → 401", async () => {
    expect((await GET(getReq())).status).toBe(401);
  });

  it("usuário sem nível salvo → padrão equilibrado", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    const res = await GET(getReq(cookie));
    expect(res.status).toBe(200);
    expect((await res.json()).nivel).toBe("equilibrado");
  });

  it("devolve o último nível salvo", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    await PUT(putReq("completo", cookie));

    const res = await GET(getReq(cookie));
    expect((await res.json()).nivel).toBe("completo");
  });
});

describe("PUT /api/ia/nivel", () => {
  it("sem sessão → 401", async () => {
    expect((await PUT(putReq("toque-leve"))).status).toBe(401);
  });

  it("salva o nível do PRÓPRIO usuário", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    const res = await PUT(putReq("toque-leve", cookie));

    expect(res.status).toBe(200);
    expect((await res.json()).nivel).toBe("toque-leve");
    expect(db.getDoc("usuarios/m1")).toMatchObject({ ultimoNivelIA: "toque-leve" });
  });

  it("rejeita nível fora de toque-leve/equilibrado/completo", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    const res = await PUT(putReq("extremo", cookie));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_error");
  });
});
