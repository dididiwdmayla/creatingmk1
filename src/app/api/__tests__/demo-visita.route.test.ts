import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SKIN } from "@/lib/demos/registry";
import { registrarVisitaDemo, saveDemo } from "@/lib/leads/repo";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { POST } from "../demo-visita/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/demo-visita", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  db = new FakeFirestore();
  db.seed("leads/A", {
    placeId: "A",
    nome: "Barbearia do Zé",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
  });
});

describe("POST /api/demo-visita", () => {
  it("atualiza duração e scroll da visita", async () => {
    const salvo = await saveDemo(db, "A", {
      skinId: DEFAULT_SKIN.id,
      themeId: DEFAULT_SKIN.themeDefault.id,
      dados: {},
    });
    const token = salvo.demo?.envios?.[0].token as string;
    const { visitaId } = await registrarVisitaDemo(db, "A", { token, interna: false });

    const res = await post({ leadId: "A", visitaId, duracaoSegundos: 30, scrollPercent: 55 });

    expect(res.status).toBe(204);
    expect(db.getDoc("leads/A")?.demoVisitas).toMatchObject([
      { id: visitaId, duracaoSegundos: 30, scrollPercent: 55 },
    ]);
  });

  it("400 para tipos inválidos", async () => {
    const res = await post({ leadId: "A", visitaId: "v1", duracaoSegundos: "muito" });
    expect(res.status).toBe(400);
  });

  it("400 para scrollPercent fora de 0–100", async () => {
    const res = await post({ leadId: "A", visitaId: "v1", scrollPercent: 150 });
    expect(res.status).toBe(400);
  });

  it("lead/visita inexistente responde 204 do mesmo jeito (best-effort)", async () => {
    const res = await post({ leadId: "nao-existe", visitaId: "v1" });
    expect(res.status).toBe(204);
  });
});
