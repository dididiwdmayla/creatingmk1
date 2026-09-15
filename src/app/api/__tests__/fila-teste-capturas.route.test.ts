import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LEAD_TESTE_ID } from "@/lib/fila/leadTeste";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { POST } from "../fila/teste/capturas/route";

/**
 * `POST /api/fila/teste/capturas` — o botão do painel "Disparo de teste"
 * que gera (ou regenera) a captura do LEAD FIXO DE TESTE, sem o operador
 * sair do painel para abrir a ficha à parte.
 *
 * Reusa `enfileirarCapturas` (mesmo mecanismo das outras duas rotas de
 * captura — ver `capturas.route.test.ts`), então o que este arquivo cobre
 * de propósito é só o que MUDA aqui: a rota nasce sem lead (o painel pode
 * ser a primeira vez que alguém abre a tela) e é admin-only, diferente das
 * genéricas.
 */

let db: FakeFirestore;
let disparos: Array<{ body: unknown }>;
let respostaDoGitHub: Response;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

beforeEach(() => {
  db = new FakeFirestore();
  disparos = [];
  respostaDoGitHub = new Response(null, { status: 204 });
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.stubEnv("GITHUB_CAPTURAS_TOKEN", "ghp_teste");
  vi.stubEnv("GITHUB_CAPTURAS_REPO", "dono/repo");
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    disparos.push({ body: JSON.parse(String(init.body)) });
    return respostaDoGitHub;
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function postReq(cookie?: string, body: unknown = {}) {
  return new Request("http://localhost/api/fila/teste/capturas", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie && { cookie }) },
    body: JSON.stringify(body),
  });
}

const admin = () => cookieDeSessao(db, { id: "admin", papel: "admin" });
const membro = () => cookieDeSessao(db, { id: "m1", papel: "membro" });

describe("permissão — mesma checagem do resto do bloco 'Fila de envio'", () => {
  it("sem sessão → 401, e nada é enfileirado nem criado", async () => {
    const res = await POST(postReq());

    expect(res.status).toBe(401);
    expect(disparos).toHaveLength(0);
    expect(db.getDoc(`leads/${LEAD_TESTE_ID}`)).toBeUndefined();
  });

  it("membro → 403, e nada é enfileirado nem criado", async () => {
    const res = await POST(postReq(await membro()));

    expect(res.status).toBe(403);
    expect(disparos).toHaveLength(0);
    expect(db.getDoc(`leads/${LEAD_TESTE_ID}`)).toBeUndefined();
  });
});

describe("POST /api/fila/teste/capturas", () => {
  it("cria o lead fixo de teste se o painel nunca foi aberto, e enfileira a captura dele", async () => {
    const res = await POST(postReq(await admin()));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.enfileirados).toEqual([LEAD_TESTE_ID]);
    expect(disparos).toHaveLength(1);
    expect(
      (disparos[0].body as { client_payload: { leads: string } }).client_payload.leads,
    ).toBe(LEAD_TESTE_ID);

    const lead = db.getDoc(`leads/${LEAD_TESTE_ID}`) as Record<string, unknown>;
    expect(lead.leadDeTeste).toBe(true);
    const capturas = lead.capturas as Record<string, unknown>;
    expect(capturas.estado).toBe("enfileirado");
    expect(capturas.pedidoPor).toBe("admin");
  });

  it("não sobrescreve o lead fixo já existente — só o campo capturas muda", async () => {
    db.seed(`leads/${LEAD_TESTE_ID}`, {
      placeId: LEAD_TESTE_ID,
      nome: "Barbearia Dom Aurélio",
      leadDeTeste: true,
      notas: "anotação do operador",
      demo: { skinId: "barbearia-editorial" },
    });

    await POST(postReq(await admin()));

    const lead = db.getDoc(`leads/${LEAD_TESTE_ID}`) as Record<string, unknown>;
    expect(lead.notas).toBe("anotação do operador");
  });

  it("sem forçar, uma geração já em andamento é pulada — clique duplo não empilha run", async () => {
    db.seed(`leads/${LEAD_TESTE_ID}`, {
      placeId: LEAD_TESTE_ID,
      nome: "Barbearia Dom Aurélio",
      leadDeTeste: true,
      demo: { skinId: "barbearia-editorial" },
      capturas: { estado: "rodando", execucaoId: "antigo", pedidoEm: new Date().toISOString() },
    });

    const json = await (await POST(postReq(await admin()))).json();

    expect(json.pulados).toEqual([{ placeId: LEAD_TESTE_ID, motivo: "já está gerando" }]);
    expect(disparos).toHaveLength(0);
  });

  it("com forçar, regenera por cima de uma captura pronta — é o botão 'Refazer' do painel", async () => {
    db.seed(`leads/${LEAD_TESTE_ID}`, {
      placeId: LEAD_TESTE_ID,
      nome: "Barbearia Dom Aurélio",
      leadDeTeste: true,
      demo: { skinId: "barbearia-editorial" },
      capturas: {
        estado: "pronto",
        execucaoId: "velho",
        pedidoEm: new Date().toISOString(),
        imagens: [{ ancora: "hero", tela: "celular", ordem: 1, url: "/x.png", largura: 1, altura: 1 }],
      },
    });

    const json = await (await POST(postReq(await admin(), { forcar: true }))).json();

    expect(json.enfileirados).toEqual([LEAD_TESTE_ID]);
    expect(disparos).toHaveLength(1);
    const lead = db.getDoc(`leads/${LEAD_TESTE_ID}`) as Record<string, unknown>;
    expect((lead.capturas as Record<string, unknown>).estado).toBe("enfileirado");
  });

  it("falha do GitHub desfaz o estado para 'falhou', com o motivo", async () => {
    respostaDoGitHub = new Response("Bad credentials", { status: 401 });

    const res = await POST(postReq(await admin()));
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.error.message).toContain("venceu ou foi revogado");

    const lead = db.getDoc(`leads/${LEAD_TESTE_ID}`) as Record<string, unknown>;
    const capturas = lead.capturas as Record<string, unknown>;
    expect(capturas.estado).toBe("falhou");
    expect(String(capturas.erro)).toContain("venceu ou foi revogado");
  });
});
