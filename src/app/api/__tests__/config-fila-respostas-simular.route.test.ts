import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG } from "@/lib/config";
import { saveContextoComercial } from "@/lib/contextoComercial";
import { saveFilaConfig } from "@/lib/fila/config";
import { FILA_RESPOSTAS_COLLECTION } from "@/lib/fila/estado";
import { FILA_RESPOSTAS_TAREFAS_COLLECTION } from "@/lib/fila/respostaAutomatica";
import { FILA_RESPOSTAS_PENDENTES_COLLECTION } from "@/lib/fila/respostasPendentes";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { cookieDeSessao } from "@/lib/testing/sessao";

import { GET as GET_LISTA } from "../config/fila/respostas/route";
import { GET, POST } from "../config/fila/respostas/simular/route";

/**
 * SIMULAR MENSAGEM — o ensaio que testa só a IA.
 *
 * O número de exceção testa duas coisas ao mesmo tempo (o caminho do
 * CELULAR e a QUALIDADE da IA) e devagar. Este bloco separa: pula captura,
 * casamento de número, dedupe e janela de agrupamento — e NÃO pula a
 * geração, que é a mesma função da produção. É essa última parte que os
 * testes aqui precisam provar de verdade, porque uma cópia "para testar"
 * passaria em tudo o que é fácil de verificar e não provaria nada.
 *
 * Relógio congelado, `fetch` mockado e FakeFirestore: nada aqui depende do
 * texto que um modelo real devolveria.
 */

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const AGORA = new Date("2026-03-10T12:00:00.000Z");
const fetchMock = vi.fn();

function semearLead() {
  db.seed("config/app", { mensagemPadrao: "Oi {nome}, tudo bem?" });
  db.seed("leads/ChIJa", {
    placeId: "ChIJa",
    nome: "Ink House",
    status: "contatado",
    telefoneIntl: "+55 51 96666-0000",
    busca: { nicho: "tatuagem", regiao: "Porto Alegre RS", em: "2026-03-01T10:00:00.000Z" },
  });
}

const postRequest = (body: unknown, cookie?: string) =>
  new Request("http://localhost/api/config/fila/respostas/simular", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie && { cookie }) },
    body: JSON.stringify(body),
  });

const getRequest = (cookie?: string, url = "http://localhost/api/config/fila/respostas/simular") =>
  new Request(url, { headers: { ...(cookie && { cookie }) } });

/** O prompt que saiu para o Gemini na n-ésima chamada. */
function promptDaChamada(indice = 0): string {
  const corpo = JSON.parse(fetchMock.mock.calls[indice][1].body as string);
  return corpo.contents[0].parts[0].text as string;
}

beforeEach(() => {
  db = new FakeFirestore();
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  vi.stubEnv("APP_PASSWORD", "segredo123");
  vi.stubEnv("GEMINI_API_KEY", "chave-teste");
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ rascunho: "Oi! Te explico agora." }) }],
              },
            },
          ],
        }),
        { status: 200 },
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/config/fila/respostas/simular — permissão", () => {
  it("sem sessão → 401, e nenhuma chamada de IA", async () => {
    semearLead();

    const res = await POST(postRequest({ leadId: "ChIJa", texto: "Quanto custa?" }));

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
    // Cota é dinheiro: quem não passa do portão não gasta.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("membro → 403, e nenhuma chamada de IA", async () => {
    semearLead();
    const cookie = await cookieDeSessao(db, { id: "membro-1", papel: "membro" });

    const res = await POST(postRequest({ leadId: "ChIJa", texto: "Quanto custa?" }, cookie));

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("forbidden");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GET do lead padrão também é admin-only", async () => {
    expect((await GET(getRequest())).status).toBe(401);
    const cookie = await cookieDeSessao(db, { id: "membro-1", papel: "membro" });
    expect((await GET(getRequest(cookie))).status).toBe(403);
  });
});

describe("POST /api/config/fila/respostas/simular — o rascunho", () => {
  it("admin simula e recebe o rascunho na hora, marcado com o lead de contexto", async () => {
    semearLead();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await POST(
      postRequest({ leadId: "ChIJa", texto: "Oi, quanto custa?" }, cookie),
    );

    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.rascunho).toBe("Oi! Te explico agora.");
    expect(corpo.leadId).toBe("ChIJa");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("UMA chamada de IA por clique — nunca duas, nem retry de schema", async () => {
    semearLead();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    await POST(postRequest({ leadId: "ChIJa", texto: "Oi!" }, cookie));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lead inexistente → 404, sem gastar cota", async () => {
    semearLead();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await POST(postRequest({ leadId: "nao-existe", texto: "Oi!" }, cookie));

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("texto vazio ou leadId vazio → 400, sem gastar cota", async () => {
    semearLead();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    expect((await POST(postRequest({ leadId: "ChIJa", texto: "   " }, cookie))).status).toBe(400);
    expect((await POST(postRequest({ leadId: "", texto: "Oi!" }, cookie))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("MULTILINHA: o texto do lead chega ao prompt com as quebras de linha", async () => {
    semearLead();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    await POST(
      postRequest({ leadId: "ChIJa", texto: "Oi, tudo bem?\nQuanto custa?\nTem manutenção?" }, cookie),
    );

    expect(promptDaChamada()).toContain("Oi, tudo bem?\nQuanto custa?\nTem manutenção?");
  });
});

/**
 * A PROVA DE QUE É O MESMO CAMINHO — e não um mock de espião, que provaria
 * só que um mock foi chamado. O que se compara é o PROMPT que sai para o
 * Gemini nos dois caminhos, com o mesmo lead, o mesmo texto e o mesmo
 * relógio: se a simulação tivesse uma montagem própria, as duas strings
 * divergiriam no primeiro campo que alguém esquecesse de copiar.
 */
describe("a simulação usa a MESMA geração da produção", () => {
  it("o prompt da simulação é idêntico, byte a byte, ao do flush de produção", async () => {
    semearLead();
    await saveContextoComercial(db, { texto: "Site a partir de R$1.500, 10 dias úteis." });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });
    const texto = "Oi, quanto custa e em quanto tempo fica pronto?";

    // ── Caminho de PRODUÇÃO: grupo maduro esvaziado ao abrir o painel.
    db.seed(`${FILA_RESPOSTAS_PENDENTES_COLLECTION}/ChIJa`, {
      leadId: "ChIJa",
      mensagens: [{ texto, recebidoEm: AGORA.toISOString() }],
      primeiraMensagemEm: "2026-03-10T11:59:00.000Z",
      ultimaMensagemEm: "2026-03-10T11:59:00.000Z",
      tentativas: 0,
      ultimoErro: null,
    });
    await GET_LISTA(getRequest(cookie, "http://localhost/api/config/fila/respostas"));
    const promptProducao = promptDaChamada(0);

    // ── Caminho da SIMULAÇÃO: o mesmo texto, digitado na tela.
    await POST(postRequest({ leadId: "ChIJa", texto }, cookie));
    const promptSimulacao = promptDaChamada(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(promptSimulacao).toBe(promptProducao);
    // E não é uma igualdade vazia: o prompt real carrega as duas regras
    // duras e o contexto comercial.
    expect(promptSimulacao).toContain("REGRAS DURAS, sem exceção:");
    expect(promptSimulacao).toContain("Site a partir de R$1.500, 10 dias úteis.");
  });

  it("o contexto devolvido é o que FOI ao prompt, não um recálculo da tela", async () => {
    semearLead();
    await saveContextoComercial(db, { texto: "Fazemos site institucional." });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (
      await POST(postRequest({ leadId: "ChIJa", texto: "Quanto custa?" }, cookie))
    ).json();
    const prompt = promptDaChamada();

    expect(corpo.contexto.nome).toBe("Ink House");
    expect(corpo.contexto.nicho).toBe("tatuagem");
    expect(corpo.contexto.contextoComercialPreenchido).toBe(true);
    // Cada campo devolvido aparece LITERALMENTE no prompt que saiu.
    expect(prompt).toContain(corpo.contexto.mensagemEnviada);
    expect(prompt).toContain(corpo.contexto.posicionamentoPreco);
  });

  it("documento comercial VAZIO é dito como vazio — é a pergunta que o operador faz", async () => {
    semearLead();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (
      await POST(postRequest({ leadId: "ChIJa", texto: "Quanto custa?" }, cookie))
    ).json();

    expect(corpo.contexto.contextoComercialPreenchido).toBe(false);
    // Sem o documento, a regra dura continua no prompt — é o único freio
    // contra o modelo preencher o vazio com um número plausível.
    expect(promptDaChamada()).toContain("REGRAS DURAS, sem exceção:");
  });
});

/**
 * O QUE A SIMULAÇÃO NÃO FAZ. Esta é a parte que precisa de teste de
 * verdade: o resultado aparece na tela e morre ali. Garantia mais forte que
 * a do número de exceção, que grava com `teste: true` e depende de três
 * filtros para não vazar — aqui não há doc para vazar.
 */
describe("a simulação NÃO deixa rastro", () => {
  async function simular(cookie: string) {
    return POST(postRequest({ leadId: "ChIJa", texto: "Oi, quanto custa?" }, cookie));
  }

  it("não grava em filaRespostas, e não aparece na lista de pendentes", async () => {
    semearLead();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    await simular(cookie);

    const gravados = await db.collection(FILA_RESPOSTAS_COLLECTION).get();
    expect(gravados.docs).toHaveLength(0);

    const lista = await (
      await GET_LISTA(getRequest(cookie, "http://localhost/api/config/fila/respostas"))
    ).json();
    expect(lista.respostas).toEqual([]);
  });

  it("com respostaAutomatica LIGADA, ainda não vira tarefa de envio", async () => {
    semearLead();
    await saveFilaConfig(db, {
      respostaAutomatica: true,
      respostaAutomaticaApenasPrimeira: false,
    });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    await simular(cookie);

    const tarefas = await db.collection(FILA_RESPOSTAS_TAREFAS_COLLECTION).get();
    expect(tarefas.docs).toHaveLength(0);
    // E nem o rascunho existe para uma tarefa futura nascer dele.
    expect((await db.collection(FILA_RESPOSTAS_COLLECTION).get()).docs).toHaveLength(0);
  });

  it("não grava na subcoleção de respostas do lead — ele não escreveu nada", async () => {
    semearLead();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    await simular(cookie);

    const respostasDoLead = await db.collection("leads/ChIJa/respostas").get();
    expect(respostasDoLead.docs).toHaveLength(0);
  });

  it("não move o status do lead", async () => {
    semearLead();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    await simular(cookie);

    expect(db.getDoc("leads/ChIJa")?.status).toBe("contatado");
  });

  it("não cria grupo pendente — pula a janela de agrupamento inteira", async () => {
    semearLead();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    await simular(cookie);

    const grupos = await db.collection(FILA_RESPOSTAS_PENDENTES_COLLECTION).get();
    expect(grupos.docs).toHaveLength(0);
  });
});

describe("a simulação CONSOME cota", () => {
  it("cada clique reserva uma geração de IA, como o resto do app", async () => {
    semearLead();
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    await POST(postRequest({ leadId: "ChIJa", texto: "Oi!" }, cookie));
    expect(db.getDoc("usage/2026-03")?.aiGeneration).toBe(1);

    // Regenerar é outra geração — o botão "regenerar (mais 1)" não mente.
    await POST(postRequest({ leadId: "ChIJa", texto: "Oi!" }, cookie));
    expect(db.getDoc("usage/2026-03")?.aiGeneration).toBe(2);
  });

  it("cota estourada → 429 e NENHUMA chamada ao Gemini (reserva vem antes)", async () => {
    semearLead();
    db.seed("usage/2026-03", { aiGeneration: DEFAULT_CONFIG.caps.aiGeneration });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const res = await POST(postRequest({ leadId: "ChIJa", texto: "Oi!" }, cookie));

    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/config/fila/respostas/simular — o lead padrão", () => {
  it("devolve o leadContextoExcecao já escolhido no painel da fila", async () => {
    await saveFilaConfig(db, { leadContextoExcecao: "ChIJa" });
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    const corpo = await (await GET(getRequest(cookie))).json();

    expect(corpo).toEqual({ leadPadrao: "ChIJa" });
  });

  it("sem lead de contexto configurado, devolve vazio — a tela pede o placeId", async () => {
    const cookie = await cookieDeSessao(db, { id: "admin", papel: "admin" });

    expect(await (await GET(getRequest(cookie))).json()).toEqual({ leadPadrao: "" });
  });
});
