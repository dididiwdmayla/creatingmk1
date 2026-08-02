import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saoPauloDateKey } from "@/lib/costs";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET, PUT } from "../metas/proprio/route";

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
  return new Request("http://localhost/api/metas/proprio", {
    ...(cookie && { headers: { cookie } }),
  });
}

function putReq(minimizada: unknown, cookie?: string): Request {
  return new Request("http://localhost/api/metas/proprio", {
    method: "PUT",
    body: JSON.stringify({ minimizada }),
    ...(cookie && { headers: { cookie } }),
  });
}

describe("GET /api/metas/proprio", () => {
  it("sem sessão → 401", async () => {
    expect((await GET(getReq())).status).toBe(401);
  });

  it("devolve progresso do PRÓPRIO usuário + minimizada padrão false", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    db.seed("usuarios/m1", {
      id: "m1",
      nome: "Ana",
      papel: "membro",
      ativo: true,
      sessao: 0,
      metas: { prospeccoesDia: 5 },
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });
    const hoje = saoPauloDateKey(new Date());
    db.seed(`usage_users/m1/dias/${hoje}`, { buscas: 3, enriquecimentos: 9 });

    const res = await GET(getReq(cookie));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dia).toEqual({ usado: 3, meta: 5 });
    expect(body.semana).toEqual({ usado: 3, meta: undefined });
    expect(body.minimizada).toBe(false);
  });

  it("usuário sem nenhuma meta: usado presente, meta ausente nas duas janelas", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    const res = await GET(getReq(cookie));

    const body = await res.json();
    expect(body.dia).toEqual({ usado: 0, meta: undefined });
    expect(body.semana).toEqual({ usado: 0, meta: undefined });
  });
});

describe("PUT /api/metas/proprio", () => {
  it("sem sessão → 401", async () => {
    expect((await PUT(putReq(true))).status).toBe(401);
  });

  it("salva a faixa minimizada do PRÓPRIO usuário", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    const res = await PUT(putReq(true, cookie));

    expect(res.status).toBe(200);
    expect((await res.json()).minimizada).toBe(true);
    expect(db.getDoc("usuarios/m1")).toMatchObject({ metaFaixaMinimizada: true });

    const getRes = await GET(getReq(cookie));
    expect((await getRes.json()).minimizada).toBe(true);
  });

  it("rejeita minimizada não-boolean", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    const res = await PUT(putReq("sim", cookie));

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_error");
  });
});
