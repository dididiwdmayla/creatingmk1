import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { POST as REGISTRAR_CONTATO } from "../leads/[id]/contato/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
  db.seed("leads/A", {
    placeId: "A",
    nome: "Lead A",
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function params(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function postRequest(id: string, cookie?: string): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost/api/leads/${id}/contato`, {
      method: "POST",
      ...(cookie && { headers: { cookie } }),
    }),
    params(id),
  ];
}

describe("POST /api/leads/[id]/contato — selo de contato (item 1)", () => {
  it("sem sessão → 401", async () => {
    const res = await REGISTRAR_CONTATO(...postRequest("A"));
    expect(res.status).toBe(401);
  });

  it("registra o selo com quem clicou e o timestamp, sem mexer no status", async () => {
    const cookie = await cookieDeSessao(db, { id: "ana", papel: "membro" });

    const res = await REGISTRAR_CONTATO(...postRequest("A", cookie));

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.seloContato).toMatchObject({ userId: "ana" });
    expect(lead.seloContato.em).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(lead.status).toBe("novo");
  });

  it("primeiro clique prevalece: segundo clique (de outro usuário) não sobrescreve", async () => {
    const cookieAna = await cookieDeSessao(db, { id: "ana", papel: "membro" });
    const primeiro = await (await REGISTRAR_CONTATO(...postRequest("A", cookieAna))).json();

    const cookieBeto = await cookieDeSessao(db, { id: "beto", papel: "membro" });
    const segundo = await (await REGISTRAR_CONTATO(...postRequest("A", cookieBeto))).json();

    expect(segundo.lead.seloContato).toEqual(primeiro.lead.seloContato);
    expect(segundo.lead.seloContato.userId).toBe("ana");
  });

  it("lead inexistente → 404", async () => {
    const cookie = await cookieDeSessao(db, { id: "ana", papel: "membro" });
    const res = await REGISTRAR_CONTATO(...postRequest("X", cookie));
    expect(res.status).toBe(404);
  });
});
