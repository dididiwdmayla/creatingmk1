import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saoPauloDateKey } from "@/lib/costs";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET } from "../usuarios/metas/route";

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
  return new Request("http://localhost/api/usuarios/metas", {
    ...(cookie && { headers: { cookie } }),
  });
}

describe("GET /api/usuarios/metas", () => {
  it("membro → 403; sem sessão → 401", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    expect((await GET(request(cookie))).status).toBe(403);
    expect((await GET(request())).status).toBe(401);
  });

  it("admin recebe meta × progresso de cada usuário (prospecção = contador `buscas`)", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
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

    const res = await GET(request(cookie));

    expect(res.status).toBe(200);
    const { usuarios } = await res.json();
    const ana = usuarios.find((u: { id: string }) => u.id === "m1");
    expect(ana).toMatchObject({ nome: "Ana", ativo: true, metas: { prospeccoesDia: 5 } });
    // Prospecção usa o contador `buscas`, não `enriquecimentos`.
    expect(ana.prospeccao.dia).toEqual({ usado: 3, meta: 5 });
    expect(ana.prospeccao.semana).toEqual({ usado: 3, meta: undefined });
  });

  it("usuário sem meta configurada: `usado` presente, `meta` ausente nas duas janelas", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    db.seed("usuarios/m1", {
      id: "m1",
      nome: "Bia",
      papel: "membro",
      ativo: true,
      sessao: 0,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    const res = await GET(request(cookie));

    const { usuarios } = await res.json();
    const bia = usuarios.find((u: { id: string }) => u.id === "m1");
    expect(bia.metas).toEqual({});
    expect(bia.prospeccao.dia).toEqual({ usado: 0, meta: undefined });
    expect(bia.prospeccao.semana).toEqual({ usado: 0, meta: undefined });
  });
});
