import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET as CONFIG_GET, PUT as CONFIG_PUT } from "../config/automacao/route";
import { POST as DISPARAR } from "../config/automacao/disparar/route";
import { GET as PAINEL } from "../config/automacao/painel/route";
import { GET as NOMES } from "../usuarios/nomes/route";

let db: FakeFirestore;
vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const fetchMock = vi.fn();

beforeEach(() => {
  db = new FakeFirestore();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.stubEnv("GITHUB_CAPTURAS_TOKEN", "token-gh");
  vi.stubEnv("GITHUB_CAPTURAS_REPO", "dono/radar");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function disparar(cookie?: string) {
  return DISPARAR(
    new Request("http://localhost/api/config/automacao/disparar", {
      method: "POST",
      headers: { ...(cookie && { cookie }) },
    }),
  );
}

describe("POST /api/config/automacao/disparar — o 'rodar agora'", () => {
  it("admin: repository_dispatch com o tipo novo, pelo mesmo módulo das capturas", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    const res = await disparar(cookie);
    expect(res.status).toBe(202);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/dono/radar/dispatches");
    expect(JSON.parse(String(init.body))).toEqual({
      event_type: "automacao-estoque",
      client_payload: { pedidoPor: "admin" },
    });
  });

  it("membro → 403; sem sessão → 401; sem token → 503", async () => {
    const membro = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    expect((await disparar(membro)).status).toBe(403);
    expect((await disparar()).status).toBe(401);
    vi.stubEnv("GITHUB_CAPTURAS_TOKEN", "");
    const admin = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    expect((await disparar(admin)).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("'rodar agora' com execução ativa", () => {
  const AGORA = new Date("2026-09-20T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AGORA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("trava viva → 409 com a execução ativa, e o GitHub nem é chamado", async () => {
    db.seed("automacao/trava", { execucaoId: "ex-viva", expiraEm: "2026-09-20T12:10:00.000Z" });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    const res = await disparar(cookie);
    expect(res.status).toBe(409);
    const corpo = await res.json();
    expect(corpo.error.ativa).toMatchObject({ tipo: "execucao", execucaoId: "ex-viva" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dois cliques seguidos: o segundo é recusado enquanto o pedido não vira execução", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    expect((await disparar(cookie)).status).toBe(202);
    const segundo = await disparar(cookie);
    expect(segundo.status).toBe(409);
    expect((await segundo.json()).error.ativa).toMatchObject({ tipo: "disparo", por: "admin" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aceita de novo depois que a execução pedida começou e terminou", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    expect((await disparar(cookie)).status).toBe(202);
    // planejar → trava; finalizar → trava liberada e ponteiro andou.
    vi.setSystemTime(new Date("2026-09-20T12:05:00Z"));
    db.seed("automacao/trava", { execucaoId: "", expiraEm: "2026-09-20T12:04:00.000Z" });
    db.seed("automacao/ultima", { execucaoId: "ex1", estado: "concluida", em: "2026-09-20T12:04:00.000Z" });
    expect((await disparar(cookie)).status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("GitHub recusou → o pedido é desfeito e o botão não fica preso", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad creds", { status: 401 }));
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    expect((await disparar(cookie)).status).toBe(502);
    expect((await disparar(cookie)).status).toBe(202);
  });
});

describe("rotas de config da automação — sessão de admin, nunca o segredo do laço", () => {
  const ROTAS: Array<[string, (r: Request) => Promise<Response>, string]> = [
    ["GET /painel", (r) => PAINEL(r), "http://localhost/api/config/automacao/painel"],
    ["GET /config", (r) => CONFIG_GET(r), "http://localhost/api/config/automacao"],
    ["POST /disparar", (r) => DISPARAR(r), "http://localhost/api/config/automacao/disparar"],
  ];

  it("membro → 403 em todas", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    for (const [nome, rota, url] of ROTAS) {
      const res = await rota(new Request(url, { method: nome.split(" ")[0], headers: { cookie } }));
      expect(res.status, nome).toBe(403);
    }
    const put = await CONFIG_PUT(
      new Request("http://localhost/api/config/automacao", {
        method: "PUT",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ ativo: true }),
      }),
    );
    expect(put.status).toBe(403);
  });

  it("sem sessão → 401; o Bearer da AUTOMACAO_SECRET não abre painel nenhum", async () => {
    vi.stubEnv("AUTOMACAO_SECRET", "segredo-do-laco");
    for (const [nome, rota, url] of ROTAS) {
      const metodo = nome.split(" ")[0];
      expect((await rota(new Request(url, { method: metodo }))).status, nome).toBe(401);
      const comSegredo = await rota(
        new Request(url, { method: metodo, headers: { authorization: "Bearer segredo-do-laco" } }),
      );
      expect(comSegredo.status, `${nome} com o segredo`).toBe(401);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("admin → 200 no painel", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    const res = await PAINEL(new Request("http://localhost/api/config/automacao/painel", { headers: { cookie } }));
    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.config.ativo).toBe(false);
    expect(corpo.disparoDisponivel).toBe(true);
    expect(corpo.ativa).toBeNull();
  });
});

describe("autoria distinguível", () => {
  it("/api/usuarios/nomes resolve o id da automação como 'Automação'", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    const { usuarios } = await (
      await NOMES(new Request("http://localhost/api/usuarios/nomes", { headers: { cookie } }))
    ).json();
    expect(usuarios).toContainEqual({ id: "automacao", nome: "Automação" });
  });
});
