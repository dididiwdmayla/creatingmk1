import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET } from "../usuarios/nomes/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(cookie?: string): Request {
  return new Request("http://localhost/api/usuarios/nomes", {
    headers: cookie ? { cookie } : {},
  });
}

describe("GET /api/usuarios/nomes", () => {
  it("sem sessão → 401", async () => {
    expect((await GET(request())).status).toBe(401);
  });

  it("qualquer sessão válida (não só admin) recebe id+nome de todos, sem papel/limites", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", nome: "Ana", papel: "membro" });
    db.seed("usuarios/admin", {
      id: "admin",
      nome: "admin",
      papel: "admin",
      ativo: true,
      sessao: 0,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    const res = await GET(request(cookie));

    expect(res.status).toBe(200);
    const { usuarios } = await res.json();
    expect(usuarios).toEqual(
      expect.arrayContaining([
        { id: "m1", nome: "Ana" },
        { id: "admin", nome: "admin" },
      ]),
    );
    expect(usuarios.every((u: Record<string, unknown>) => !("papel" in u) && !("limites" in u))).toBe(
      true,
    );
  });
});
