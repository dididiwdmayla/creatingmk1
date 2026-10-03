import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { idBuscaAutomacao, chavePar } from "@/lib/automacao/pares";
import type { ExecucaoAutomacao } from "@/lib/automacao/execucao";
import { regiaoCacheKey } from "@/lib/geo/geocode";
import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { POST as FINALIZAR } from "../automacao/finalizar/route";
import { POST as PASSO } from "../automacao/passo/route";
import { POST as PLANEJAR } from "../automacao/planejar/route";

/**
 * A automação do estoque de ponta a ponta pelas três rotas que o workflow
 * chama — FakeFirestore, `fetch` mockado (Places, Gemini, GitHub) e o
 * relógio congelado na madrugada do agendamento (06:30 UTC).
 */

const SEGREDO = "segredo-automacao";
const AGORA = new Date("2026-09-20T06:30:00.000Z");
const VIEWPORT = {
  low: { latitude: -23.5, longitude: -51.95 },
  high: { latitude: -23.38, longitude: -51.8 },
};

let db: FakeFirestore;
vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

const fetchMock = vi.fn();
/** O que o Gemini faz em cada chamada: responder do schema, ou falhar. */
let gemini: "ok" | "falha" = "ok";
/** Os lugares que a próxima página de Text Search devolve. */
let lugares: Array<Record<string, unknown>> = [];

/** Um valor VÁLIDO para o schema que a própria chamada mandou — serve a qualquer skin. */
function valorDoSchema(s: Record<string, unknown>): unknown {
  if (Array.isArray(s.enum)) return s.enum[0];
  if (s.type === "object") {
    const props = (s.properties ?? {}) as Record<string, Record<string, unknown>>;
    const chaves = (s.required as string[] | undefined) ?? Object.keys(props);
    return Object.fromEntries(chaves.map((k) => [k, valorDoSchema(props[k])]));
  }
  if (s.type === "array") {
    return Array.from({ length: (s.minItems as number | undefined) ?? 1 }, () =>
      valorDoSchema(s.items as Record<string, unknown>),
    );
  }
  if (s.type === "string") return typeof s.pattern === "string" && s.pattern.includes("#") ? "#8c4a2b" : "Texto gerado";
  if (s.type === "number" || s.type === "integer") return 1;
  return true;
}

function chamadasA(trecho: string) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes(trecho));
}

async function responder(url: string, init?: RequestInit): Promise<Response> {
  if (url.includes("generativelanguage")) {
    if (gemini === "falha") return new Response("indisponível", { status: 503 });
    const corpo = JSON.parse(String(init?.body));
    const json = valorDoSchema(corpo.generationConfig.responseJsonSchema);
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }),
      { status: 200 },
    );
  }
  if (url.includes("places:searchText")) {
    return new Response(JSON.stringify({ places: lugares }), { status: 200 });
  }
  if (url.includes("api.github.com")) return new Response(null, { status: 204 });
  throw new Error(`fetch inesperado: ${url}`);
}

function lugar(id: string, comTelefone = true) {
  return {
    id,
    displayName: { text: `Barbearia ${id}` },
    formattedAddress: "Rua A, 1 - Maringá, PR, Brasil",
    ...(comTelefone && { nationalPhoneNumber: "(44) 3222-0000", internationalPhoneNumber: "+55 44 3222-0000" }),
  };
}

function lead(id: string, extra: Partial<Lead> = {}): Lead {
  return {
    placeId: id,
    nome: `Barbearia ${id}`,
    endereco: "Rua A, 1 - Maringá, PR, Brasil",
    status: "novo",
    enriquecido: false,
    telefone: "(44) 3222-0000",
    telefoneIntl: "+55 44 3222-0000",
    busca: { nicho: "barbearia", regiao: "Maringá PR", em: "2026-09-01T00:00:00.000Z" },
    criadoEm: "2026-09-01T00:00:00.000Z",
    atualizadoEm: "2026-09-01T00:00:00.000Z",
    ...extra,
  } as Lead;
}

function semear(l: Lead) {
  db.seed(`leads/${l.placeId}`, l as unknown as Record<string, unknown>);
}

function config(extra: Record<string, unknown> = {}) {
  db.seed("config/automacao", { ativo: true, alvoEstoque: 3, ...extra });
}

/** Uma busca do OPERADOR — de onde saem os pares. */
function buscaOperador(id: string, nicho = "barbearia", regiao = "Maringá PR", criadaEm = "2026-09-01T00:00:00.000Z") {
  db.seed(`buscas/${id}`, {
    id,
    nome: id,
    nicho,
    regiao,
    cor: "#2f82e0",
    criadaEm,
    totalCriados: 0,
    totalExistentes: 0,
    userId: "admin",
  });
}

function req(path: string, body: unknown, auth: string | null = `Bearer ${SEGREDO}`) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth && { authorization: auth }) },
    body: JSON.stringify(body),
  });
}

const planejar = (body: unknown = { disparo: "schedule" }) => PLANEJAR(req("/api/automacao/planejar", body));
const passo = (execucaoId: string) => PASSO(req("/api/automacao/passo", { execucaoId }));
const finalizar = (body: unknown) => FINALIZAR(req("/api/automacao/finalizar", body));

/** O laço do workflow: planejar, passo até acabar, finalizar. */
async function rodar(): Promise<ExecucaoAutomacao> {
  const plano = await (await planejar()).json();
  if (plano.acao !== "executar") return db.getDoc(`automacaoExecucoes/${plano.execucaoId}`) as unknown as ExecucaoAutomacao;
  for (let i = 0; i < 200; i++) {
    const r = await (await passo(plano.execucaoId)).json();
    if (!r.temTrabalho) break;
  }
  return (await (await finalizar({ execucaoId: plano.execucaoId })).json()).execucao;
}

function leadSalvo(id: string): Lead {
  return db.getDoc(`leads/${id}`) as unknown as Lead;
}

beforeEach(() => {
  db = new FakeFirestore();
  db.seed(`geocache/${regiaoCacheKey("Maringá PR")}`, {
    regiao: "Maringá PR",
    endereco: "Maringá, PR, Brasil",
    location: { lat: -23.42, lng: -51.93 },
    viewport: VIEWPORT,
    criadoEm: "2026-07-01T00:00:00.000Z",
  });
  gemini = "ok";
  lugares = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation(responder);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AUTOMACAO_SECRET", SEGREDO);
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "chave-places");
  vi.stubEnv("GEMINI_API_KEY", "chave-gemini");
  vi.stubEnv("GITHUB_CAPTURAS_TOKEN", "token-gh");
  vi.stubEnv("GITHUB_CAPTURAS_REPO", "dono/radar");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("autenticação", () => {
  it("401 sem AUTOMACAO_SECRET no header (e nada é gravado)", async () => {
    config();
    for (const auth of [null, "Bearer errado", `Bearer ${SEGREDO}x`]) {
      expect((await PLANEJAR(req("/api/automacao/planejar", {}, auth))).status).toBe(401);
      expect((await PASSO(req("/api/automacao/passo", { execucaoId: "x" }, auth))).status).toBe(401);
      expect((await FINALIZAR(req("/api/automacao/finalizar", { erro: "x" }, auth))).status).toBe(401);
    }
    expect((await db.collection("automacaoExecucoes").get()).docs).toHaveLength(0);
  });

  it("503 quando a env não existe — fail-closed", async () => {
    vi.stubEnv("AUTOMACAO_SECRET", "");
    expect((await planejar()).status).toBe(503);
  });

  it("não aceita o CRON_SECRET nem a RADAR_DEVICE_KEY", async () => {
    vi.stubEnv("CRON_SECRET", "cron");
    vi.stubEnv("RADAR_DEVICE_KEY", "celular");
    expect((await PLANEJAR(req("/api/automacao/planejar", {}, "Bearer cron"))).status).toBe(401);
    expect((await PLANEJAR(req("/api/automacao/planejar", {}, "Bearer celular"))).status).toBe(401);
  });
});

describe("planejar — nada a fazer", () => {
  it("automação desligada: registra a execução com o motivo", async () => {
    db.seed("config/automacao", { ativo: false });
    const corpo = await (await planejar()).json();
    expect(corpo).toMatchObject({ acao: "nada" });
    expect(db.getDoc(`automacaoExecucoes/${corpo.execucaoId}`)).toMatchObject({
      estado: "nada_a_fazer",
      motivo: expect.stringContaining("desligada"),
    });
  });

  it("estoque ≥ alvo: nada é feito e o motivo é registrado", async () => {
    config({ alvoEstoque: 1 });
    // um lead PRONTO (manual, com print e fuso) já cobre o alvo
    semear(
      lead("pronto", {
        demo: { skinId: "barbearia-editorial", themeId: "creme", dados: {}, criadoEm: "x", atualizadoEm: "x" },
        horarios: { faixas: [], utcOffsetMinutes: -180, obtidoEm: "x" },
        capturas: {
          estado: "pronto",
          execucaoId: "e",
          pedidoEm: "x",
          imagens: [{ ancora: "hero", tela: "celular", ordem: 1, url: "u", largura: 1, altura: 1 }],
        },
      }),
    );
    semear(lead("candidato"));
    const corpo = await (await planejar()).json();
    expect(corpo).toMatchObject({ acao: "nada", motivo: "estoque 1 ≥ alvo 1" });
    const registro = db.getDoc(`automacaoExecucoes/${corpo.execucaoId}`);
    expect(registro).toMatchObject({ estado: "nada_a_fazer", estoqueAntes: { prontos: 1, total: 1 } });
    expect(leadSalvo("candidato").demo).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    // A trava é tomada ANTES da varredura das demos vencidas (que vem antes
    // do estoque) e liberada no "nada a fazer": nunca fica presa.
    expect(db.getDoc("automacao/trava")).toMatchObject({ execucaoId: "" });
  });
});

describe("planejar — quem entra no plano", () => {
  it("lead existente elegível vira unidade demo; reprovado, legado, contactado, sem telefone e nicho sem skin ficam fora", async () => {
    config({ alvoEstoque: 10 });
    semear(lead("ok"));
    semear(lead("reprovado", { automacaoReprovada: { em: "2026-09-10T00:00:00.000Z" } }));
    // 09/08 às 23h em São Paulo = 10/08 02h UTC: pelo fuso de SP ainda é LEGADO
    semear(lead("legado", { criadoEm: "2026-08-10T02:00:00.000Z" }));
    semear(lead("corte", { criadoEm: "2026-08-10T12:00:00.000Z" }));
    semear(lead("contactado", { seloContato: { userId: "u", em: "2026-09-02T00:00:00.000Z" } }));
    semear(lead("naFila"));
    db.seed("filaEnvios/naFila", { leadId: "naFila", estado: "reservado" });
    semear(lead("semtel", { telefone: undefined, telefoneIntl: undefined }));
    semear(lead("semskin", { busca: { nicho: "borracharia", regiao: "Maringá PR", em: "x" } }));

    const corpo = await (await planejar()).json();
    const plano = db.getDoc(`automacaoExecucoes/${corpo.execucaoId}`) as unknown as ExecucaoAutomacao;
    const leads = plano.unidades.filter((u) => u.tipo === "demo").map((u) => (u.tipo === "demo" ? u.leadId : ""));
    expect(leads.sort()).toEqual(["corte", "ok"]);
    // faltou (10 − 0 > 2): uma busca no fim do plano
    expect(plano.unidades.at(-1)?.tipo).toBe("busca");
  });

  it("lead reprovado nunca volta ao plano, mesmo depois de a demo ser apagada", async () => {
    config();
    semear(lead("rep", { automacaoReprovada: { em: "2026-09-10T00:00:00.000Z", por: "m1" } }));
    const execucao = await rodar();
    expect(execucao.demosCriadas).not.toContain("rep");
    expect(leadSalvo("rep").demo).toBeUndefined();
  });

  it("lead criado antes da data de corte nunca entra, e o corte é configurável", async () => {
    config({ corteLegado: "2026-09-05" });
    semear(lead("antigo", { criadoEm: "2026-09-01T00:00:00.000Z" }));
    const execucao = await rodar();
    expect(execucao.demosCriadas).toEqual([]);
    expect(leadSalvo("antigo").demo).toBeUndefined();
  });
});

describe("unidade demo", () => {
  it("cria pela criação do lote, rodízio de skin, origem automação, pendente, texto da IA — e enfileira as capturas", async () => {
    config({ alvoEstoque: 2 });
    semear(lead("a", { criadoEm: "2026-09-01T00:00:00.000Z" }));
    semear(lead("b", { criadoEm: "2026-09-02T00:00:00.000Z" }));

    const execucao = await rodar();

    expect(execucao.estado).toBe("concluida");
    expect(execucao.demosCriadas).toEqual(["a", "b"]);
    const a = leadSalvo("a");
    const b = leadSalvo("b");
    expect(a.demo).toMatchObject({
      origem: "automacao",
      aprovacao: "pendente",
      execucaoAutomacao: execucao.id,
      criadoPor: "automacao",
      skinId: "barbearia-editorial",
      themeId: "creme",
    });
    // rodízio: a segunda demo do mesmo nicho sai noutra combinação
    expect(b.demo?.themeId).toBe("meia-noite");
    // texto da IA aplicado; modo "foto" e efeito do preset não escrevem nada
    expect(a.demo?.dados.slogan).toBe("Texto gerado");
    expect(a.demo?.dados.imagensModo).toBeUndefined();
    expect(a.demo?.tema).toBeUndefined();
    expect(execucao.chamadasIA).toBe(2);
    // capturas: um lote, os dois leads, workflow disparado uma vez
    expect(chamadasA("api.github.com")).toHaveLength(1);
    expect(execucao.capturas).toEqual([expect.objectContaining({ leads: 2, enfileirados: 2 })]);
    expect(a.capturas?.estado).toBe("enfileirado");
    // o estoque depois conta as capturas a caminho
    expect(execucao.estoqueDepois).toMatchObject({ capturasEmAndamento: 2, total: 2 });
    expect(db.getDoc("automacao/trava")).toMatchObject({ execucaoId: "" });
  });

  it("falha da IA deixa a demo com o conteúdo de exemplo e registra o motivo", async () => {
    config({ alvoEstoque: 1 });
    semear(lead("a"));
    gemini = "falha";
    const execucao = await rodar();
    expect(execucao.demosCriadas).toEqual(["a"]);
    const demo = leadSalvo("a").demo;
    expect(demo?.origem).toBe("automacao");
    expect(demo?.dados.slogan).toBeUndefined();
    const unidade = execucao.unidades[0];
    expect(unidade).toMatchObject({ estado: "feita", ia: "falhou", iaMotivo: expect.stringContaining("503") });
  });

  it("texto por IA desligado: nenhuma chamada ao Gemini", async () => {
    config({ alvoEstoque: 1, textoIA: false });
    semear(lead("a"));
    const execucao = await rodar();
    expect(execucao.unidades[0]).toMatchObject({ ia: "desligada" });
    expect(chamadasA("generativelanguage")).toHaveLength(0);
  });

  it("aprovação automática ligada: aprova com telefone + horário, deixa pendente sem horário", async () => {
    config({ alvoEstoque: 2, aprovacaoAutomatica: true });
    semear(
      lead("comHorario", {
        horarios: {
          faixas: [{ diaAbre: 1, horaAbre: 9, minAbre: 0, diaFecha: 1, horaFecha: 18, minFecha: 0 }],
          obtidoEm: "x",
        },
      }),
    );
    semear(lead("semHorario", { criadoEm: "2026-09-03T00:00:00.000Z" }));
    await rodar();
    expect(leadSalvo("comHorario").demo).toMatchObject({ aprovacao: "aprovada", aprovacaoPor: "automacao" });
    expect(leadSalvo("semHorario").demo?.aprovacao).toBe("pendente");
  });

  it("aprovação automática DESLIGADA (padrão): nasce pendente mesmo passando no critério", async () => {
    config({ alvoEstoque: 1 });
    semear(lead("a", { horarios: { faixas: [{ diaAbre: 1, horaAbre: 9, minAbre: 0, diaFecha: 1, horaFecha: 18, minFecha: 0 }], obtidoEm: "x" } }));
    await rodar();
    expect(leadSalvo("a").demo?.aprovacao).toBe("pendente");
  });

  it("unidade repetida não cria demo duplicada nem gira o rodízio duas vezes", async () => {
    config({ alvoEstoque: 1, textoIA: false });
    semear(lead("a"));
    const { execucaoId } = await (await planejar()).json();
    await passo(execucaoId);
    const primeira = leadSalvo("a").demo;

    // A função "morreu" depois de gravar: a unidade volta a rodando, velha.
    const plano = db.getDoc(`automacaoExecucoes/${execucaoId}`) as unknown as ExecucaoAutomacao;
    plano.unidades[0] = { ...plano.unidades[0], estado: "rodando", iniciadaEm: "2026-09-20T06:00:00.000Z", tentativas: 1 };
    plano.demosCriadas = [];
    db.seed(`automacaoExecucoes/${execucaoId}`, plano as unknown as Record<string, unknown>);

    const r = await (await passo(execucaoId)).json();
    expect(r.unidade).toMatchObject({ estado: "feita", motivo: expect.stringContaining("retomada") });
    expect(leadSalvo("a").demo).toEqual(primeira);
    expect(db.getDoc("rodizioDemos/barbearia")).toMatchObject({ contador: 1 });
    const depois = db.getDoc(`automacaoExecucoes/${execucaoId}`) as unknown as ExecucaoAutomacao;
    expect(depois.demosCriadas).toEqual(["a"]);
  });

  it("lead que ganhou demo à mão entre o plano e a unidade é pulado", async () => {
    config({ alvoEstoque: 1 });
    semear(lead("a"));
    const { execucaoId } = await (await planejar()).json();
    const manual = { skinId: "barbearia2-sul", themeId: "marfim", dados: {}, criadoEm: "x", atualizadoEm: "x" };
    semear({ ...leadSalvo("a"), demo: manual });
    const r = await (await passo(execucaoId)).json();
    expect(r.unidade).toMatchObject({ estado: "pulada", motivo: "o lead já tem demo" });
    expect(leadSalvo("a").demo).toEqual(manual);
  });
});

describe("unidade busca", () => {
  it("par do operador, qualificada, só com telefone, quantidade = o que falta; doc do par reexecutado e leads novos viram demo", async () => {
    config({ alvoEstoque: 2, textoIA: false, intervaloParHoras: 20 });
    buscaOperador("op1", "Barbearia", "Maringá PR", "2026-09-01T00:00:00.000Z");
    buscaOperador("op2", "barbearia", "maringá  pr", "2026-09-02T00:00:00.000Z"); // mesmo par (sub-nicho/caixa)
    lugares = [lugar("novo1"), lugar("semtel", false), lugar("novo2"), lugar("novo3")];

    const execucao = await rodar();

    const buscas = chamadasA("places:searchText");
    expect(buscas).toHaveLength(1);
    const corpo = JSON.parse(String(buscas[0][1]?.body));
    // sem sub-nicho; o texto é o da busca MAIS RECENTE do operador no par
    expect(corpo.textQuery).toBe("barbearia maringá  pr");
    expect(corpo.pageSize).toBe(2);
    expect(String(buscas[0][1]?.headers && (buscas[0][1].headers as Record<string, string>)["X-Goog-FieldMask"])).toContain("websiteUri");
    // o que falta = 2 → 2 leads novos com telefone viram demo
    expect(execucao.demosCriadas.sort()).toEqual(["novo1", "novo2"]);
    expect(leadSalvo("semtel")).toBeUndefined();
    const id = idBuscaAutomacao(chavePar("barbearia", "Maringá PR"));
    expect(db.getDoc(`buscas/${id}`)).toMatchObject({ origem: "automacao", userId: "automacao", qualificada: true, soSemSite: true });
    const execs = (await db.collection(`buscas/${id}/execucoes`).get()).docs.map((d) => d.data());
    expect(execs).toEqual([expect.objectContaining({ novos: 2 })]);
    expect(execucao.requisicoesBusca).toBe(1);
    expect(execucao.buscas).toEqual([expect.objectContaining({ buscaId: id, novos: 2, paginas: 1 })]);
    // cota: global com atribuição à automação, nunca admin
    const uso = db.getDoc("usage/2026-09") as Record<string, unknown>;
    expect(uso.textSearchEnterprise).toBe(1);
    expect((uso.porUsuario as Record<string, Record<string, number>>).automacao.textSearchEnterprise).toBe(1);
    expect(db.getDoc("usage_users/automacao/dias/2026-09-20")).toMatchObject({ buscas: 1 });
  });

  it("nicho sem skin não é buscado", async () => {
    config({ alvoEstoque: 2 });
    buscaOperador("op1", "borracharia", "Maringá PR");
    const execucao = await rodar();
    expect(chamadasA("places:searchText")).toHaveLength(0);
    expect(execucao.unidades[0]).toMatchObject({ tipo: "busca", estado: "pulada", motivo: expect.stringContaining("nenhum par") });
  });

  it("par com execução do cron nas últimas horas não é buscado pela automação", async () => {
    config({ alvoEstoque: 2 });
    buscaOperador("op1");
    db.seed("buscas/op1", { ...db.getDoc("buscas/op1"), recorrente: true });
    db.seed("buscas/op1/execucoes/c1", { em: "2026-09-20T06:00:00.000Z", novos: 0, existentes: 3 });
    await rodar();
    expect(chamadasA("places:searchText")).toHaveLength(0);
  });

  it("par saturado (3 execuções com menos de 3 novos somados) sai do rodízio", async () => {
    config({ alvoEstoque: 2 });
    buscaOperador("op1");
    const id = idBuscaAutomacao(chavePar("barbearia", "Maringá PR"));
    db.seed(`buscas/${id}`, { id, nome: "a", nicho: "barbearia", regiao: "Maringá PR", cor: "#2f82e0", criadaEm: "2026-09-10T00:00:00.000Z", totalCriados: 1, totalExistentes: 0, origem: "automacao" });
    for (const [i, dia] of ["15", "16", "17"].entries()) {
      db.seed(`buscas/${id}/execucoes/e${i}`, { em: `2026-09-${dia}T06:30:00.000Z`, novos: i === 0 ? 1 : 0, existentes: 5 });
    }
    const execucao = await rodar();
    expect(chamadasA("places:searchText")).toHaveLength(0);
    expect(execucao.unidades[0].motivo).toContain("1 saturado");
  });
});

describe("tetos por noite", () => {
  it("IA: nunca passa do teto de chamadas — quem não coube fica sem texto, com o motivo", async () => {
    config({ alvoEstoque: 3, tetoIANoite: 3 });
    semear(lead("a", { criadoEm: "2026-09-01T00:00:00.000Z" }));
    semear(lead("b", { criadoEm: "2026-09-02T00:00:00.000Z" }));
    semear(lead("c", { criadoEm: "2026-09-03T00:00:00.000Z" }));
    const execucao = await rodar();
    expect(execucao.demosCriadas).toHaveLength(3);
    expect(chamadasA("generativelanguage").length).toBeLessThanOrEqual(3);
    expect(execucao.chamadasIA).toBeLessThanOrEqual(3);
    // Cada demo RESERVA o pior caso (2: a chamada e o retry) antes de chamar
    // e devolve o que não usou: a 1ª usa 1 (sobram 2), a 2ª cabe, a 3ª não.
    expect(execucao.unidades.map((u) => (u.tipo === "demo" ? u.ia : ""))).toEqual(["ok", "ok", "teto"]);
    expect(execucao.unidades[2]).toMatchObject({ iaMotivo: "teto de chamadas de IA da noite" });
  });

  it("busca: nunca passa do teto de requisições, mesmo faltando lead e sobrando par", async () => {
    config({ alvoEstoque: 10, textoIA: false, tetoBuscasNoite: 2 });
    buscaOperador("op1", "barbearia", "Maringá PR");
    buscaOperador("op2", "barbearia", "Sarandi PR");
    buscaOperador("op3", "petshop", "Maringá PR");
    db.seed(`geocache/${regiaoCacheKey("Sarandi PR")}`, { regiao: "Sarandi PR", endereco: "Sarandi", location: { lat: 0, lng: 0 }, viewport: VIEWPORT, criadoEm: "x" });
    lugares = [lugar("x1")];
    const execucao = await rodar();
    expect(chamadasA("places:searchText").length).toBeLessThanOrEqual(2);
    expect(execucao.requisicoesBusca).toBeLessThanOrEqual(2);
    expect(execucao.motivo).toContain("teto de requisições");
  });
});

describe("trava", () => {
  it("impede duas execuções simultâneas: a segunda é 409 e fica registrada como recusada", async () => {
    config({ alvoEstoque: 1 });
    semear(lead("a"));
    const primeira = await (await planejar()).json();
    const res = await planejar({ disparo: "workflow_dispatch" });
    expect(res.status).toBe(409);
    const segunda = await res.json();
    expect(segunda.error).toMatchObject({ code: "conflict", execucaoAtiva: primeira.execucaoId });
    expect(db.getDoc(`automacaoExecucoes/${segunda.error.execucaoId}`)).toMatchObject({ estado: "recusada" });
  });

  it("trava vencida (execução morta) é liberada para a próxima", async () => {
    config({ alvoEstoque: 1 });
    semear(lead("a"));
    db.seed("automacao/trava", { execucaoId: "morta", expiraEm: "2026-09-20T06:10:00.000Z" });
    const res = await planejar();
    expect(res.status).toBe(200);
    expect((await res.json()).acao).toBe("executar");
  });

  it("o passo de uma execução que perdeu a trava para outra é 409", async () => {
    config({ alvoEstoque: 1 });
    semear(lead("a"));
    const { execucaoId } = await (await planejar()).json();
    db.seed("automacao/trava", { execucaoId: "outra", expiraEm: "2026-09-20T07:00:00.000Z" });
    expect((await passo(execucaoId)).status).toBe(409);
  });
});

describe("finalizar", () => {
  it("enfileira as capturas em lotes de até 60", async () => {
    config({ alvoEstoque: 100, textoIA: false });
    for (let i = 0; i < 61; i++) {
      semear(lead(`l${String(i).padStart(2, "0")}`, { criadoEm: new Date(Date.UTC(2026, 8, 1, 12, i)).toISOString() }));
    }
    const execucao = await rodar();
    expect(execucao.demosCriadas).toHaveLength(61);
    const disparos = chamadasA("api.github.com").map(([, init]) => JSON.parse(String(init?.body)).client_payload.leads.split(","));
    expect(disparos.map((l: string[]) => l.length)).toEqual([60, 1]);
    expect(execucao.capturas).toEqual([
      expect.objectContaining({ leads: 60, enfileirados: 60 }),
      expect.objectContaining({ leads: 1, enfileirados: 1 }),
    ]);
  });

  it("com erro: grava a falha, marca o que não rodou e libera a trava", async () => {
    config({ alvoEstoque: 2 });
    semear(lead("a"));
    semear(lead("b", { criadoEm: "2026-09-02T00:00:00.000Z" }));
    const { execucaoId } = await (await planejar()).json();
    await passo(execucaoId);
    const { execucao } = await (await finalizar({ execucaoId, erro: "3 erros seguidos no passo" })).json();
    expect(execucao).toMatchObject({ estado: "falhou", erro: "3 erros seguidos no passo" });
    expect(execucao.unidades.map((u: { estado: string }) => u.estado)).toEqual(["feita", "nao_processada"]);
    // a demo que saiu ainda ganha captura
    expect(leadSalvo("a").capturas?.estado).toBe("enfileirado");
    expect(db.getDoc("automacao/trava")).toMatchObject({ execucaoId: "" });
  });

  it("sem execucaoId (o laço morreu antes do plano): grava uma execução falha mesmo assim", async () => {
    const { execucao } = await (await finalizar({ erro: "planejar respondeu 500", disparo: "schedule" })).json();
    expect(execucao).toMatchObject({ estado: "falhou", erro: "planejar respondeu 500" });
    expect(db.getDoc(`automacaoExecucoes/${execucao.id}`)).toMatchObject({ estado: "falhou" });
  });

  it("é idempotente", async () => {
    config({ alvoEstoque: 1, textoIA: false });
    semear(lead("a"));
    const { execucaoId } = await (await planejar()).json();
    await passo(execucaoId);
    const um = (await (await finalizar({ execucaoId })).json()).execucao;
    const dois = (await (await finalizar({ execucaoId })).json()).execucao;
    expect(dois).toEqual(um);
    expect(chamadasA("api.github.com")).toHaveLength(1);
  });
});
