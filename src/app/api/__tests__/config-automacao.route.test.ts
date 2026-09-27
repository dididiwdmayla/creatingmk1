import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_AUTOMACAO_CONFIG } from "@/lib/automacao/config";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET, PUT } from "../config/automacao/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function req(method: "GET" | "PUT", cookie?: string, body?: unknown): Request {
  return new Request("http://localhost/api/config/automacao", {
    method,
    headers: { "Content-Type": "application/json", ...(cookie && { cookie }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

describe("/api/config/automacao", () => {
  it("defaults: desligada, alvo 15, aprovação automática desligada, IA ligada, corte 2026-08-10", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    const res = await GET(req("GET", cookie));
    expect(res.status).toBe(200);
    const { automacao } = await res.json();
    expect(automacao).toEqual(DEFAULT_AUTOMACAO_CONFIG);
    expect(automacao).toMatchObject({
      ativo: false,
      alvoEstoque: 15,
      aprovacaoAutomatica: false,
      textoIA: true,
      corteLegado: "2026-08-10",
    });
  });

  it("o alvo é editável e persiste", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    const res = await PUT(req("PUT", cookie, { alvoEstoque: 22, ativo: true }));
    expect(res.status).toBe(200);
    const { automacao } = await (await GET(req("GET", cookie))).json();
    expect(automacao.alvoEstoque).toBe(22);
    expect(automacao.ativo).toBe(true);
  });

  it("valida: chave desconhecida, inteiro negativo e data malformada são 400", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    for (const corpo of [{ foo: 1 }, { alvoEstoque: -1 }, { corteLegado: "10/08/2026" }]) {
      const res = await PUT(req("PUT", cookie, corpo));
      expect(res.status).toBe(400);
    }
  });

  it("membro → 403; sem sessão → 401", async () => {
    const membro = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    expect((await GET(req("GET", membro))).status).toBe(403);
    expect((await PUT(req("PUT", undefined, { ativo: true }))).status).toBe(401);
  });
});
