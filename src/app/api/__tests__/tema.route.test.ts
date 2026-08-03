import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TEMA_COOKIE } from "@/lib/tema";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET, PUT } from "../tema/route";

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
  return new Request("http://localhost/api/tema", { ...(cookie && { headers: { cookie } }) });
}

function putReq(tema: unknown, cookie?: string): Request {
  return new Request("http://localhost/api/tema", {
    method: "PUT",
    body: JSON.stringify({ tema }),
    ...(cookie && { headers: { cookie } }),
  });
}

/** Valor do cookie-espelho na resposta (o que o RootLayout vai ler depois). */
function cookieTema(res: Response): string | undefined {
  return res.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${TEMA_COOKIE}=`))
    ?.split(";")[0]
    .split("=")[1];
}

describe("GET /api/tema", () => {
  it("sem sessão → 401", async () => {
    expect((await GET(getReq())).status).toBe(401);
  });

  it("usuário que nunca escolheu cai no padrão", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });

    const res = await GET(getReq(cookie));

    expect(res.status).toBe(200);
    expect((await res.json()).tema).toBe("escuro");
  });

  it("devolve o tema do PRÓPRIO doc e reescreve o cookie-espelho", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });
    db.seed("usuarios/m1", { ...(await db.collection("usuarios").doc("m1").get()).data(), tema: "claro" });

    const res = await GET(getReq(cookie));

    expect((await res.json()).tema).toBe("claro");
    // É este passo que conserta o navegador cujo cookie ficou velho porque
    // a escolha mudou em outro dispositivo.
    expect(cookieTema(res)).toBe("claro");
  });

  it("tema sujo/desconhecido no doc lê como padrão (não quebra a página)", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });
    db.seed("usuarios/m1", {
      ...(await db.collection("usuarios").doc("m1").get()).data(),
      tema: "neon-de-2019",
    });

    expect((await (await GET(getReq(cookie))).json()).tema).toBe("escuro");
  });
});

describe("PUT /api/tema", () => {
  it("sem sessão → 401", async () => {
    expect((await PUT(putReq("claro"))).status).toBe(401);
  });

  it("tema fora da lista → 400", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });
    expect((await PUT(putReq("roxo", cookie))).status).toBe(400);
    expect((await PUT(putReq(7, cookie))).status).toBe(400);
  });

  it("grava no doc do usuário e espelha no cookie", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });

    const res = await PUT(putReq("claro", cookie));

    expect(res.status).toBe(200);
    expect(cookieTema(res)).toBe("claro");
    const doc = await db.collection("usuarios").doc("m1").get();
    expect(doc.data()?.tema).toBe("claro");
  });

  it("a escolha é POR USUÁRIO: gravar a de um não mexe na do outro", async () => {
    const c1 = await cookieDeSessao(db, { id: "m1" });
    const c2 = await cookieDeSessao(db, { id: "m2" });

    await PUT(putReq("claro", c1));

    expect((await db.collection("usuarios").doc("m1").get()).data()?.tema).toBe("claro");
    expect((await db.collection("usuarios").doc("m2").get()).data()?.tema).toBeUndefined();
    expect((await (await GET(getReq(c2))).json()).tema).toBe("escuro");
  });

  it("trocar de tema NÃO derruba a sessão nem carimba edição administrativa", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1" });
    const antes = (await db.collection("usuarios").doc("m1").get()).data();

    await PUT(putReq("claro", cookie));

    const depois = (await db.collection("usuarios").doc("m1").get()).data();
    expect(depois?.sessao).toBe(antes?.sessao);
    expect(depois?.atualizadoEm).toBe(antes?.atualizadoEm);
  });
});
