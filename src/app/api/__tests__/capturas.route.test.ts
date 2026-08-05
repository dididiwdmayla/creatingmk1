import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { GET, POST as POST_LOTE } from "../capturas/route";
import { POST as POST_UM } from "../leads/[id]/capturas/route";

let db: FakeFirestore;
let disparos: Array<{ url: string; body: unknown; auth?: string }>;
let respostaDoGitHub: Response;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const DEMO = {
  skinId: "barbearia-editorial",
  themeId: "carvao-e-latao",
  dados: { imagens: {}, secoes: {} },
  criadoEm: "2026-07-01T00:00:00.000Z",
  atualizadoEm: "2026-07-01T00:00:00.000Z",
};

function seedLead(id: string, extra: Record<string, unknown> = {}) {
  db.seed(`leads/${id}`, {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
    ...extra,
  });
}

beforeEach(() => {
  db = new FakeFirestore();
  disparos = [];
  respostaDoGitHub = new Response(null, { status: 204 });
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.stubEnv("GITHUB_CAPTURAS_TOKEN", "ghp_teste");
  vi.stubEnv("GITHUB_CAPTURAS_REPO", "dono/repo");
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    disparos.push({
      url: String(url),
      body: JSON.parse(String(init.body)),
      auth: new Headers(init.headers).get("authorization") ?? undefined,
    });
    return respostaDoGitHub;
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const sessao = () => cookieDeSessao(db, { id: "admin", papel: "admin" });

function postUm(id: string, cookie?: string, body: unknown = {}) {
  return POST_UM(
    new Request(`http://localhost/api/leads/${id}/capturas`, {
      method: "POST",
      ...(cookie && { headers: { cookie } }),
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function postLote(body: unknown, cookie?: string) {
  return POST_LOTE(
    new Request("http://localhost/api/capturas", {
      method: "POST",
      ...(cookie && { headers: { cookie } }),
      body: JSON.stringify(body),
    }),
  );
}

function getEstado(ids: string, cookie?: string) {
  return GET(
    new Request(`http://localhost/api/capturas?ids=${ids}`, {
      ...(cookie && { headers: { cookie } }),
    }),
  );
}

describe("POST /api/leads/[id]/capturas", () => {
  it("sem sessão responde 401 e não dispara nada", async () => {
    seedLead("A", { demo: DEMO });
    const r = await postUm("A");
    expect(r.status).toBe(401);
    expect(disparos).toHaveLength(0);
  });

  it("enfileira o lead e dispara o repository_dispatch", async () => {
    seedLead("A", { demo: DEMO });

    const r = await postUm("A", await sessao());
    const json = await r.json();

    expect(r.status).toBe(200);
    expect(json.enfileirados).toEqual(["A"]);
    expect(disparos).toHaveLength(1);
    expect(disparos[0].url).toBe("https://api.github.com/repos/dono/repo/dispatches");
    expect(disparos[0].auth).toBe("Bearer ghp_teste");
    expect(disparos[0].body).toEqual({
      event_type: "capturas-demo",
      client_payload: { leads: "A", execucao: json.execucaoId },
    });
  });

  it("grava o estado ANTES do disparo, com quem pediu e o id da execução", async () => {
    seedLead("A", { demo: DEMO });
    const json = await (await postUm("A", await sessao())).json();

    const lead = db.getDoc("leads/A") as Record<string, unknown>;
    const capturas = lead.capturas as Record<string, unknown>;
    expect(capturas.estado).toBe("enfileirado");
    expect(capturas.execucaoId).toBe(json.execucaoId);
    expect(capturas.pedidoPor).toBe("admin");
    expect(typeof capturas.pedidoEm).toBe("string");
  });

  it("lead sem demo salva é pulado, sem disparar workflow", async () => {
    seedLead("SEMDEMO");
    const json = await (await postUm("SEMDEMO", await sessao())).json();

    expect(json.enfileirados).toEqual([]);
    expect(json.pulados).toEqual([{ placeId: "SEMDEMO", motivo: "sem demo salva" }]);
    expect(disparos).toHaveLength(0);
  });

  /** Dois cliques não podem virar dois runs concorrentes pelo mesmo lead. */
  it("geração já em andamento é pulada, a menos que seja Refazer", async () => {
    seedLead("A", {
      demo: DEMO,
      capturas: { estado: "rodando", execucaoId: "antigo", pedidoEm: new Date().toISOString() },
    });

    const semForcar = await (await postUm("A", await sessao())).json();
    expect(semForcar.pulados[0].motivo).toBe("já está gerando");
    expect(disparos).toHaveLength(0);

    const comForcar = await (await postUm("A", await sessao(), { forcar: true })).json();
    expect(comForcar.enfileirados).toEqual(["A"]);
    expect(disparos).toHaveLength(1);
  });

  /**
   * O estado que mente: enfileirado esperando um workflow que ninguém
   * chamou. Falha de disparo tem que desfazer para "falhou", com o motivo.
   */
  it("falha do GitHub desfaz o estado e devolve mensagem específica", async () => {
    seedLead("A", { demo: DEMO });
    respostaDoGitHub = new Response("Bad credentials", { status: 401 });

    const r = await postUm("A", await sessao());
    const json = await r.json();

    expect(r.status).toBe(502);
    expect(json.error.message).toContain("venceu ou foi revogado");

    const capturas = (db.getDoc("leads/A") as Record<string, unknown>).capturas as Record<string, unknown>;
    expect(capturas.estado).toBe("falhou");
    expect(String(capturas.erro)).toContain("venceu ou foi revogado");
  });

  it("token ausente responde 503 dizendo o que falta, sem chamar o GitHub", async () => {
    vi.stubEnv("GITHUB_CAPTURAS_TOKEN", "");
    seedLead("A", { demo: DEMO });

    const r = await postUm("A", await sessao());
    const json = await r.json();

    expect(r.status).toBe(503);
    expect(json.error.code).toBe("capturas_unavailable");
    expect(json.error.message).toContain("GITHUB_CAPTURAS_TOKEN");
    expect(disparos).toHaveLength(0);
  });

  it("cada status do GitHub vira uma causa distinta", async () => {
    seedLead("A", { demo: DEMO });
    for (const [status, trecho] of [
      [403, "não tem permissão"],
      [404, "não encontrado"],
      [422, "branch default"],
    ] as const) {
      respostaDoGitHub = new Response("", { status });
      const json = await (await postUm("A", await sessao(), { forcar: true })).json();
      expect(json.error.message, `status ${status}`).toContain(trecho);
    }
  });
});

describe("POST /api/capturas (lote)", () => {
  it("enfileira vários leads num disparo só", async () => {
    seedLead("A", { demo: DEMO });
    seedLead("B", { demo: DEMO });
    seedLead("C", { demo: DEMO });

    const json = await (await postLote({ placeIds: ["A", "B", "C"] }, await sessao())).json();

    expect(json.enfileirados).toEqual(["A", "B", "C"]);
    expect(disparos).toHaveLength(1);
    expect((disparos[0].body as { client_payload: { leads: string } }).client_payload.leads).toBe("A,B,C");
  });

  it("mistura de leads com e sem demo: enfileira os que dá, relata os pulados", async () => {
    seedLead("A", { demo: DEMO });
    seedLead("B");

    const json = await (await postLote({ placeIds: ["A", "B"] }, await sessao())).json();

    expect(json.enfileirados).toEqual(["A"]);
    expect(json.pulados).toEqual([{ placeId: "B", motivo: "sem demo salva" }]);
  });

  it("sem sessão, corpo vazio e lote acima do teto são recusados", async () => {
    seedLead("A", { demo: DEMO });
    expect((await postLote({ placeIds: ["A"] })).status).toBe(401);
    expect((await postLote({ placeIds: [] }, await sessao())).status).toBe(400);
    const gigante = Array.from({ length: 61 }, (_, i) => `L${i}`);
    expect((await postLote({ placeIds: gigante }, await sessao())).status).toBe(400);
  });
});

describe("GET /api/capturas", () => {
  it("devolve só o campo capturas de cada lead pedido", async () => {
    const capturas = {
      estado: "pronto",
      execucaoId: "e1",
      pedidoEm: "2026-08-05T12:00:00.000Z",
      geradoEm: "2026-08-05T12:04:00.000Z",
      imagens: [{ ancora: "hero", tela: "celular", ordem: 1, url: "u", largura: 390, altura: 844 }],
    };
    seedLead("A", { demo: DEMO, capturas });
    seedLead("B", { demo: DEMO });

    const json = await (await getEstado("A,B", await sessao())).json();

    expect(json.capturas.A).toEqual(capturas);
    expect(json.capturas.B).toBeNull();
    expect(json.disponivel).toBe(true);
  });

  it("informa indisponibilidade quando falta configuração", async () => {
    vi.stubEnv("GITHUB_CAPTURAS_TOKEN", "");
    const json = await (await getEstado("", await sessao())).json();
    expect(json.disponivel).toBe(false);
  });

  it("exige sessão", async () => {
    expect((await getEstado("A")).status).toBe(401);
  });
});
