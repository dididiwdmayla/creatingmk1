import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saoPauloDateKey, usageUsuariosCollection } from "@/lib/costs";
import { FRASES_COLLECTION } from "@/lib/frases/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";
import { POST as analisar } from "../buscas/[id]/analise/route";
import { POST as traduzir } from "../frases/traduzir/route";
import { POST as sugerir } from "../leads/[id]/demo/sugestao/route";

/**
 * As três ações de IA (sugestão de demo, tradução de frase por skin,
 * análise interna do grupo) disputam o MESMO contador individual
 * `geracoesIA` — mesmo cada uma reservando um SKU global diferente
 * (aiGeneration/aiTraducao/aiGeneration). Este arquivo testa a cota
 * INDIVIDUAL cruzando as três rotas; cada rota já testa isoladamente o
 * SKU/teto GLOBAL no seu próprio arquivo.
 */

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const fetchMock = vi.fn();

const SKIN = "barbearia-editorial";

function respostaGemini(json: unknown): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }),
    { status: 200 },
  );
}

beforeEach(() => {
  db = new FakeFirestore();

  db.seed("leads/ChIJ001", {
    placeId: "ChIJ001",
    nome: "Barbearia do Zé",
    endereco: "Av. Corrientes 1234, Buenos Aires, Argentina",
    status: "novo",
    enriquecido: false,
    buscaId: ["b1"],
    demo: { skinId: SKIN, themeId: "meia-noite", atualizadoEm: "2026-08-01T00:00:00.000Z" },
    criadoEm: "2026-08-01T00:00:00.000Z",
    atualizadoEm: "2026-08-01T00:00:00.000Z",
  });
  db.seed(`${FRASES_COLLECTION}/${SKIN}`, { frases: ["Oi {nome}", "", ""], indice: 0 });
  db.seed("buscas/b1", {
    id: "b1",
    nome: "barbearia 01/08",
    nicho: "barbearia",
    regiao: "Sarandi PR",
    cor: "#2f82e0",
    criadaEm: "2026-08-01T10:00:00.000Z",
    totalCriados: 1,
    totalExistentes: 0,
  });

  fetchMock.mockReset();
  fetchMock.mockImplementation(async () =>
    respostaGemini({
      themeId: "meia-noite",
      destaque: "#8c4a2b",
      fonteDisplay: "playfair",
      animacao: "sutil",
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GEMINI_API_KEY", "chave-teste");
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function comLimiteDia(cookie: string, userId: string, limite: number) {
  // cookieDeSessao já seedou o doc do usuário; regrava com o limite de IA.
  const atual = db.getDoc(`usuarios/${userId}`) ?? {};
  db.seed(`usuarios/${userId}`, { ...atual, limites: { geracoesIADia: limite } });
  return cookie;
}

function sugerirReq(cookie: string): Promise<Response> {
  return sugerir(
    new Request("http://localhost/api/leads/ChIJ001/demo/sugestao", {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({ skinId: SKIN, nivel: "toque-leve" }),
    }),
    { params: Promise.resolve({ id: "ChIJ001" }) },
  );
}

function traduzirReq(cookie: string): Promise<Response> {
  return traduzir(
    new Request("http://localhost/api/frases/traduzir", {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({ leadId: "ChIJ001" }),
    }),
  );
}

function analisarReq(cookie: string): Promise<Response> {
  return analisar(
    new Request("http://localhost/api/buscas/b1/analise", { method: "POST", headers: { cookie } }),
    { params: Promise.resolve({ id: "b1" }) },
  );
}

function contadorDoDia(userId: string): number {
  const hoje = saoPauloDateKey(new Date());
  const doc = db.getDoc(`${usageUsuariosCollection(userId)}/${hoje}`);
  return (doc?.geracoesIA as number) ?? 0;
}

describe("cota individual geracoesIA compartilhada entre as três ações de IA", () => {
  it("sugestão de demo e tradução de frase somam no MESMO contador do usuário", async () => {
    const cookie = comLimiteDia(await cookieDeSessao(db, { id: "ana", papel: "membro" }), "ana", 5);

    fetchMock.mockImplementationOnce(async () =>
      respostaGemini({
        themeId: "meia-noite",
        destaque: "#8c4a2b",
        fonteDisplay: "playfair",
        animacao: "sutil",
      }),
    );
    const r1 = await sugerirReq(cookie);
    expect(r1.status).toBe(200);
    expect(contadorDoDia("ana")).toBe(1);

    fetchMock.mockImplementationOnce(async () => respostaGemini({ frases: ["Hola {nome}"] }));
    const r2 = await traduzirReq(cookie);
    expect(r2.status).toBe(200);
    expect(contadorDoDia("ana")).toBe(2);
  });

  it("estourando o limite diário na 3ª ação (análise), a rota recusa com 429 user_quota_exceeded", async () => {
    const cookie = comLimiteDia(await cookieDeSessao(db, { id: "ana", papel: "membro" }), "ana", 2);

    fetchMock.mockImplementationOnce(async () =>
      respostaGemini({
        themeId: "meia-noite",
        destaque: "#8c4a2b",
        fonteDisplay: "playfair",
        animacao: "sutil",
      }),
    );
    expect((await sugerirReq(cookie)).status).toBe(200);

    fetchMock.mockImplementationOnce(async () => respostaGemini({ frases: ["Hola {nome}"] }));
    expect((await traduzirReq(cookie)).status).toBe(200);

    expect(contadorDoDia("ana")).toBe(2);

    const r3 = await analisarReq(cookie);
    expect(r3.status).toBe(429);
    const { error } = await r3.json();
    expect(error).toMatchObject({ code: "user_quota_exceeded", tipo: "geracoesIA", janela: "dia" });
    // a 3ª tentativa não chamou o Gemini nem incrementou nada
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(contadorDoDia("ana")).toBe(2);
  });

  it("admin nunca é bloqueado pelo limite individual (nem tem contador individual gravado)", async () => {
    const cookie = comLimiteDia(await cookieDeSessao(db, { id: "chefe", papel: "admin" }), "chefe", 1);

    fetchMock.mockImplementationOnce(async () =>
      respostaGemini({
        themeId: "meia-noite",
        destaque: "#8c4a2b",
        fonteDisplay: "playfair",
        animacao: "sutil",
      }),
    );
    expect((await sugerirReq(cookie)).status).toBe(200);

    fetchMock.mockImplementationOnce(async () => respostaGemini({ frases: ["Hola {nome}"] }));
    expect((await traduzirReq(cookie)).status).toBe(200);

    fetchMock.mockImplementationOnce(async () => respostaGemini({ analise: "Priorize os dois leads." }));
    expect((await analisarReq(cookie)).status).toBe(200);

    // limite era 1/dia — um membro teria sido bloqueado já na 2ª ação; o admin
    // passou nas três, e (mesmo padrão de buscas/enriquecimentos) nunca ganha
    // doc de cota individual — só o teto global conta o uso dele.
    expect(contadorDoDia("chefe")).toBe(0);
  });

  it("sem limite configurado, as três ações passam livres e ainda assim gravam o contador", async () => {
    const cookie = await cookieDeSessao(db, { id: "bia", papel: "membro" });

    fetchMock.mockImplementationOnce(async () =>
      respostaGemini({
        themeId: "meia-noite",
        destaque: "#8c4a2b",
        fonteDisplay: "playfair",
        animacao: "sutil",
      }),
    );
    expect((await sugerirReq(cookie)).status).toBe(200);

    fetchMock.mockImplementationOnce(async () => respostaGemini({ frases: ["Hola {nome}"] }));
    expect((await traduzirReq(cookie)).status).toBe(200);

    fetchMock.mockImplementationOnce(async () => respostaGemini({ analise: "Priorize os dois leads." }));
    expect((await analisarReq(cookie)).status).toBe(200);

    expect(contadorDoDia("bia")).toBe(3);
  });
});
