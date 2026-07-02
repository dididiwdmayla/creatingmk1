import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { GET as LIST } from "../leads/route";
import { GET as GET_ONE, PATCH } from "../leads/[id]/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

function seedLead(id: string, data: Record<string, unknown>): void {
  db.seed(`leads/${id}`, {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
    ...data,
  });
}

beforeEach(() => {
  db = new FakeFirestore();
  seedLead("A", { criadoEm: "2026-07-01T10:00:00.000Z" });
  seedLead("B", {
    status: "contactado",
    enriquecido: true,
    criadoEm: "2026-07-02T10:00:00.000Z",
    detalhes: {
      site: "https://b.com",
      telefone: "(44) 1111-1111",
      enriquecidoEm: "2026-07-02T11:00:00.000Z",
    },
    contato: { primeiroContatoEm: "2026-07-02T12:00:00.000Z" },
  });
  seedLead("C", {
    enriquecido: true,
    criadoEm: "2026-07-03T10:00:00.000Z",
    detalhes: {
      telefone: "(44) 2222-2222",
      enriquecidoEm: "2026-07-03T11:00:00.000Z",
    },
  });
});

function list(query = ""): Promise<Response> {
  return LIST(new Request(`http://localhost/api/leads${query}`));
}

async function leadIds(res: Response): Promise<string[]> {
  const { leads } = await res.json();
  return (leads as Array<{ placeId: string }>).map((l) => l.placeId);
}

describe("GET /api/leads", () => {
  it("lista todos, mais recentes primeiro", async () => {
    const res = await list();

    expect(res.status).toBe(200);
    expect(await leadIds(res)).toEqual(["C", "B", "A"]);
  });

  it("filtra por status", async () => {
    expect(await leadIds(await list("?status=novo"))).toEqual(["C", "A"]);
    expect(await leadIds(await list("?status=contactado"))).toEqual(["B"]);
  });

  it("temSite=sem só considera leads enriquecidos (lead quente)", async () => {
    expect(await leadIds(await list("?temSite=sem"))).toEqual(["C"]);
  });

  it("temSite=com", async () => {
    expect(await leadIds(await list("?temSite=com"))).toEqual(["B"]);
  });

  it("combina filtros", async () => {
    expect(
      await leadIds(await list("?status=novo&temTelefone=com")),
    ).toEqual(["C"]);
  });

  it("status inválido → 400", async () => {
    const res = await list("?status=perdido");

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("validation_error");
  });

  it("temSite inválido → 400", async () => {
    expect((await list("?temSite=sim")).status).toBe(400);
  });
});

function params(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function patchRequest(id: string, body: unknown): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost/api/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    params(id),
  ];
}

describe("GET /api/leads/[id]", () => {
  it("retorna a ficha do lead", async () => {
    const res = await GET_ONE(new Request("http://localhost/api/leads/B"), params("B"));

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.placeId).toBe("B");
    expect(lead.detalhes.site).toBe("https://b.com");
  });

  it("lead inexistente → 404 not_found", async () => {
    const res = await GET_ONE(new Request("http://localhost/api/leads/X"), params("X"));

    expect(res.status).toBe(404);
    const { error } = await res.json();
    expect(error.code).toBe("not_found");
  });
});

describe("PATCH /api/leads/[id]", () => {
  it("novo → contactado carimba contato.primeiroContatoEm", async () => {
    const res = await PATCH(...patchRequest("A", { status: "contactado" }));

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.status).toBe("contactado");
    expect(lead.contato.primeiroContatoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(db.getDoc("leads/A")).toMatchObject({ status: "contactado" });
  });

  it("cadeia completa carimba respondeuEm e fechadoEm", async () => {
    await PATCH(...patchRequest("A", { status: "contactado" }));
    await PATCH(...patchRequest("A", { status: "respondeu" }));
    const res = await PATCH(...patchRequest("A", { status: "fechado" }));

    const { lead } = await res.json();
    expect(lead.contato.primeiroContatoEm).toBeDefined();
    expect(lead.contato.respondeuEm).toBeDefined();
    expect(lead.contato.fechadoEm).toBeDefined();
  });

  it("contactado → fechado direto é válido (não respondeu)", async () => {
    const res = await PATCH(...patchRequest("B", { status: "fechado" }));

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.contato.respondeuEm).toBeUndefined();
    expect(lead.contato.fechadoEm).toBeDefined();
  });

  it("pular etapa (novo → respondeu) → 409 invalid_transition", async () => {
    const res = await PATCH(...patchRequest("A", { status: "respondeu" }));

    expect(res.status).toBe(409);
    const { error } = await res.json();
    expect(error).toMatchObject({
      code: "invalid_transition",
      de: "novo",
      para: "respondeu",
    });
    expect(db.getDoc("leads/A")).toMatchObject({ status: "novo" });
  });

  it("voltar status (contactado → novo)? não existe: status fora do enum de destino → 409", async () => {
    const res = await PATCH(...patchRequest("B", { status: "novo" }));

    expect(res.status).toBe(409);
  });

  it("status desconhecido → 400", async () => {
    const res = await PATCH(...patchRequest("A", { status: "perdido" }));

    expect(res.status).toBe(400);
  });

  it("lead inexistente → 404", async () => {
    const res = await PATCH(...patchRequest("X", { status: "contactado" }));

    expect(res.status).toBe(404);
  });

  it("não sobrescreve primeiroContatoEm em novo contato após fechar/reabrir ciclo", async () => {
    await PATCH(...patchRequest("A", { status: "contactado" }));
    const first = (db.getDoc("leads/A")?.contato as Record<string, string>)
      .primeiroContatoEm;

    await PATCH(...patchRequest("A", { status: "respondeu" }));

    const after = (db.getDoc("leads/A")?.contato as Record<string, string>)
      .primeiroContatoEm;
    expect(after).toBe(first);
  });
});
