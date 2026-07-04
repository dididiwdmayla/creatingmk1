import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { GET } from "../buscas/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
});

describe("GET /api/buscas", () => {
  it("lista vazia sem buscas salvas", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ buscas: [] });
  });

  it("lista as buscas, mais recentes primeiro", async () => {
    db.seed("buscas/b1", {
      id: "b1",
      nome: "dentista 01/07",
      nicho: "dentista",
      regiao: "Sarandi PR",
      criadaEm: "2026-07-01T10:00:00.000Z",
      totalCriados: 5,
      totalExistentes: 0,
    });
    db.seed("buscas/b2", {
      id: "b2",
      nome: "Implantes",
      nicho: "dentista",
      subNicho: "implante",
      regiao: "Maringá PR",
      criadaEm: "2026-07-03T10:00:00.000Z",
      totalCriados: 2,
      totalExistentes: 3,
    });

    const res = await GET();

    const { buscas } = await res.json();
    expect(buscas.map((b: { id: string }) => b.id)).toEqual(["b2", "b1"]);
    expect(buscas[0]).toMatchObject({
      nome: "Implantes",
      subNicho: "implante",
      totalCriados: 2,
      totalExistentes: 3,
    });
  });

  it("docs antigos sem cor ganham cor de fallback na leitura", async () => {
    db.seed("buscas/b1", {
      id: "b1",
      nome: "antiga",
      nicho: "dentista",
      regiao: "Sarandi PR",
      criadaEm: "2026-07-01T10:00:00.000Z",
      totalCriados: 1,
      totalExistentes: 0,
    });

    const { buscas } = await (await GET()).json();

    expect(buscas[0].cor).toMatch(/^#/);
  });
});
