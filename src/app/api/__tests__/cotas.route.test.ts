import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saoPauloDateKey } from "@/lib/costs";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET } from "../cotas/route";

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
  return new Request("http://localhost/api/cotas", {
    ...(cookie && { headers: { cookie } }),
  });
}

describe("GET /api/cotas", () => {
  it("sem sessão → 401", async () => {
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it("membro recebe o próprio uso × limite", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });
    db.seed("usuarios/m1", {
      id: "m1",
      nome: "Ana",
      papel: "membro",
      ativo: true,
      sessao: 0,
      limites: { buscasDia: 5, enriquecimentosDia: 3 },
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });
    const hoje = saoPauloDateKey(new Date());
    db.seed(`usage_users/m1/dias/${hoje}`, { buscas: 2, enriquecimentos: 1 });

    const res = await GET(request(cookie));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.buscas.dia).toMatchObject({ usado: 2, limite: 5 });
    expect(data.enriquecimentos.dia).toMatchObject({ usado: 1, limite: 3 });
    expect(typeof data.buscas.dia.resetaEm).toBe("string");
  });

  it("admin nunca tem limite aplicado, mesmo com limites configurados no doc", async () => {
    const cookie = await cookieDeSessao(db, { id: "chefe", papel: "admin" });
    db.seed("usuarios/chefe", {
      id: "chefe",
      nome: "chefe",
      papel: "admin",
      ativo: true,
      sessao: 0,
      limites: { buscasDia: 1 },
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });

    const res = await GET(request(cookie));

    const data = await res.json();
    expect(data.buscas.dia.limite).toBeUndefined();
  });

  it("membro legado (criado antes da feature): sem `limites`, sem nenhum doc em usage_users → 200 com tudo zero", async () => {
    const cookie = await cookieDeSessao(db, { id: "legado-1", papel: "membro" });
    // Doc mínimo, exatamente como um usuário real criado antes desta
    // feature existir: sem `limites`, sem `ultimaVisitaEm`, sem NENHUM
    // doc em usage_users.
    db.seed("usuarios/legado-1", {
      id: "legado-1",
      nome: "Legado",
      papel: "membro",
      ativo: true,
      sessao: 0,
      criadoEm: "2025-01-01T00:00:00.000Z",
      atualizadoEm: "2025-01-01T00:00:00.000Z",
    });

    const res = await GET(request(cookie));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.buscas.dia.usado).toBe(0);
    expect(data.buscas.dia.limite).toBeUndefined();
    expect(data.buscas.semana.usado).toBe(0);
    expect(data.buscas.semana.limite).toBeUndefined();
    expect(data.enriquecimentos.mes.usado).toBe(0);
    expect(data.enriquecimentos.mes.limite).toBeUndefined();
  });
});
