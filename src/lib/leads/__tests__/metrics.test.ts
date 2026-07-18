import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { getMetrics } from "../metrics";

const NOW = new Date("2026-07-15T12:00:00Z");

function seedLead(
  db: FakeFirestore,
  id: string,
  contato: Record<string, string> = {},
): void {
  db.seed(`leads/${id}`, {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
    contato,
  });
}

describe("getMetrics", () => {
  it("tudo zero sem leads", async () => {
    const db = new FakeFirestore();

    expect(await getMetrics(db, NOW)).toEqual({
      contatosHoje: 0,
      contatosSemana: 0,
      taxaResposta: 0,
      demosCriadas: 0,
    });
  });

  it("conta contato de hoje (mesmo dia UTC)", async () => {
    const db = new FakeFirestore();
    seedLead(db, "A", { primeiroContatoEm: "2026-07-15T08:00:00.000Z" });
    seedLead(db, "B", { primeiroContatoEm: "2026-07-14T23:59:59.000Z" });

    const metrics = await getMetrics(db, NOW);

    expect(metrics.contatosHoje).toBe(1);
  });

  it("virada de dia em UTC: 23h59 local (Brasil) do dia 14 ainda conta como dia 15 UTC", async () => {
    const db = new FakeFirestore();
    // 2026-07-14T23:59-03:00 == 2026-07-15T02:59Z
    seedLead(db, "A", { primeiroContatoEm: "2026-07-15T02:59:00.000Z" });

    const metrics = await getMetrics(db, NOW);

    expect(metrics.contatosHoje).toBe(1);
  });

  it("contatosSemana é janela rolante de 7 dias", async () => {
    const db = new FakeFirestore();
    seedLead(db, "A", { primeiroContatoEm: "2026-07-15T00:00:00.000Z" }); // hoje
    seedLead(db, "B", { primeiroContatoEm: "2026-07-08T12:00:00.000Z" }); // exatamente 7 dias atrás
    seedLead(db, "C", { primeiroContatoEm: "2026-07-08T11:00:00.000Z" }); // mais de 7 dias atrás
    seedLead(db, "D", { primeiroContatoEm: "2026-06-01T00:00:00.000Z" }); // bem antigo

    const metrics = await getMetrics(db, NOW);

    expect(metrics.contatosSemana).toBe(2);
  });

  it("leads sem primeiroContatoEm não contam em hoje/semana", async () => {
    const db = new FakeFirestore();
    seedLead(db, "A");

    const metrics = await getMetrics(db, NOW);

    expect(metrics.contatosHoje).toBe(0);
    expect(metrics.contatosSemana).toBe(0);
  });

  it("taxaResposta = leads com respondeuEm / leads com primeiroContatoEm", async () => {
    const db = new FakeFirestore();
    seedLead(db, "A", {
      primeiroContatoEm: "2026-07-10T00:00:00.000Z",
      respondeuEm: "2026-07-11T00:00:00.000Z",
    });
    seedLead(db, "B", { primeiroContatoEm: "2026-07-10T00:00:00.000Z" });
    seedLead(db, "C"); // nunca contactado, não entra no denominador

    const metrics = await getMetrics(db, NOW);

    expect(metrics.taxaResposta).toBeCloseTo(0.5, 10);
  });

  it("taxaResposta é 0 (não NaN) quando ninguém foi contactado ainda", async () => {
    const db = new FakeFirestore();
    seedLead(db, "A");

    const metrics = await getMetrics(db, NOW);

    expect(metrics.taxaResposta).toBe(0);
  });

  it("demosCriadas conta leads com campo demo presente", async () => {
    const db = new FakeFirestore();
    seedLead(db, "A");
    seedLead(db, "B");
    db.seed("leads/C", {
      placeId: "C",
      nome: "Lead C",
      status: "novo",
      enriquecido: false,
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
      demo: {
        skinId: "barbearia-editorial",
        themeId: "norte",
        dados: {},
        criadoEm: "2026-07-01T00:00:00.000Z",
        atualizadoEm: "2026-07-01T00:00:00.000Z",
      },
    });

    const metrics = await getMetrics(db, NOW);

    expect(metrics.demosCriadas).toBe(1);
  });
});
