import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";

import { DEFAULT_CONFIG } from "@/lib/config";
import { DEFAULT_FILA_CONFIG } from "@/lib/fila/config";
import { criarTarefaResposta } from "@/lib/fila/respostaAutomatica";
import { FILA_RESPOSTAS_PENDENTES_COLLECTION } from "@/lib/fila/respostasPendentes";

import { GET } from "../config/fila/respostas/route";
import { PATCH } from "../config/fila/respostas/[id]/route";

/**
 * O painel "Respostas pendentes". Mesma divisão de `/api/config/fila` e da
 * lista de print: o bloco INTEIRO é do admin, leitura e escrita. Aqui a
 * razão é mais forte que "comando sobre hardware alheio" — o corpo destas
 * respostas é CONVERSA PRIVADA captada do celular pessoal do operador (ver
 * PRIVACIDADE no ARCHITECTURE.md), e por isso o 403 é conferido sem vazar
 * uma linha sequer.
 *
 * E, como as vizinhas, mora sob `/api/config/` e não sob `/api/fila/` —
 * aquele prefixo inteiro passa SEM sessão de usuário (é o celular com
 * Bearer, ver src/proxy.ts).
 */

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const GERADO_EM = "2026-03-10T11:01:00.000Z";

function semearResposta(id = "r-1", extra: Record<string, unknown> = {}) {
  db.seed("config/app", { mensagemPadrao: "Oi {nome}, tudo bem?" });
  db.seed("leads/ChIJa", {
    placeId: "ChIJa",
    nome: "Ink House",
    status: "respondeu",
    telefoneIntl: "+55 51 96666-0000",
    busca: { nicho: "tatuagem", regiao: "Porto Alegre RS", em: "2026-03-01T10:00:00.000Z" },
  });
  db.seed(`filaRespostas/${id}`, {
    id,
    leadId: "ChIJa",
    mensagens: [{ texto: "Oi, tenho interesse!", recebidoEm: "2026-03-10T11:00:00.000Z" }],
    rascunho: "Oi! Posso te mostrar agora?",
    geradoEm: GERADO_EM,
    estado: "pendente",
    ...extra,
  });
}

const getRequest = (cookie?: string) =>
  new Request("http://localhost/api/config/fila/respostas", {
    headers: { ...(cookie && { cookie }) },
  });

const patchRequest = (body: unknown, cookie?: string) =>
  new Request("http://localhost/api/config/fila/respostas/r-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(cookie && { cookie }) },
    body: JSON.stringify(body),
  });

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("APP_PASSWORD", "segredo123");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/config/fila/respostas (restrito ao admin)", () => {
  it("sem sessão → 401", async () => {
    semearResposta();

    const res = await GET(getRequest());

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });

  it("membro → 403, sem vazar uma linha da conversa", async () => {
    semearResposta();
    const cookie = await cookieDeSessao(db, { id: "membro-1", papel: "membro" });

    const res = await GET(getRequest(cookie));

    expect(res.status).toBe(403);
    const corpo = await res.json();
    expect(corpo.error.code).toBe("forbidden");
    expect(corpo.respostas).toBeUndefined();
    // O conteúdo da mensagem do lead não pode aparecer nem solto no corpo.
    expect(JSON.stringify(corpo)).not.toContain("tenho interesse");
  });

  it("lista vazia quando não há resposta pendente", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await GET(getRequest(cookie));

    expect(res.status).toBe(200);
    // O estado do interruptor viaja junto da lista: é ele que explica um
    // painel curto (ver `respostaAutomatica` em `lib/fila/config.ts`). E a
    // LINHA DE ESTADO vem junto pela razão gêmea: sem ela, "nada chegou" e
    // "chegou, a janela de agrupamento ainda está aberta" são o mesmo vazio.
    expect(await res.json()).toEqual({
      respostas: [],
      respostaAutomatica: false,
      aguardando: 0,
      comErro: [],
      janelaSegundos: DEFAULT_FILA_CONFIG.respostaAgrupamentoSegundos,
    });
  });

  it("admin recebe lead, nicho, mensagens, o que o Radar mandou e o rascunho", async () => {
    semearResposta();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const { respostas } = await (await GET(getRequest(cookie))).json();

    expect(respostas).toEqual([
      {
        id: "r-1",
        leadId: "ChIJa",
        nome: "Ink House",
        nicho: "tatuagem",
        telefone: "5551966660000",
        mensagens: [{ texto: "Oi, tenho interesse!", recebidoEm: "2026-03-10T11:00:00.000Z" }],
        mensagemEnviada: "Oi Ink House, tudo bem?",
        rascunho: "Oi! Posso te mostrar agora?",
        geradoEm: GERADO_EM,
      },
    ]);
  });
});

describe("PATCH /api/config/fila/respostas/{id} (restrito ao admin)", () => {
  it("admin marca usada com o texto EDITADO e a linha sai da lista", async () => {
    semearResposta();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PATCH(
      patchRequest({ estado: "usada", texto: "Oi! Mando o link agora." }, cookie),
      params("r-1"),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "r-1", estado: "usada" });
    expect(db.getDoc("filaRespostas/r-1")).toMatchObject({
      estado: "usada",
      textoUsado: "Oi! Mando o link agora.",
    });
    expect((await (await GET(getRequest(cookie))).json()).respostas).toEqual([]);
  });

  it("descartar também tira da lista, sem guardar texto", async () => {
    semearResposta();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PATCH(patchRequest({ estado: "descartada" }, cookie), params("r-1"));

    expect(res.status).toBe(200);
    expect(db.getDoc("filaRespostas/r-1")?.textoUsado).toBeUndefined();
    expect((await (await GET(getRequest(cookie))).json()).respostas).toEqual([]);
  });

  it("membro não altera — 403", async () => {
    semearResposta();
    const cookie = await cookieDeSessao(db, { id: "membro-1", papel: "membro" });

    const res = await PATCH(patchRequest({ estado: "usada" }, cookie), params("r-1"));

    expect(res.status).toBe(403);
    expect(db.getDoc("filaRespostas/r-1")?.estado).toBe("pendente");
  });

  it("sem sessão → 401", async () => {
    semearResposta();

    expect((await PATCH(patchRequest({ estado: "usada" }), params("r-1"))).status).toBe(401);
  });

  it("estado fora dos dois aceitos → 400, sem escrever", async () => {
    semearResposta();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    for (const corpo of [{ estado: "pendente" }, { estado: "qualquer" }, {}]) {
      const res = await PATCH(patchRequest(corpo, cookie), params("r-1"));
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("validation_error");
    }
    expect(db.getDoc("filaRespostas/r-1")?.estado).toBe("pendente");
  });

  it("texto que não é string → 400", async () => {
    semearResposta();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PATCH(patchRequest({ estado: "usada", texto: 42 }, cookie), params("r-1"));

    expect(res.status).toBe(400);
    expect(db.getDoc("filaRespostas/r-1")?.estado).toBe("pendente");
  });

  it("id que não existe → 404, sem criar doc", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await PATCH(patchRequest({ estado: "usada" }, cookie), params("r-nada"));

    expect(res.status).toBe(404);
    expect(db.getDoc("filaRespostas/r-nada")).toBeUndefined();
  });

  it("descartar o que já foi usado → 409, sem apagar o texto que saiu", async () => {
    semearResposta();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    await PATCH(patchRequest({ estado: "usada", texto: "o que saiu" }, cookie), params("r-1"));

    const res = await PATCH(patchRequest({ estado: "descartada" }, cookie), params("r-1"));

    expect(res.status).toBe(409);
    expect(db.getDoc("filaRespostas/r-1")).toMatchObject({
      estado: "usada",
      textoUsado: "o que saiu",
    });
  });
});

describe("GET /api/config/fila/respostas — com a resposta automática ligada", () => {
  it("o rascunho que está na fila do aparelho sai da lista, e o interruptor explica por quê", async () => {
    semearResposta();
    db.seed("config/fila", { respostaAutomatica: true });
    await criarTarefaResposta(
      db,
      {
        id: "r-1",
        leadId: "ChIJa",
        nome: "Ink House",
        numero: "5551966660000",
        texto: "Oi! Posso te mostrar agora?",
        atrasoSegundos: 600,
      },
      new Date(),
    );
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (await GET(getRequest(cookie))).json();

    // Lista vazia com a razão ao lado — a tela usa isso para não mostrar um
    // painel vazio sem explicação.
    expect(corpo).toEqual({
      respostas: [],
      respostaAutomatica: true,
      aguardando: 0,
      comErro: [],
      janelaSegundos: DEFAULT_FILA_CONFIG.respostaAgrupamentoSegundos,
    });
  });

  it("desligar o interruptor devolve o mesmo rascunho à lista", async () => {
    semearResposta();
    db.seed("config/fila", { respostaAutomatica: false });
    await criarTarefaResposta(
      db,
      {
        id: "r-1",
        leadId: "ChIJa",
        nome: "Ink House",
        numero: "5551966660000",
        texto: "Oi! Posso te mostrar agora?",
        atrasoSegundos: 600,
      },
      new Date(),
    );
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (await GET(getRequest(cookie))).json();

    expect(corpo.respostaAutomatica).toBe(false);
    expect(corpo.respostas.map((r: { id: string }) => r.id)).toEqual(["r-1"]);
  });
});

/**
 * ABRIR O PAINEL ESVAZIA OS GRUPOS MADUROS — o terceiro gatilho do flush.
 *
 * Os outros dois dependem do APARELHO: a macro só chama `/proximo` com o
 * celular parado, bloqueado e ocioso há mais de dez minutos, e o Radar não
 * tem visão nenhuma do uso do aparelho. Um lead de VERDADE que responde
 * enquanto o operador está com o celular na mão ficava sem rascunho até o
 * aparelho ficar ocioso — problema de produção, não de teste.
 *
 * Relógio congelado e `fetch` mockado: o que se prova aqui é QUANDO a
 * geração acontece, nunca o texto que um modelo real devolveria.
 */
describe("GET /api/config/fila/respostas — o esvaziamento ao ABRIR o painel", () => {
  const AGORA = new Date("2026-03-10T12:00:00.000Z");
  const fetchMock = vi.fn();

  function semearGrupo(leadId: string, ultimaMensagemEm: string, extra: Record<string, unknown> = {}) {
    db.seed(`${FILA_RESPOSTAS_PENDENTES_COLLECTION}/${leadId}`, {
      leadId,
      mensagens: [{ texto: "Quanto fica?", recebidoEm: ultimaMensagemEm }],
      primeiraMensagemEm: ultimaMensagemEm,
      ultimaMensagemEm,
      tentativas: 0,
      ultimoErro: null,
      ...extra,
    });
  }

  function semearLead() {
    db.seed("config/app", { mensagemPadrao: "Oi {nome}, tudo bem?" });
    db.seed("leads/ChIJa", {
      placeId: "ChIJa",
      nome: "Ink House",
      status: "respondeu",
      telefoneIntl: "+55 51 96666-0000",
      busca: { nicho: "tatuagem", regiao: "Porto Alegre RS", em: "2026-03-01T10:00:00.000Z" },
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: JSON.stringify({ rascunho: "Oi! Te explico." }) }] } },
            ],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GEMINI_API_KEY", "chave-teste");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("grupo MADURO vira rascunho na abertura — sem o aparelho ter chamado nada", async () => {
    semearLead();
    // 60s de silêncio, janela de 45s: já venceu.
    semearGrupo("ChIJa", "2026-03-10T11:59:00.000Z");
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (await GET(getRequest(cookie))).json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(corpo.respostas).toHaveLength(1);
    expect(corpo.respostas[0].leadId).toBe("ChIJa");
    expect(corpo.respostas[0].rascunho).toBe("Oi! Te explico.");
    // O grupo foi esvaziado, e nada ficou "aguardando".
    expect(corpo.aguardando).toBe(0);
    expect(corpo.comErro).toEqual([]);
  });

  it("grupo DENTRO da janela não é gerado antes da hora — aparece como aguardando", async () => {
    semearLead();
    // 10s de silêncio, janela de 45s: ainda não venceu.
    semearGrupo("ChIJa", "2026-03-10T11:59:50.000Z");
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (await GET(getRequest(cookie))).json();

    // NENHUMA chamada de IA: gerar antes da hora quebraria o agrupamento
    // (três linhas seguidas do lead virariam três rascunhos) e custaria
    // cota à toa.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(corpo.respostas).toEqual([]);
    // Mas a tela SABE que algo chegou — é o item inteiro desta linha.
    expect(corpo.aguardando).toBe(1);
    expect(corpo.janelaSegundos).toBe(DEFAULT_FILA_CONFIG.respostaAgrupamentoSegundos);
  });

  it("falha de IA NÃO derruba o painel: lista o que houver e mostra o grupo com erro, retentável", async () => {
    semearLead();
    // Uma pendente que já existia, e um grupo maduro cuja geração vai falhar.
    semearResposta("r-ja-existia");
    semearGrupo("ChIJa", "2026-03-10T11:59:00.000Z");
    fetchMock.mockImplementation(async () => new Response("mal gateway", { status: 502 }));
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await GET(getRequest(cookie));

    // O painel CARREGA — 200, nunca 5xx.
    expect(res.status).toBe(200);
    const corpo = await res.json();
    // E lista o que já havia: a falha de um grupo não apaga a lista.
    expect(corpo.respostas.map((r: { id: string }) => r.id)).toEqual(["r-ja-existia"]);
    // O grupo que falhou aparece NOMEADO, com a tentativa contada.
    expect(corpo.comErro).toHaveLength(1);
    expect(corpo.comErro[0]).toMatchObject({
      leadId: "ChIJa",
      nome: "Ink House",
      mensagens: 1,
      tentativas: 1,
    });
    expect(corpo.comErro[0].ultimoErro).toBeTruthy();
    // PRIVACIDADE: a linha de estado conta as mensagens, nunca as transcreve.
    expect(JSON.stringify(corpo.comErro)).not.toContain("Quanto fica?");
    // E é RETENTÁVEL: as mensagens voltaram para o grupo pendente.
    const grupo = db.getDoc(`${FILA_RESPOSTAS_PENDENTES_COLLECTION}/ChIJa`);
    expect((grupo?.mensagens as unknown[]).length).toBe(1);
  });

  it("a abertura seguinte RETENTA o grupo que falhou, e ele vira rascunho", async () => {
    semearLead();
    semearGrupo("ChIJa", "2026-03-10T11:59:00.000Z");
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    fetchMock.mockImplementationOnce(async () => new Response("mal gateway", { status: 502 }));
    const primeira = await (await GET(getRequest(cookie))).json();
    expect(primeira.comErro).toHaveLength(1);

    const segunda = await (await GET(getRequest(cookie))).json();
    expect(segunda.comErro).toEqual([]);
    expect(segunda.respostas).toHaveLength(1);
  });

  it("cota de geração estourada também não derruba o painel", async () => {
    semearLead();
    semearGrupo("ChIJa", "2026-03-10T11:59:00.000Z");
    // Teto de `aiGeneration` já consumido no mês corrente.
    db.seed("usage/2026-03", { aiGeneration: DEFAULT_CONFIG.caps.aiGeneration });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await GET(getRequest(cookie));

    expect(res.status).toBe(200);
    const corpo = await res.json();
    // Reserva ANTES do request: a IA nunca chega a ser chamada.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(corpo.comErro).toHaveLength(1);
  });

  it("sem grupo nenhum, nenhuma chamada de IA — abrir o painel não custa por si só", async () => {
    semearResposta();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (await GET(getRequest(cookie))).json();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(corpo.respostas).toHaveLength(1);
    expect(corpo.aguardando).toBe(0);
  });

  it("MEMBRO continua barrado — o esvaziamento não roda para quem não é admin", async () => {
    semearLead();
    semearGrupo("ChIJa", "2026-03-10T11:59:00.000Z");
    const cookie = await cookieDeSessao(db, { id: "membro-1", papel: "membro" });

    const res = await GET(getRequest(cookie));

    expect(res.status).toBe(403);
    // `requireAdmin` vem ANTES do flush: um membro não gasta cota de IA.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
