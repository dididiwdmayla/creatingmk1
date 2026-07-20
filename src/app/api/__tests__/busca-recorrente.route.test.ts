import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { PATCH } from "../buscas/[id]/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

function patchRequest(id: string, body: unknown) {
  return [
    new Request(`http://localhost/api/buscas/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

function seedBusca(id: string, overrides: Record<string, unknown> = {}): void {
  db.seed(`buscas/${id}`, {
    id,
    nome: `busca ${id}`,
    nicho: "dentista",
    regiao: "Sarandi PR",
    cor: "#2f82e0",
    criadaEm: "2026-07-01T00:00:00.000Z",
    totalCriados: 1,
    totalExistentes: 0,
    ...overrides,
  });
}

beforeEach(() => {
  db = new FakeFirestore();
});

describe("PATCH /api/buscas/[id] — recorrente", () => {
  it("liga e desliga o toggle (false some do doc)", async () => {
    seedBusca("b1");

    const liga = await PATCH(...patchRequest("b1", { recorrente: true }));
    expect(liga.status).toBe(200);
    expect((await liga.json()).busca.recorrente).toBe(true);
    expect(db.getDoc("buscas/b1")?.recorrente).toBe(true);

    const desliga = await PATCH(...patchRequest("b1", { recorrente: false }));
    expect(desliga.status).toBe(200);
    expect(db.getDoc("buscas/b1")?.recorrente).toBeUndefined();
  });

  it("recorrente não-booleano → 400", async () => {
    seedBusca("b1");

    const res = await PATCH(...patchRequest("b1", { recorrente: "sim" }));

    expect(res.status).toBe(400);
  });

  it("teto de recorrentes simultâneas (default 3) recusa ligar a quarta", async () => {
    for (const id of ["b1", "b2", "b3"]) seedBusca(id, { recorrente: true });
    seedBusca("b4");

    const res = await PATCH(...patchRequest("b4", { recorrente: true }));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.problemas[0]).toContain("teto de 3");
    expect(db.getDoc("buscas/b4")?.recorrente).toBeUndefined();
  });

  it("teto configurável em maxBuscasRecorrentes", async () => {
    db.seed("config/app", { maxBuscasRecorrentes: 1 });
    seedBusca("b1", { recorrente: true });
    seedBusca("b2");

    const res = await PATCH(...patchRequest("b2", { recorrente: true }));

    expect(res.status).toBe(400);
  });

  it("re-ligar uma busca JÁ recorrente não conta contra o teto (idempotente)", async () => {
    db.seed("config/app", { maxBuscasRecorrentes: 1 });
    seedBusca("b1", { recorrente: true });

    const res = await PATCH(...patchRequest("b1", { recorrente: true }));

    expect(res.status).toBe(200);
  });

  it("desligar nunca esbarra no teto", async () => {
    db.seed("config/app", { maxBuscasRecorrentes: 0 });
    seedBusca("b1", { recorrente: true });

    const res = await PATCH(...patchRequest("b1", { recorrente: false }));

    expect(res.status).toBe(200);
    expect(db.getDoc("buscas/b1")?.recorrente).toBeUndefined();
  });
});
