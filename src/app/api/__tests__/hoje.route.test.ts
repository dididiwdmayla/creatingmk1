import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET } from "../hoje/route";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

function hojeRequest(cookie?: string): Request {
  return new Request("http://localhost/api/hoje", {
    ...(cookie && { headers: { cookie } }),
  });
}

function seedLead(placeId: string, overrides: Record<string, unknown> = {}): void {
  db.seed(`leads/${placeId}`, {
    placeId,
    nome: `Lead ${placeId}`,
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-19T00:00:00.000Z",
    atualizadoEm: "2026-07-19T00:00:00.000Z",
    ...overrides,
  });
}

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/hoje", () => {
  it("sem sessão identificável → 401 (o delta é por usuário)", async () => {
    const res = await GET(hojeRequest());

    expect(res.status).toBe(401);
  });

  it("monta as 3 seções e devolve buscas/mensagem para as ações diretas", async () => {
    const cookie = await cookieDeSessao(db, { id: "ana" });
    db.seed("config/app", { mensagemPadrao: "Oi {nome}!" });
    db.seed("buscas/b1", {
      id: "b1",
      nome: "dentistas",
      nicho: "dentista",
      regiao: "Sarandi PR",
      cor: "#2f82e0",
      mensagemPadrao: "msg do grupo",
      criadaEm: "2026-07-01T00:00:00.000Z",
      totalCriados: 1,
      totalExistentes: 0,
    });
    seedLead("novo-1", { buscaId: ["b1"] });
    seedLead("follow-1", {
      status: "contactado",
      contato: { primeiroContatoEm: "2026-07-01T00:00:00.000Z" },
    });
    seedLead("demo-1", {
      demo: {
        skinId: "s",
        themeId: "t",
        dados: {},
        criadoEm: "2026-07-15T00:00:00.000Z",
        atualizadoEm: "2026-07-15T00:00:00.000Z",
      },
    });

    const res = await GET(hojeRequest(cookie));

    expect(res.status).toBe(200);
    const data = await res.json();
    // Primeira visita: tudo é novo (novosDesde null).
    expect(data.novosDesde).toBeNull();
    expect(data.novos.map((l: { placeId: string }) => l.placeId).sort()).toEqual([
      "demo-1",
      "follow-1",
      "novo-1",
    ]);
    expect(data.followUps.map((l: { placeId: string }) => l.placeId)).toEqual(["follow-1"]);
    expect(data.demosParadas.map((l: { placeId: string }) => l.placeId)).toEqual(["demo-1"]);
    expect(data.followUpDias).toBe(4);
    expect(data.mensagemPadrao).toContain("{nome}");
    expect(data.buscas).toEqual([
      {
        id: "b1",
        nome: "dentistas",
        cor: "#2f82e0",
        nicho: "dentista",
        regiao: "Sarandi PR",
        mensagemPadrao: "msg do grupo",
      },
    ]);
  });

  it("carimba ultimaVisitaEm do usuário e o delta seguinte parte dele", async () => {
    const cookie = await cookieDeSessao(db, { id: "ana" });
    seedLead("velho", { criadoEm: "2026-07-10T00:00:00.000Z" });

    const primeira = await (await GET(hojeRequest(cookie))).json();
    expect(primeira.novos).toHaveLength(1);

    const carimbo = db.getDoc("usuarios/ana")?.ultimaVisitaEm;
    expect(typeof carimbo).toBe("string");

    // Segunda visita: o lead velho fica fora do delta; um recém-criado entra.
    seedLead("recem", { criadoEm: new Date(Date.now() + 1000).toISOString() });
    const segunda = await (await GET(hojeRequest(cookie))).json();

    expect(segunda.novosDesde).toBe(carimbo);
    expect(segunda.novos.map((l: { placeId: string }) => l.placeId)).toEqual(["recem"]);
  });

  it("o delta é POR usuário: a visita de um não zera o delta do outro", async () => {
    const cookieAna = await cookieDeSessao(db, { id: "ana" });
    const cookieBia = await cookieDeSessao(db, { id: "bia" });
    seedLead("l1");

    await GET(hojeRequest(cookieAna));

    const deBia = await (await GET(hojeRequest(cookieBia))).json();
    expect(deBia.novos).toHaveLength(1);
    expect(db.getDoc("usuarios/ana")?.ultimaVisitaEm).toBeDefined();
    expect(db.getDoc("usuarios/bia")?.ultimaVisitaEm).toBeDefined();
  });

  it("followUpDias da config muda o corte dos follow-ups", async () => {
    const cookie = await cookieDeSessao(db, { id: "ana" });
    db.seed("config/app", { followUpDias: 30 });
    seedLead("f1", {
      status: "contactado",
      contato: { primeiroContatoEm: "2026-07-10T00:00:00.000Z" },
    });

    const data = await (await GET(hojeRequest(cookie))).json();

    expect(data.followUpDias).toBe(30);
    expect(data.followUps).toHaveLength(0);
  });

  it("abriramNaoResponderam: contactado com visita não-interna registrada", async () => {
    const cookie = await cookieDeSessao(db, { id: "ana" });
    seedLead("abriu", {
      status: "contactado",
      demoVisitas: [{ id: "v1", em: "2026-07-19T00:00:00.000Z", interna: false }],
    });
    seedLead("so-preview-do-time", {
      status: "contactado",
      demoVisitas: [{ id: "v2", em: "2026-07-19T00:00:00.000Z", interna: true }],
    });

    const data = await (await GET(hojeRequest(cookie))).json();

    expect(data.abriramNaoResponderam.map((l: { placeId: string }) => l.placeId)).toEqual([
      "abriu",
    ]);
    // Status NUNCA é alterado por esta rota.
    expect(db.getDoc("leads/abriu")?.status).toBe("contactado");
  });

  it("self-heal do token de envio também cobre abriramNaoResponderam", async () => {
    const cookie = await cookieDeSessao(db, { id: "ana" });
    seedLead("abriu-sem-token", {
      status: "contactado",
      demo: { skinId: "s", themeId: "t", dados: {}, criadoEm: "x", atualizadoEm: "x" },
      demoVisitas: [{ id: "v1", em: "2026-07-19T00:00:00.000Z", interna: false }],
    });

    const data = await (await GET(hojeRequest(cookie))).json();

    // Um token vigente por canal (link + whatsapp).
    expect(data.abriramNaoResponderam[0].demo.envios).toHaveLength(2);
  });
});
