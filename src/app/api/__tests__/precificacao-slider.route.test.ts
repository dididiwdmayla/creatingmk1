import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET, PUT } from "../precificacao/slider/route";

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
  return new Request("http://localhost/api/precificacao/slider", {
    ...(cookie && { headers: { cookie } }),
  });
}

function putReq(precoBase: unknown, cookie?: string): Request {
  return new Request("http://localhost/api/precificacao/slider", {
    method: "PUT",
    body: JSON.stringify({ precoBase }),
    ...(cookie && { headers: { cookie } }),
  });
}

describe("GET /api/precificacao/slider", () => {
  it("sem sessão → 401", async () => {
    expect((await GET(getReq())).status).toBe(401);
  });

  it("usuário sem posição salva → precoBase null", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    const res = await GET(getReq(cookie));
    expect(res.status).toBe(200);
    expect((await res.json()).precoBase).toBeNull();
  });

  it("devolve a última posição salva", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    await PUT(putReq(2500, cookie));

    const res = await GET(getReq(cookie));
    expect((await res.json()).precoBase).toBe(2500);
  });
});

describe("PUT /api/precificacao/slider", () => {
  it("sem sessão → 401", async () => {
    expect((await PUT(putReq(2000))).status).toBe(401);
  });

  it("salva a posição do PRÓPRIO usuário", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    const res = await PUT(putReq(3500, cookie));

    expect(res.status).toBe(200);
    expect((await res.json()).precoBase).toBe(3500);
    expect(db.getDoc("usuarios/m1")).toMatchObject({ ultimoPrecoBaseSlider: 3500 });
  });

  it("rejeita fora da faixa 700–10.000", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    expect((await PUT(putReq(699, cookie))).status).toBe(400);
    expect((await PUT(putReq(10_001, cookie))).status).toBe(400);
    expect((await PUT(putReq(1000.5, cookie))).status).toBe(400);
  });
});
