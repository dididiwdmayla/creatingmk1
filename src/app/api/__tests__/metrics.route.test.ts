import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { GET } from "../metrics/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
});

describe("GET /api/metrics", () => {
  it("estado zerado sem leads", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      contatosHoje: 0,
      contatosSemana: 0,
      taxaResposta: 0,
      demosCriadas: 0,
    });
  });

  it("reflete os leads persistidos", async () => {
    db.seed("leads/A", {
      placeId: "A",
      nome: "A",
      status: "respondeu",
      enriquecido: false,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
      contato: {
        primeiroContatoEm: new Date().toISOString(),
        respondeuEm: new Date().toISOString(),
      },
    });

    const res = await GET();

    const data = await res.json();
    expect(data.contatosHoje).toBe(1);
    expect(data.taxaResposta).toBe(1);
  });
});
