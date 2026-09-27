import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { POST as DISPARAR } from "../config/automacao/disparar/route";
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

describe("autoria distinguível", () => {
  it("/api/usuarios/nomes resolve o id da automação como 'Automação'", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    const { usuarios } = await (
      await NOMES(new Request("http://localhost/api/usuarios/nomes", { headers: { cookie } }))
    ).json();
    expect(usuarios).toContainEqual({ id: "automacao", nome: "Automação" });
  });
});
