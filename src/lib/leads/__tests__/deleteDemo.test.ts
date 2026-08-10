import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { deleteDemo, getLead, saveDemo } from "../repo";

/**
 * Apagar a demo de um lead (individual, DELETE /api/leads/[id]/demo, ou em
 * lote, DELETE /api/buscas/[id]/demos) só apaga o campo `demo` — nunca o
 * lead em si, o `status`, o histórico de contato ou o histórico de
 * envio/visita (`demoVisitas`, que vive fora de `demo`). Ver "Apagar todas
 * do grupo" em /demos.
 */
describe("deleteDemo — o que sobrevive", () => {
  const DEMO_INPUT = { skinId: "barbearia-editorial", themeId: "meia-noite", dados: {} };

  function seedLeadComHistorico(db: FakeFirestore) {
    db.seed("leads/A", {
      placeId: "A",
      nome: "Barbearia do Zé",
      status: "contactado",
      buscaId: ["b1"],
      enriquecido: false,
      contato: { primeiroContatoEm: "2026-08-01T12:00:00.000Z", primeiroContatoPor: "ana" },
      seloContato: { userId: "ana", em: "2026-08-01T12:00:00.000Z" },
      demoVisitas: [
        { id: "v1", em: "2026-08-02T09:00:00.000Z", interna: false, envioEm: "2026-08-01T00:00:00.000Z", canal: "whatsapp" },
      ],
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-08-02T09:00:00.000Z",
    });
  }

  it("apaga só o campo demo — lead, status, contato e demoVisitas continuam intactos", async () => {
    const db = new FakeFirestore();
    seedLeadComHistorico(db);
    await saveDemo(db, "A", DEMO_INPUT);
    // envios foram gerados pelo próprio saveDemo — confirma que existiam antes de apagar.
    const antes = await getLead(db, "A");
    expect(antes?.demo?.envios?.length).toBeGreaterThan(0);

    const depois = await deleteDemo(db, "A");

    expect(depois.demo).toBeUndefined();
    // O LEAD continua existindo (não é um DELETE de doc).
    const relido = await getLead(db, "A");
    expect(relido).toBeTruthy();
    expect(relido?.placeId).toBe("A");
    // status intacto — apagar demo não mexe na transição do lead.
    expect(relido?.status).toBe("contactado");
    // histórico de contato intacto.
    expect(relido?.contato).toEqual({
      primeiroContatoEm: "2026-08-01T12:00:00.000Z",
      primeiroContatoPor: "ana",
    });
    expect(relido?.seloContato).toEqual({ userId: "ana", em: "2026-08-01T12:00:00.000Z" });
    // registros de envio/visita (Lead.demoVisitas, fora de `demo`) intactos.
    expect(relido?.demoVisitas).toEqual([
      {
        id: "v1",
        em: "2026-08-02T09:00:00.000Z",
        interna: false,
        envioEm: "2026-08-01T00:00:00.000Z",
        canal: "whatsapp",
      },
    ]);
    // agrupamento por busca também sobrevive.
    expect(relido?.buscaId).toEqual(["b1"]);
  });

  it("idempotente: lead sem demo continua existindo do mesmo jeito", async () => {
    const db = new FakeFirestore();
    seedLeadComHistorico(db);

    const depois = await deleteDemo(db, "A");

    expect(depois.demo).toBeUndefined();
    expect(depois.status).toBe("contactado");
    expect(depois.demoVisitas).toHaveLength(1);
  });
});
