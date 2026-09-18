import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { MAX_PAINEIS_CONFIG_ABERTOS } from "@/lib/usuarios/preferencias";
import { GET, PUT } from "../preferencias/paineis/route";

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
  return new Request("http://localhost/api/preferencias/paineis", {
    ...(cookie && { headers: { cookie } }),
  });
}

function putReq(paineis: unknown, cookie?: string): Request {
  return new Request("http://localhost/api/preferencias/paineis", {
    method: "PUT",
    body: JSON.stringify({ paineis }),
    ...(cookie && { headers: { cookie } }),
  });
}

function comDoc(id: string, campos: Record<string, unknown>) {
  db.seed(`usuarios/${id}`, {
    ...(db.getDoc(`usuarios/${id}`) as Record<string, unknown>),
    ...campos,
  });
}

describe("GET /api/preferencias/paineis", () => {
  it("sem sessão → 401", async () => {
    expect((await GET(getReq())).status).toBe(401);
  });

  /**
   * O padrão da /config é TUDO fechado — então quem nunca mexeu recebe
   * lista vazia, e não uma lista de ids "abertos por enquanto".
   */
  it("usuário que nunca mexeu recebe lista vazia (tudo fechado)", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });

    const res = await GET(getReq(cookie));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ paineis: [] });
  });

  it("devolve o que está no doc do PRÓPRIO usuário", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });
    comDoc("m1", { paineisConfigAbertos: ["fila-envio", "frases"] });

    const body = await (await GET(getReq(cookie))).json();

    expect(body.paineis).toEqual(["fila-envio", "frases"]);
  });

  it("doc sujo (formato errado) cai em tudo fechado em vez de quebrar", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });
    comDoc("m1", { paineisConfigAbertos: "fila-envio" });

    const body = await (await GET(getReq(cookie))).json();

    expect(body.paineis).toEqual([]);
  });

  it("descarta entrada que não é string não-vazia", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });
    comDoc("m1", { paineisConfigAbertos: ["fila-envio", "", 7, null, "frases"] });

    const body = await (await GET(getReq(cookie))).json();

    expect(body.paineis).toEqual(["fila-envio", "frases"]);
  });

  /** Um usuário não vê o painel aberto do outro — a preferência é do doc dele. */
  it("não vaza a preferência de outro usuário", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });
    await cookieDeSessao(db, { id: "m2" });
    comDoc("m2", { paineisConfigAbertos: ["frases"] });

    const body = await (await GET(getReq(cookie))).json();

    expect(body.paineis).toEqual([]);
  });
});

describe("PUT /api/preferencias/paineis", () => {
  it("sem sessão → 401", async () => {
    expect((await PUT(putReq(["fila-envio"]))).status).toBe(401);
  });

  it("corpo que não é array → 400", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });

    expect((await PUT(putReq("fila-envio", cookie))).status).toBe(400);
    expect((await PUT(putReq({ "fila-envio": true }, cookie))).status).toBe(400);
  });

  it("grava no doc do usuário e devolve o normalizado", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });

    const res = await PUT(putReq(["fila-envio", "fila-envio", "frases"], cookie));

    expect(res.status).toBe(200);
    expect((await res.json()).paineis).toEqual(["fila-envio", "frases"]);
    expect(db.getDoc("usuarios/m1")).toMatchObject({
      paineisConfigAbertos: ["fila-envio", "frases"],
    });
  });

  it("lista vazia fecha tudo (é estado legítimo, não corpo inválido)", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });
    comDoc("m1", { paineisConfigAbertos: ["frases"] });

    const res = await PUT(putReq([], cookie));

    expect(res.status).toBe(200);
    expect((await res.json()).paineis).toEqual([]);
    expect(db.getDoc("usuarios/m1")).toMatchObject({ paineisConfigAbertos: [] });
  });

  it("corta os ids mais antigos no teto — o doc não vira acumulador", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });
    const ids = Array.from({ length: MAX_PAINEIS_CONFIG_ABERTOS + 5 }, (_, i) => `p${i}`);

    const { paineis } = await (await PUT(putReq(ids, cookie))).json();

    expect(paineis).toHaveLength(MAX_PAINEIS_CONFIG_ABERTOS);
    expect(paineis[0]).toBe("p5");
    expect(paineis.at(-1)).toBe(`p${MAX_PAINEIS_CONFIG_ABERTOS + 4}`);
  });

  /**
   * Abrir um painel não é edição administrativa: não pode derrubar a
   * sessão de ninguém nem carimbar `atualizadoEm` (mesma cobrança da rota
   * das listas e do `salvarMetaFaixaMinimizada`).
   */
  it("preferência de UI não derruba sessão nem carimba edição administrativa", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });
    const antes = db.getDoc("usuarios/m1") as Record<string, unknown>;

    await PUT(putReq(["fila-envio"], cookie));

    const depois = db.getDoc("usuarios/m1") as Record<string, unknown>;
    expect(depois.sessao).toBe(antes.sessao);
    expect(depois.atualizadoEm).toBe(antes.atualizadoEm);
  });

  /** Membro também grava a PRÓPRIA preferência: self-service, sem admin. */
  it("membro grava a própria preferência", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    const res = await PUT(putReq(["frases"], cookie));

    expect(res.status).toBe(200);
    expect(db.getDoc("usuarios/m1")).toMatchObject({ paineisConfigAbertos: ["frases"] });
  });
});
