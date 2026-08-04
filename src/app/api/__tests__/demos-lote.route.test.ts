import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { POST } from "../demos/lote/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

function seedLead(placeId: string, extra: Record<string, unknown> = {}) {
  db.seed(`leads/${placeId}`, {
    placeId,
    nome: `Lead ${placeId}`,
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
    ...extra,
  });
}

beforeEach(() => {
  db = new FakeFirestore();
  seedLead("ChIJ001");
  seedLead("ChIJ002");
  seedLead("ChIJ003");
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function lote(body: Record<string, unknown>, cookie?: string): Promise<Response> {
  return POST(
    new Request("http://localhost/api/demos/lote", {
      method: "POST",
      body: JSON.stringify(body),
      ...(cookie && { headers: { cookie } }),
    }),
  );
}

const BODY_BASE = {
  leadIds: ["ChIJ001", "ChIJ002", "ChIJ003"],
  skinId: "barbearia-editorial",
  themeId: "meia-noite",
  imagensModo: "foto",
};

describe("POST /api/demos/lote", () => {
  it("cria a demo de todos os leads — grátis, sem tocar nenhum contador de uso", async () => {
    const res = await lote(BODY_BASE);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proximoCursor).toBeNull();
    expect(body.resultados).toEqual([
      { leadId: "ChIJ001", status: "ok" },
      { leadId: "ChIJ002", status: "ok" },
      { leadId: "ChIJ003", status: "ok" },
    ]);

    for (const id of BODY_BASE.leadIds) {
      const lead = db.getDoc(`leads/${id}`) as Record<string, unknown>;
      expect(lead.demo).toMatchObject({
        skinId: "barbearia-editorial",
        themeId: "meia-noite",
        dados: { imagensModo: "foto" },
      });
    }

    expect(db.getDoc(`usage/${new Date().toISOString().slice(0, 7)}`)).toBeUndefined();
  });

  it("grava o efeito de fundo quando informado em tema.fundoEfeito", async () => {
    const res = await lote({ ...BODY_BASE, tema: { fundoEfeito: "aura" } });

    expect(res.status).toBe(200);
    const lead = db.getDoc("leads/ChIJ001") as Record<string, unknown>;
    expect(lead.demo).toMatchObject({ tema: { fundoEfeito: "aura" } });
  });

  it("falha em um lead (id inexistente) não interrompe os demais", async () => {
    const res = await lote({ ...BODY_BASE, leadIds: ["ChIJ001", "ChIJ-fantasma", "ChIJ003"] });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resultados).toEqual([
      { leadId: "ChIJ001", status: "ok" },
      { leadId: "ChIJ-fantasma", status: "erro", erro: expect.stringContaining("ChIJ-fantasma") },
      { leadId: "ChIJ003", status: "ok" },
    ]);
    expect((db.getDoc("leads/ChIJ001") as Record<string, unknown>).demo).toBeDefined();
    expect((db.getDoc("leads/ChIJ003") as Record<string, unknown>).demo).toBeDefined();
  });

  it("retoma a partir de cursor, sem reprocessar os já feitos", async () => {
    const res = await lote({ ...BODY_BASE, cursor: 2 });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resultados).toEqual([{ leadId: "ChIJ003", status: "ok" }]);
    expect((db.getDoc("leads/ChIJ001") as Record<string, unknown>).demo).toBeUndefined();
    expect((db.getDoc("leads/ChIJ003") as Record<string, unknown>).demo).toBeDefined();
  });

  it("com sessão, criadoPor é o usuário logado", async () => {
    const cookie = await cookieDeSessao(db, { id: "ana", papel: "membro" });

    const res = await lote(BODY_BASE, cookie);

    expect(res.status).toBe(200);
    const lead = db.getDoc("leads/ChIJ001") as Record<string, unknown>;
    expect((lead.demo as Record<string, unknown>).criadoPor).toBe("ana");
  });

  it("leadIds vazio → 400 sem gravar nada", async () => {
    const res = await lote({ ...BODY_BASE, leadIds: [] });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_error");
    expect((db.getDoc("leads/ChIJ001") as Record<string, unknown>).demo).toBeUndefined();
  });

  it("skinId desconhecida → 400", async () => {
    const res = await lote({ ...BODY_BASE, skinId: "skin-fantasma" });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_error");
  });

  it("themeId fora dos presets da skin → 400", async () => {
    const res = await lote({ ...BODY_BASE, themeId: "preset-fantasma" });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_error");
  });

  it("imagensModo ausente/inválido → 400", async () => {
    const res = await lote({ ...BODY_BASE, imagensModo: "hd" });

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe("validation_error");
    expect(error.problemas.join(" ")).toContain("imagensModo");
  });

  it("tema com chave além de fundoEfeito → 400 (diálogo de lote só oferece as quatro opções)", async () => {
    const res = await lote({ ...BODY_BASE, tema: { fundoEfeito: "aura", destaque: "#ff0000" } });

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.problemas.join(" ")).toContain("destaque");
  });

  it("mais de 300 leadIds → 400", async () => {
    const muitos = Array.from({ length: 301 }, (_, i) => `ChIJ${i}`);
    const res = await lote({ ...BODY_BASE, leadIds: muitos });

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("validation_error");
  });
});
