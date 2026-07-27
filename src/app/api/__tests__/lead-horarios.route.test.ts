import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { POST } from "../leads/[id]/horarios/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const fetchMock = vi.fn();

const GOOGLE_HORARIOS = {
  id: "ChIJ001",
  utcOffsetMinutes: -180,
  regularOpeningHours: {
    periods: [
      { open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 18, minute: 0 } },
    ],
  },
};

/** Sessão default de todos os testes deste arquivo — a rota agora EXIGE sessão identificável. */
let membroCookie: string;

beforeEach(async () => {
  db = new FakeFirestore();
  // Lead já enriquecido ANTES desta feature: tem `detalhes`, não tem `horarios`.
  db.seed("leads/ChIJ001", {
    placeId: "ChIJ001",
    nome: "Clínica Sorriso",
    status: "novo",
    enriquecido: true,
    detalhes: {
      telefone: "(44) 3264-0000",
      site: "https://clinicasorriso.com.br",
      enriquecidoEm: "2026-06-01T00:00:00.000Z",
    },
    criadoEm: "2026-06-01T00:00:00.000Z",
    atualizadoEm: "2026-06-01T00:00:00.000Z",
  });
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    async () => new Response(JSON.stringify(GOOGLE_HORARIOS), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "chave-teste");
  vi.stubEnv("APP_PASSWORD", "segredo123");
  membroCookie = await cookieDeSessao(db, { id: "membro-1", papel: "membro" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** cookie: null explicitamente pede request SEM sessão (default = membro). */
function buscarHorarios(id: string, cookie: string | null = membroCookie): Promise<Response> {
  return POST(
    new Request(`http://localhost/api/leads/${id}/horarios`, {
      method: "POST",
      ...(cookie && { headers: { cookie } }),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function usageDoc(): Record<string, unknown> | undefined {
  return db.getDoc(`usage/${new Date().toISOString().slice(0, 7)}`);
}

describe("POST /api/leads/[id]/horarios", () => {
  it("busca só o SKU detailsProHours, sem tocar detalhes/enriquecido", async () => {
    const res = await buscarHorarios("ChIJ001");

    expect(res.status).toBe(200);
    const { lead } = await res.json();
    expect(lead.horarios).toMatchObject({
      utcOffsetMinutes: -180,
      faixas: [{ diaAbre: 1, horaAbre: 9, minAbre: 0, diaFecha: 1, horaFecha: 18, minFecha: 0 }],
    });
    expect(lead.detalhes.site).toBe("https://clinicasorriso.com.br");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(usageDoc()).toMatchObject({ detailsProHours: 1, detailsEnterprise: 0 });
  });

  it("lead já com horários → retorna do cache SEM chamar o Google", async () => {
    await buscarHorarios("ChIJ001");

    const res = await buscarHorarios("ChIJ001");

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(usageDoc()).toMatchObject({ detailsProHours: 1 });
  });

  it("lead inexistente → 404 sem consumir cota", async () => {
    const res = await buscarHorarios("ChIJ999");

    expect(res.status).toBe(404);
    expect(usageDoc()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("teto detailsProHours estourado → 429, lead intacto", async () => {
    db.seed("config/app", { caps: { detailsProHours: 0 } });

    const res = await buscarHorarios("ChIJ001");

    expect(res.status).toBe(429);
    const { error } = await res.json();
    expect(error).toMatchObject({ code: "quota_exceeded", sku: "detailsProHours" });
    expect(db.getDoc("leads/ChIJ001")).not.toHaveProperty("horarios");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("com sessão, registra a quebra porUsuario da cota", async () => {
    const cookie = await cookieDeSessao(db, { id: "ana", papel: "membro" });

    const res = await buscarHorarios("ChIJ001", cookie);

    expect(res.status).toBe(200);
    const usage = usageDoc();
    expect(
      (usage?.porUsuario as Record<string, { detailsProHours: number }>).ana.detailsProHours,
    ).toBe(1);
  });

  it("erro do Google → 502, cota consumida, lead sem horários", async () => {
    fetchMock.mockImplementation(async () => new Response("boom", { status: 500 }));

    const res = await buscarHorarios("ChIJ001");

    expect(res.status).toBe(502);
    const { error } = await res.json();
    expect(error.code).toBe("places_error");
    expect(db.getDoc("leads/ChIJ001")).not.toHaveProperty("horarios");
    expect(usageDoc()).toMatchObject({ detailsProHours: 1 });
  });

  it("sem sessão identificável → 401", async () => {
    const res = await buscarHorarios("ChIJ001", null);

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("admin ignora o teto GLOBAL mensal (mas o contador ainda incrementa)", async () => {
    const adminCookie = await cookieDeSessao(db, { id: "chefe", papel: "admin" });
    db.seed("config/app", { caps: { detailsProHours: 0 } });

    const res = await buscarHorarios("ChIJ001", adminCookie);

    expect(res.status).toBe(200);
    expect(usageDoc()).toMatchObject({ detailsProHours: 1 });
  });
});
