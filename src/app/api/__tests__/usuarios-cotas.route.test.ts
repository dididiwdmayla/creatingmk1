import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saoPauloDateKey } from "@/lib/costs";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET } from "../usuarios/cotas/route";

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
  return new Request("http://localhost/api/usuarios/cotas", {
    ...(cookie && { headers: { cookie } }),
  });
}

describe("GET /api/usuarios/cotas", () => {
  it("membro → 403; sem sessão → 401", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    expect((await GET(request(cookie))).status).toBe(403);
    expect((await GET(request())).status).toBe(401);
  });

  it("admin recebe uso × limite de cada usuário", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    db.seed("usuarios/m1", {
      id: "m1",
      nome: "Ana",
      papel: "membro",
      ativo: true,
      sessao: 0,
      limites: { buscasDia: 10 },
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });
    const hoje = saoPauloDateKey(new Date());
    db.seed(`usage_users/m1/${hoje}`, { buscas: 3, enriquecimentos: 1 });

    const res = await GET(request(cookie));

    expect(res.status).toBe(200);
    const { usuarios } = await res.json();
    const ana = usuarios.find((u: { id: string }) => u.id === "m1");
    expect(ana).toMatchObject({
      nome: "Ana",
      ativo: true,
      limites: { buscasDia: 10 },
    });
    expect(ana.buscas.dia).toMatchObject({ usado: 3, limite: 10 });
    expect(ana.enriquecimentos.dia.usado).toBe(1);
    expect(ana.enriquecimentos.dia.limite).toBeUndefined();
  });
});
