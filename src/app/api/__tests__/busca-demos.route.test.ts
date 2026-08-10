import { beforeEach, describe, expect, it, vi } from "vitest";

import { salvarImagemDemo } from "@/lib/demos/imagens";
import { DEFAULT_SKIN } from "@/lib/demos/registry";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { FakeDemoStorage } from "@/lib/testing/fake-storage";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { DELETE } from "../buscas/[id]/demos/route";

let db: FakeFirestore;
let storage: FakeDemoStorage;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));
vi.mock("@/lib/firebase/storage", () => ({ getDemoStorage: () => storage }));

const DEMO = { skinId: DEFAULT_SKIN.id, themeId: DEFAULT_SKIN.themeDefault.id, dados: {} };

function seedLead(id: string, overrides: Record<string, unknown> = {}) {
  db.seed(`leads/${id}`, {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-08-01T00:00:00.000Z",
    atualizadoEm: "2026-08-01T00:00:00.000Z",
    ...overrides,
  });
}

beforeEach(() => {
  db = new FakeFirestore();
  storage = new FakeDemoStorage();
  db.seed("buscas/b1", {
    id: "b1",
    nome: "barbearia 01/08",
    nicho: "barbearia",
    regiao: "Sarandi PR",
    cor: "#2f82e0",
    criadaEm: "2026-08-01T10:00:00.000Z",
    totalCriados: 3,
    totalExistentes: 0,
  });
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

function del(id: string, cookie?: string): Promise<Response> {
  return DELETE(
    new Request(`http://localhost/api/buscas/${id}/demos`, {
      method: "DELETE",
      ...(cookie && { headers: { cookie } }),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("DELETE /api/buscas/[id]/demos", () => {
  it("sem sessão → 401, nenhum lead tocado", async () => {
    seedLead("L1", { buscaId: ["b1"], demo: { ...DEMO, criadoEm: "x", atualizadoEm: "x" } });

    const res = await del("b1");

    expect(res.status).toBe(401);
    expect(db.getDoc("leads/L1")?.demo).toBeTruthy();
  });

  it("membro (não-admin) → 403, nenhum lead tocado — recusa no SERVIDOR, não só na tela", async () => {
    seedLead("L1", { buscaId: ["b1"], demo: { ...DEMO, criadoEm: "x", atualizadoEm: "x" } });
    const cookie = await cookieDeSessao(db, { id: "ana", papel: "membro" });

    const res = await del("b1", cookie);

    expect(res.status).toBe(403);
    expect(db.getDoc("leads/L1")?.demo).toBeTruthy();
  });

  it("admin: apaga a demo de TODOS os leads do grupo com demo salva, e só desses", async () => {
    seedLead("L1", { buscaId: ["b1"], demo: { ...DEMO, criadoEm: "x", atualizadoEm: "x" } });
    seedLead("L2", { buscaId: ["b1"], demo: { ...DEMO, criadoEm: "x", atualizadoEm: "x" } });
    seedLead("L3", { buscaId: ["b1"] }); // sem demo — não conta na exclusão
    seedLead("L4", { buscaId: ["b2"], demo: { ...DEMO, criadoEm: "x", atualizadoEm: "x" } }); // outro grupo
    const cookie = await cookieDeSessao(db, { id: "chefe", papel: "admin" });

    const res = await del("b1", cookie);

    expect(res.status).toBe(200);
    const { apagadas, busca } = await res.json();
    expect(apagadas).toBe(2);
    expect(busca).toBe("barbearia 01/08");

    expect(db.getDoc("leads/L1")?.demo).toBeUndefined();
    expect(db.getDoc("leads/L2")?.demo).toBeUndefined();
    // Lead de outro grupo é intocado.
    expect(db.getDoc("leads/L4")?.demo).toBeTruthy();
  });

  it("apaga também as imagens de cada lead do grupo, sem tocar nas de outros leads", async () => {
    seedLead("L1", { buscaId: ["b1"], demo: { ...DEMO, criadoEm: "x", atualizadoEm: "x" } });
    seedLead("L2", { buscaId: ["b1"], demo: { ...DEMO, criadoEm: "x", atualizadoEm: "x" } });
    seedLead("L4", { buscaId: ["b2"], demo: { ...DEMO, criadoEm: "x", atualizadoEm: "x" } });
    await salvarImagemDemo(storage, "L1", "hero", new Uint8Array([1]), "image/webp");
    await salvarImagemDemo(storage, "L2", "hero", new Uint8Array([1]), "image/webp");
    await salvarImagemDemo(storage, "L4", "hero", new Uint8Array([1]), "image/webp");
    const cookie = await cookieDeSessao(db, { id: "chefe", papel: "admin" });

    await del("b1", cookie);

    expect(storage.paths()).toHaveLength(1);
    expect(storage.paths()[0]).toContain("demos/L4/");
  });

  it("não apaga o lead, não mexe em status, e não remove demoVisitas de nenhum lead do grupo", async () => {
    seedLead("L1", {
      buscaId: ["b1"],
      status: "contactado",
      demo: { ...DEMO, criadoEm: "x", atualizadoEm: "x" },
      contato: { primeiroContatoEm: "2026-08-01T12:00:00.000Z", primeiroContatoPor: "ana" },
      demoVisitas: [
        { id: "v1", em: "2026-08-02T09:00:00.000Z", interna: false, canal: "whatsapp", envioEm: "2026-08-01T00:00:00.000Z" },
      ],
    });
    const cookie = await cookieDeSessao(db, { id: "chefe", papel: "admin" });

    const res = await del("b1", cookie);
    expect(res.status).toBe(200);

    const lead = db.getDoc("leads/L1");
    expect(lead).toBeTruthy();
    expect(lead?.status).toBe("contactado");
    expect(lead?.contato).toEqual({
      primeiroContatoEm: "2026-08-01T12:00:00.000Z",
      primeiroContatoPor: "ana",
    });
    expect(lead?.demoVisitas).toEqual([
      { id: "v1", em: "2026-08-02T09:00:00.000Z", interna: false, canal: "whatsapp", envioEm: "2026-08-01T00:00:00.000Z" },
    ]);
    expect(lead?.demo).toBeUndefined();
  });

  it("grupo sem nenhuma demo → 200 idempotente com apagadas: 0", async () => {
    seedLead("L1", { buscaId: ["b1"] });
    const cookie = await cookieDeSessao(db, { id: "chefe", papel: "admin" });

    const res = await del("b1", cookie);

    expect(res.status).toBe(200);
    expect((await res.json()).apagadas).toBe(0);
  });

  it("busca inexistente → 404", async () => {
    const cookie = await cookieDeSessao(db, { id: "chefe", papel: "admin" });

    const res = await del("b-fantasma", cookie);

    expect(res.status).toBe(404);
  });
});
