import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CAPS } from "@/lib/costs";
import { barraDoDia } from "@/lib/leads/barraDoDia";
import { DEFAULT_JANELAS_CONTATO } from "@/lib/leads/janelaContato";
import { getLead, upsertLeads } from "@/lib/leads/repo";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { horariosDoGoogle, placeHours, searchText, type GooglePlace } from "../client";

/**
 * Horário que vem de graça na busca qualificada (o mask textSearchEnterprise
 * já pede — e cobra — `regularOpeningHours`). Relógio congelado numa terça
 * ao meio-dia em Brasília: a lancheria do cenário só abre às 18h.
 */

const AGORA = new Date("2026-07-21T15:00:00.000Z"); // terça, 12h em Brasília (-180)
const BUSCA = { nicho: "lancheria", regiao: "Porto Alegre RS" };

/** Lancheria que abre de terça a domingo, 18h–23h30 (hora local). */
const HORARIO_GOOGLE: Pick<GooglePlace, "regularOpeningHours" | "utcOffsetMinutes"> = {
  utcOffsetMinutes: -180,
  regularOpeningHours: {
    periods: [2, 3, 4, 5, 6, 0].map((dia) => ({
      open: { day: dia, hour: 18, minute: 0 },
      close: { day: dia, hour: 23, minute: 30 },
    })),
  },
};

function lancheria(id: string, extra: Partial<GooglePlace> = {}): GooglePlace {
  return {
    id,
    displayName: { text: `Lancheria ${id}` },
    formattedAddress: "Av. Ipiranga, 100 - Porto Alegre - RS, Brasil",
    ...HORARIO_GOOGLE,
    ...extra,
  };
}

function responder(places: GooglePlace[]) {
  fetchMock.mockImplementation(
    async () =>
      new Response(JSON.stringify({ places }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

let db: FakeFirestore;
const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
  db = new FakeFirestore();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "chave-teste");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("horário na busca qualificada", () => {
  it("grava horários e fuso quando o Google os devolve", async () => {
    responder([lancheria("ChIJ001")]);

    const { places } = await searchText(db, "lancheria Porto Alegre", DEFAULT_CAPS, {
      qualificada: true,
    });
    await upsertLeads(db, places, BUSCA, "b1", AGORA);

    expect((await getLead(db, "ChIJ001"))?.horarios).toEqual({
      utcOffsetMinutes: -180,
      faixas: [2, 3, 4, 5, 6, 0].map((dia) => ({
        diaAbre: dia,
        horaAbre: 18,
        minAbre: 0,
        diaFecha: dia,
        horaFecha: 23,
        minFecha: 30,
      })),
      obtidoEm: AGORA.toISOString(),
    });
  });

  it("sem fuso na resposta (o mask de hoje não pede): grava as faixas, sem utcOffsetMinutes", async () => {
    responder([lancheria("ChIJ001", { utcOffsetMinutes: undefined })]);

    const { places } = await searchText(db, "lancheria", DEFAULT_CAPS, { qualificada: true });
    await upsertLeads(db, places, BUSCA, "b1", AGORA);

    const lead = await getLead(db, "ChIJ001");
    expect(lead?.horarios?.faixas).toHaveLength(6);
    expect(lead?.horarios).not.toHaveProperty("utcOffsetMinutes");
  });

  it("lugar sem horário publicado: continua SEM horários (não grava faixas vazias)", async () => {
    responder([lancheria("ChIJ001", { regularOpeningHours: undefined })]);

    const { places } = await searchText(db, "lancheria", DEFAULT_CAPS, { qualificada: true });
    await upsertLeads(db, places, BUSCA, "b1", AGORA);

    expect(places[0].horarios).toBeUndefined();
    expect((await getLead(db, "ChIJ001"))?.horarios).toBeUndefined();
  });

  it("busca básica continua sem horários, mesmo que a resposta trouxesse o campo", async () => {
    responder([lancheria("ChIJ001")]);

    const { places } = await searchText(db, "lancheria", DEFAULT_CAPS);
    await upsertLeads(db, places, BUSCA, "b1", AGORA);

    expect(places[0].horarios).toBeUndefined();
    expect((await getLead(db, "ChIJ001"))?.horarios).toBeUndefined();
  });

  it("horário do enriquecimento nunca é sobrescrito pela busca", async () => {
    const doEnriquecimento = {
      faixas: [{ diaAbre: 1, horaAbre: 8, minAbre: 0, diaFecha: 1, horaFecha: 12, minFecha: 0 }],
      utcOffsetMinutes: -180,
      obtidoEm: "2026-07-01T00:00:00.000Z",
    };
    db.seed("leads/ChIJ001", {
      placeId: "ChIJ001",
      nome: "Lancheria ChIJ001",
      status: "contactado",
      enriquecido: true,
      horarios: doEnriquecimento,
      buscaId: ["b0"],
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });
    responder([lancheria("ChIJ001")]);

    const { places } = await searchText(db, "lancheria", DEFAULT_CAPS, { qualificada: true });
    expect(places[0].horarios?.faixas).toHaveLength(6); // a busca trouxe horário…
    await upsertLeads(db, places, BUSCA, "b1", AGORA);

    const lead = await getLead(db, "ChIJ001");
    expect(lead?.horarios).toEqual(doEnriquecimento); // …e o que existia ficou
    expect(lead?.buscaId).toEqual(["b0", "b1"]);
  });

  it("lead existente SEM horário ganha o da busca (preenche o ausente)", async () => {
    db.seed("leads/ChIJ001", {
      placeId: "ChIJ001",
      nome: "Lancheria ChIJ001",
      status: "novo",
      enriquecido: false,
      buscaId: ["b0"],
      criadoEm: "2026-07-01T00:00:00.000Z",
      atualizadoEm: "2026-07-01T00:00:00.000Z",
    });
    responder([lancheria("ChIJ001")]);

    const { places } = await searchText(db, "lancheria", DEFAULT_CAPS, { qualificada: true });
    await upsertLeads(db, places, BUSCA, "b1", AGORA);

    expect((await getLead(db, "ChIJ001"))?.horarios?.faixas).toHaveLength(6);
  });

  it("lead com horário real sai do modo estimado na barraDoDia (a porta fechada ao meio-dia)", async () => {
    responder([lancheria("ChIJ001", { utcOffsetMinutes: undefined })]);
    const qualificada = await searchText(db, "lancheria", DEFAULT_CAPS, { qualificada: true });
    await upsertLeads(db, qualificada.places, BUSCA, "b1", AGORA);

    responder([lancheria("ChIJ002")]);
    const basica = await searchText(db, "lancheria", DEFAULT_CAPS);
    await upsertLeads(db, basica.places, BUSCA, "b2", AGORA);

    // Qualificada: faixas reais, fuso pelo país do endereço (Brasil, -180).
    const real = barraDoDia(DEFAULT_JANELAS_CONTATO, (await getLead(db, "ChIJ001"))!, AGORA)!;
    expect(real.estimado).toBe(false);
    expect(real.aberto).toBe(false);
    expect(real.abertura).toEqual({ inicio: 18 * 60, fim: 23 * 60 + 30 });
    expect(real.segmentos.every((s) => s.inicioMin >= 18 * 60)).toBe(true);

    // Básica: sem horário, cai no 9h–18h estimado — "aberto" ao meio-dia.
    const estimada = barraDoDia(DEFAULT_JANELAS_CONTATO, (await getLead(db, "ChIJ002"))!, AGORA)!;
    expect(estimada.estimado).toBe(true);
    expect(estimada.aberto).toBe(true);
  });

  it("a conversão é a mesma função nos dois caminhos (busca qualificada e placeHours)", async () => {
    const bruto = {
      utcOffsetMinutes: 60,
      regularOpeningHours: {
        periods: [
          { open: { day: 5, hour: 22 }, close: { day: 6, hour: 2, minute: 15 } },
          { open: { day: 0, hour: 0, minute: 0 } }, // sem close = 24h
        ],
      },
    };
    const esperado = horariosDoGoogle(bruto);

    responder([{ id: "ChIJ001", displayName: { text: "X" }, ...bruto }]);
    const { places } = await searchText(db, "x", DEFAULT_CAPS, { qualificada: true });

    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ id: "ChIJ001", ...bruto }), { status: 200 }),
    );
    const doDetails = await placeHours(db, "ChIJ001", DEFAULT_CAPS);

    expect(places[0].horarios).toEqual(esperado);
    expect(doDetails).toEqual(esperado);
    expect(esperado.faixas).toEqual([
      { diaAbre: 5, horaAbre: 22, minAbre: 0, diaFecha: 6, horaFecha: 2, minFecha: 15 },
      { diaAbre: 0, horaAbre: 0, minAbre: 0, diaFecha: 1, horaFecha: 0, minFecha: 0 },
    ]);
  });
});
