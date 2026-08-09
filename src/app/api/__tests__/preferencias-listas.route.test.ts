import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { MAX_GRUPOS_FECHADOS } from "@/lib/usuarios/preferencias";
import { GET, PUT } from "../preferencias/listas/route";

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
  return new Request("http://localhost/api/preferencias/listas", {
    ...(cookie && { headers: { cookie } }),
  });
}

function putReq(preferencias: unknown, cookie?: string): Request {
  return new Request("http://localhost/api/preferencias/listas", {
    method: "PUT",
    body: JSON.stringify({ preferencias }),
    ...(cookie && { headers: { cookie } }),
  });
}

describe("GET /api/preferencias/listas", () => {
  it("sem sessão → 401", async () => {
    expect((await GET(getReq())).status).toBe(401);
  });

  it("usuário que nunca mexeu recebe o padrão (tudo aberto, sem compacto)", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });

    const res = await GET(getReq(cookie));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      preferencias: {
        leadsCompacto: false,
        gruposFechados: { leads: [], buscas: [] },
      },
    });
  });

  it("devolve o que está no doc do PRÓPRIO usuário", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });
    db.seed("usuarios/m1", {
      ...(db.getDoc("usuarios/m1") as Record<string, unknown>),
      preferenciasListas: {
        leadsCompacto: true,
        gruposFechados: { leads: ["b1"], buscas: ["mes:2026-08"] },
      },
    });

    const body = await (await GET(getReq(cookie))).json();

    expect(body.preferencias).toEqual({
      leadsCompacto: true,
      gruposFechados: { leads: ["b1"], buscas: ["mes:2026-08"] },
    });
  });

  it("doc sujo (formato antigo/errado) cai no padrão em vez de quebrar", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });
    db.seed("usuarios/m1", {
      ...(db.getDoc("usuarios/m1") as Record<string, unknown>),
      preferenciasListas: { leadsCompacto: "sim", gruposFechados: { leads: "b1" } },
    });

    const body = await (await GET(getReq(cookie))).json();

    expect(body.preferencias).toEqual({
      leadsCompacto: false,
      gruposFechados: { leads: [], buscas: [] },
    });
  });
});

describe("PUT /api/preferencias/listas", () => {
  it("sem sessão → 401", async () => {
    expect((await PUT(putReq({ leadsCompacto: true }))).status).toBe(401);
  });

  it("corpo que não é objeto → 400", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });

    expect((await PUT(putReq("compacto", cookie))).status).toBe(400);
    expect((await PUT(putReq(["b1"], cookie))).status).toBe(400);
  });

  it("grava no doc do usuário e devolve o normalizado", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });

    const res = await PUT(
      putReq(
        { leadsCompacto: true, gruposFechados: { leads: ["b1", "b1", "b2"] } },
        cookie,
      ),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).preferencias).toEqual({
      leadsCompacto: true,
      gruposFechados: { leads: ["b1", "b2"], buscas: [] },
    });
    expect(db.getDoc("usuarios/m1")).toMatchObject({
      preferenciasListas: {
        leadsCompacto: true,
        gruposFechados: { leads: ["b1", "b2"], buscas: [] },
      },
    });
  });

  it("corta as chaves mais antigas no teto — o doc não vira acumulador", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });
    const chaves = Array.from({ length: MAX_GRUPOS_FECHADOS + 10 }, (_, i) => `b${i}`);

    const res = await PUT(putReq({ gruposFechados: { buscas: chaves } }, cookie));

    const { buscas } = (await res.json()).preferencias.gruposFechados;
    expect(buscas).toHaveLength(MAX_GRUPOS_FECHADOS);
    expect(buscas[0]).toBe("b10");
    expect(buscas.at(-1)).toBe(`b${MAX_GRUPOS_FECHADOS + 9}`);
  });

  it("preferência de UI não derruba sessão nem carimba edição administrativa", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });
    const antes = db.getDoc("usuarios/m1") as Record<string, unknown>;

    await PUT(putReq({ leadsCompacto: true }, cookie));

    const depois = db.getDoc("usuarios/m1") as Record<string, unknown>;
    expect(depois.sessao).toBe(antes.sessao);
    expect(depois.atualizadoEm).toBe(antes.atualizadoEm);
  });
});
