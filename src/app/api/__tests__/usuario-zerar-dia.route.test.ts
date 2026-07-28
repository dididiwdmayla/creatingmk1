import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saoPauloDateKey } from "@/lib/costs";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { POST } from "../usuarios/[id]/zerar-dia/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function zerar(id: string, cookie?: string): Promise<Response> {
  return POST(
    new Request(`http://localhost/api/usuarios/${id}/zerar-dia`, {
      method: "POST",
      ...(cookie && { headers: { cookie } }),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("POST /api/usuarios/[id]/zerar-dia", () => {
  it("admin zera o dia corrente do usuário, preservando outros dias", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    db.seed("usuarios/m1", {
      id: "m1",
      nome: "Ana",
      papel: "membro",
      ativo: true,
      sessao: 0,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });
    const hoje = saoPauloDateKey(new Date());
    db.seed(`usage_users/m1/dias/${hoje}`, { buscas: 9, enriquecimentos: 4 });
    db.seed("usage_users/m1/dias/2026-01-01", { buscas: 2 });

    const res = await zerar("m1", cookie);

    expect(res.status).toBe(204);
    expect(db.getDoc(`usage_users/m1/dias/${hoje}`)).toMatchObject({
      buscas: 0,
      enriquecimentos: 0,
    });
    expect(db.getDoc("usage_users/m1/dias/2026-01-01")).toEqual({ buscas: 2 });
  });

  it("membro → 403; sem sessão → 401", async () => {
    const cookie = await cookieDeSessao(db, { id: "m1", papel: "membro" });

    expect((await zerar("m1", cookie)).status).toBe(403);
    expect((await zerar("m1")).status).toBe(401);
  });

  it("usuário inexistente → 404", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await zerar("nope", cookie);

    expect(res.status).toBe(404);
  });
});
