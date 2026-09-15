import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TENTATIVAS_MAX } from "@/lib/fila/envios";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import type { Lead } from "@/lib/leads/types";
import { GET } from "../fila/proximo/route";
import { POST } from "../fila/confirmar/route";

/**
 * A confirmação fecha a tarefa. O que estes testes protegem é o "tudo ou
 * nada" do envio (claim + lead + rotação + contador) e as duas garantias de
 * que o executor no celular depende: 409 para claim velha, e repetir a mesma
 * confirmação não contar duas vezes.
 */

const CHAVE = "chave-do-celular";
const USER = "radar-device";
const TERCA_10H = new Date("2026-03-10T10:00:00Z");
const DIA = "filaContadores/2026-03-10";

let db: FakeFirestore;

vi.mock("@/lib/firebase/admin", () => ({ getDb: () => db }));

function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    busca: { nicho: "barbearia", regiao: "Maringá", em: "2026-03-01T00:00:00.000Z" },
    demo: { skinId: "barbearia-editorial" },
    horarios: { faixas: [], utcOffsetMinutes: 0, obtidoEm: "2026-03-01T00:00:00.000Z" },
    capturas: {
      estado: "pronto",
      execucaoId: "e1",
      pedidoEm: "2026-03-01T00:00:00.000Z",
      imagens: [{ ancora: "hero", tela: "celular", ordem: 1, url: "u", largura: 1, altura: 1 }],
    },
    criadoEm: "2026-03-01T00:00:00.000Z",
    atualizadoEm: "2026-03-01T00:00:00.000Z",
    ...overrides,
  } as Lead;
}

function semear(...leads: Lead[]) {
  for (const l of leads) db.seed(`leads/${l.placeId}`, l as unknown as Record<string, unknown>);
}

function pegarTarefa() {
  return GET(
    new Request("http://localhost/api/fila/proximo", {
      headers: { authorization: `Bearer ${CHAVE}` },
    }),
  ).then((r) => r.json());
}

function confirmar(corpo: unknown, chave = CHAVE) {
  return POST(
    new Request("http://localhost/api/fila/confirmar", {
      method: "POST",
      headers: { authorization: `Bearer ${chave}`, "content-type": "application/json" },
      body: JSON.stringify(corpo),
    }),
  );
}

beforeEach(() => {
  db = new FakeFirestore();
  vi.stubEnv("RADAR_DEVICE_KEY", CHAVE);
  vi.stubEnv("RADAR_DEVICE_USER_ID", USER);
  vi.useFakeTimers();
  vi.setSystemTime(TERCA_10H);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("POST /api/fila/confirmar — porta de entrada", () => {
  it("sem a chave correta devolve 401", async () => {
    expect((await confirmar({ id: "x", leadId: "y", resultado: "enviado" }, "errada")).status).toBe(401);
  });

  it("resultado fora do contrato é 400", async () => {
    const res = await confirmar({ id: "x", leadId: "y", resultado: "mandou_bem" });

    expect(res.status).toBe(400);
    expect((await res.json()).erro).toBe("corpo_invalido");
  });

  it("sem RADAR_DEVICE_USER_ID, falha fechado em 503", async () => {
    vi.stubEnv("RADAR_DEVICE_USER_ID", "");
    const res = await confirmar({ id: "x", leadId: "y", resultado: "enviado" });

    expect(res.status).toBe(503);
  });
});

describe("POST /api/fila/confirmar — 'enviado'", () => {
  async function enviar() {
    semear(lead("ChIJa"));
    db.seed("frasesProspeccao/barbearia-editorial", {
      frases: ["primeira", "segunda"],
      indice: 0,
    });
    const tarefa = await pegarTarefa();
    const res = await confirmar({ id: tarefa.id, leadId: "ChIJa", resultado: "enviado" });
    return { tarefa, res };
  }

  it("move os quatro docs de uma vez", async () => {
    const { res } = await enviar();

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, estado: "enviado", repetida: false });

    // 1. a claim
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({
      estado: "enviado",
      enviadoEm: TERCA_10H.toISOString(),
      ultimoErro: null,
    });
    // 2. o lead: status + selo + registro com a hora LOCAL dele
    const leadSalvo = db.getDoc("leads/ChIJa") as unknown as Lead;
    expect(leadSalvo.status).toBe("contactado");
    expect(leadSalvo.contato?.primeiroContatoPor).toBe(USER);
    expect(leadSalvo.seloContato).toEqual({ userId: USER, em: TERCA_10H.toISOString() });
    expect(leadSalvo.registrosEnvio).toEqual([
      { em: TERCA_10H.toISOString(), horaLocalLead: "10:00", diaSemanaLocalLead: 2 },
    ]);
    // 3. a rotação COMPARTILHADA girou (é o mesmo doc do clique manual)
    expect(db.getDoc("frasesProspeccao/barbearia-editorial")?.indice).toBe(1);
    // 4. o contador do dia operacional
    expect(db.getDoc(DIA)).toMatchObject({
      enviados: 1,
      envios: [TERCA_10H.toISOString()],
      ultimoEventoEm: TERCA_10H.toISOString(),
    });
  });

  it("confirmar duas vezes a mesma claim incrementa o contador uma vez só", async () => {
    const { tarefa } = await enviar();

    const repetida = await confirmar({ id: tarefa.id, leadId: "ChIJa", resultado: "enviado" });

    expect(repetida.status).toBe(200);
    expect(await repetida.json()).toMatchObject({ ok: true, repetida: true });
    expect(db.getDoc(DIA)).toMatchObject({ enviados: 1, envios: [TERCA_10H.toISOString()] });
    // E nada mais foi tocado: a rotação não girou de novo, o registro é um só.
    expect(db.getDoc("frasesProspeccao/barbearia-editorial")?.indice).toBe(1);
    expect((db.getDoc("leads/ChIJa") as unknown as Lead).registrosEnvio).toHaveLength(1);
  });

  // O TEXTO SAIU, O PRINT NÃO. A macro reporta "enviado" mesmo assim, de
  // propósito: reportar falha devolveria o lead à fila e a pessoa receberia
  // a mesma mensagem duas vezes. Estes três testes cobrem o único rastro
  // que sobra desse lead contactado sem a peça que vende.
  it("o detalhe de um envio com anexo falho fica em detalheEnvio", async () => {
    semear(lead("ChIJa"));
    const tarefa = await pegarTarefa();

    const res = await confirmar({
      id: tarefa.id,
      leadId: "ChIJa",
      resultado: "enviado",
      detalhe: "print não anexou",
    });

    expect(res.status).toBe(200);
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({
      estado: "enviado",
      detalheEnvio: "print não anexou",
      ultimoErro: null, // continua sendo campo de FALHA, e isto foi sucesso
    });
    // E o envio contou normalmente: a mensagem saiu.
    expect(db.getDoc(DIA)).toMatchObject({ enviados: 1 });
    expect((db.getDoc("leads/ChIJa") as unknown as Lead).status).toBe("contactado");
  });

  it("o detalhe é cortado em 300 caracteres — é diagnóstico, não log", async () => {
    semear(lead("ChIJa"));
    const tarefa = await pegarTarefa();

    await confirmar({
      id: tarefa.id,
      leadId: "ChIJa",
      resultado: "enviado",
      detalhe: "x".repeat(500),
    });

    expect(db.getDoc("filaEnvios/ChIJa")?.detalheEnvio).toBe("x".repeat(300));
  });

  it("repetir o confirmar não reescreve o detalhe já gravado", async () => {
    semear(lead("ChIJa"));
    const tarefa = await pegarTarefa();
    await confirmar({
      id: tarefa.id,
      leadId: "ChIJa",
      resultado: "enviado",
      detalhe: "print não anexou",
    });

    // A rede caiu depois do envio e o celular reenvia — com outro detalhe,
    // que é o pior caso: o caminho idempotente devolve 200 sem mudar NADA.
    const repetida = await confirmar({
      id: tarefa.id,
      leadId: "ChIJa",
      resultado: "enviado",
      detalhe: "tudo certo desta vez",
    });

    expect(await repetida.json()).toMatchObject({ ok: true, repetida: true });
    expect(db.getDoc("filaEnvios/ChIJa")?.detalheEnvio).toBe("print não anexou");
  });

  it("nunca rebaixa status: lead que já respondeu continua 'respondeu'", async () => {
    semear(lead("ChIJa"));
    const tarefa = await pegarTarefa();
    // Alguém do time avançou o lead à mão enquanto a mensagem saía.
    db.seed("leads/ChIJa", { ...db.getDoc("leads/ChIJa"), status: "respondeu" });

    await confirmar({ id: tarefa.id, leadId: "ChIJa", resultado: "enviado" });

    const leadSalvo = db.getDoc("leads/ChIJa") as unknown as Lead;
    expect(leadSalvo.status).toBe("respondeu");
    // Mas o disparo ficou registrado do mesmo jeito.
    expect(leadSalvo.registrosEnvio).toHaveLength(1);
  });

  it("mensagem sem rotação (grupo/global) não ganha doc de frases por causa do envio", async () => {
    // Skin sem conjunto salvo: a mensagem cai na global, que não tem rotação.
    semear(lead("ChIJa"));
    const tarefa = await pegarTarefa();

    await confirmar({ id: tarefa.id, leadId: "ChIJa", resultado: "enviado" });

    expect(db.getDoc("frasesProspeccao/barbearia-editorial")).toBeUndefined();
    expect(db.getDoc(DIA)).toMatchObject({ enviados: 1 });
  });

  it("poda o array de envios para as últimas 24h", async () => {
    semear(lead("ChIJa"));
    db.seed(DIA, {
      enviados: 5,
      envios: ["2026-03-08T10:00:00.000Z", "2026-03-10T09:00:00.000Z"], // o 1º tem 2 dias
      ultimoEventoEm: "2026-03-10T09:00:00.000Z",
    });
    db.seed("config/fila", { intervaloMinimoSegundos: 0, metaDiaria: 99, tetoPorHora: 99 });
    const tarefa = await pegarTarefa();

    await confirmar({ id: tarefa.id, leadId: "ChIJa", resultado: "enviado" });

    expect(db.getDoc(DIA)?.envios).toEqual([
      "2026-03-10T09:00:00.000Z",
      TERCA_10H.toISOString(),
    ]);
    expect(db.getDoc(DIA)?.enviados).toBe(6);
  });
});

describe("POST /api/fila/confirmar — 'invalido'", () => {
  it("marca o lead para nunca mais voltar à fila", async () => {
    semear(lead("ChIJa"));
    const tarefa = await pegarTarefa();

    const res = await confirmar({
      id: tarefa.id,
      leadId: "ChIJa",
      resultado: "invalido",
      detalhe: "numero nao tem whatsapp",
    });

    expect(res.status).toBe(200);
    expect((db.getDoc("leads/ChIJa") as unknown as Lead).telefoneInvalido).toBe(true);
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({
      estado: "invalido",
      ultimoErro: "numero nao tem whatsapp",
      tentativas: 0, // não é tentativa que pode dar certo depois
    });
    // `enviados` NÃO anda: não saiu mensagem nenhuma. Mas o dia operacional
    // passa a existir, com o resultado contado em `invalidos`.
    expect(db.getDoc(DIA)).toMatchObject({ enviados: 0, invalidos: 1 });
  });

  it("e o lead não é entregue de novo", async () => {
    semear(lead("ChIJa"));
    const tarefa = await pegarTarefa();
    await confirmar({ id: tarefa.id, leadId: "ChIJa", resultado: "invalido" });

    vi.setSystemTime(new Date(TERCA_10H.getTime() + 20 * 60 * 1000)); // pool vencido

    expect((await pegarTarefa()).motivo).toBe("sem_leads_elegiveis");
  });
});

describe("POST /api/fila/confirmar — 'falhou'", () => {
  it("libera a claim e conta a tentativa", async () => {
    semear(lead("ChIJa"));
    const tarefa = await pegarTarefa();

    const res = await confirmar({
      id: tarefa.id,
      leadId: "ChIJa",
      resultado: "falhou",
      detalhe: "whatsapp travou",
    });

    expect(await res.json()).toMatchObject({ estado: "falhou", tentativas: 1, parado: false });
    // `enviados` NÃO anda: não saiu mensagem nenhuma. Mas o dia operacional
    // passa a existir, com a tentativa contada em `falhas`.
    expect(db.getDoc(DIA)).toMatchObject({ enviados: 0, falhas: 1 });

    // Volta à fila na próxima varredura.
    vi.setSystemTime(new Date(TERCA_10H.getTime() + 20 * 60 * 1000));
    expect((await pegarTarefa()).leadId).toBe("ChIJa");
  });

  it("a partir de 3 tentativas o lead PARA, sem ser excluído nem invalidado", async () => {
    semear(lead("ChIJa"));
    db.seed("config/fila", { intervaloMinimoSegundos: 0 });

    let corpo;
    for (let i = 1; i <= TENTATIVAS_MAX; i++) {
      vi.setSystemTime(new Date(TERCA_10H.getTime() + i * 20 * 60 * 1000));
      const tarefa = await pegarTarefa();
      expect(tarefa?.leadId).toBe("ChIJa");
      corpo = await (await confirmar({ id: tarefa.id, leadId: "ChIJa", resultado: "falhou" })).json();
    }

    expect(corpo).toMatchObject({ tentativas: TENTATIVAS_MAX, parado: true });

    // Parado: não sai mais, mas continua inteiro na base e na coleção da fila.
    vi.setSystemTime(new Date(TERCA_10H.getTime() + 99 * 60 * 1000));
    expect((await pegarTarefa()).motivo).toBe("sem_leads_elegiveis");
    expect(db.getDoc("leads/ChIJa")).toBeDefined();
    expect((db.getDoc("leads/ChIJa") as unknown as Lead).telefoneInvalido).toBeUndefined();
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({
      estado: "falhou",
      tentativas: TENTATIVAS_MAX,
    });
  });
});

describe("POST /api/fila/confirmar — claim que não bate", () => {
  it("claimId velho devolve 409 e NÃO mexe no contador", async () => {
    semear(lead("ChIJa"));
    const tarefa = await pegarTarefa();
    // A claim expira e o lead é re-reservado antes de o celular travado voltar.
    vi.setSystemTime(new Date(TERCA_10H.getTime() + 20 * 60 * 1000));
    const nova = await pegarTarefa();
    expect(nova.id).not.toBe(tarefa.id);

    const res = await confirmar({ id: tarefa.id, leadId: "ChIJa", resultado: "enviado" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ erro: "claim_invalida" });
    expect(db.getDoc(DIA)).toBeUndefined();
    // A reserva NOVA continua intacta.
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({ estado: "reservado", claimId: nova.id });
    expect((db.getDoc("leads/ChIJa") as unknown as Lead).status).toBe("novo");
  });

  it("lead que nunca passou pela fila também é 409", async () => {
    const res = await confirmar({ id: "inventado", leadId: "ChIJnunca", resultado: "enviado" });

    expect(res.status).toBe(409);
  });
});

/**
 * REGRAS DE SEGURANÇA CONTRA COLAPSO — o painel da /config é editado por
 * uma pessoa enquanto o celular pode estar no meio de um ciclo. Nada que o
 * painel faça pode derrubar uma claim já emitida nem recusar a confirmação
 * de uma mensagem que JÁ SAIU.
 */
describe("POST /api/fila/confirmar — o painel mexeu na fila no meio do ciclo", () => {
  it("lead tirado da fila pelo painel (descartado) ainda confirma o envio", async () => {
    semear(lead("ChIJa"));
    const tarefa = await pegarTarefa();

    // O operador descarta o lead no painel DEPOIS de a tarefa ter saído — o
    // texto já pode estar no WhatsApp do negócio.
    db.seed("leads/ChIJa", {
      ...(db.getDoc("leads/ChIJa") as Record<string, unknown>),
      descartado: true,
    });

    const res = await confirmar({ id: tarefa.id, leadId: "ChIJa", resultado: "enviado" });

    // Recusar seria pior: o lead ficaria marcado como não contactado tendo
    // sido contactado, e o contador do dia não bateria com o que saiu.
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, estado: "enviado" });
    const leadSalvo = db.getDoc("leads/ChIJa") as unknown as Lead;
    expect(leadSalvo.status).toBe("contactado");
    // E o descarte do operador continua de pé — a confirmação não o desfaz.
    expect(leadSalvo.descartado).toBe(true);
    expect(db.getDoc(DIA)).toMatchObject({ enviados: 1 });
  });

  it("config mudada no meio do ciclo não invalida a claim: a confirmação passa igual", async () => {
    semear(lead("ChIJa"));
    const tarefa = await pegarTarefa();

    // Pausa, meta zerada e nichos restritos — tudo o que o painel edita.
    db.seed("config/fila", {
      ativo: false,
      metaDiaria: 0,
      nichosPermitidos: ["tatuagem"],
      exigirJanelaBoa: true,
    });

    const res = await confirmar({ id: tarefa.id, leadId: "ChIJa", resultado: "enviado" });

    expect(res.status).toBe(200);
    expect((db.getDoc("leads/ChIJa") as unknown as Lead).status).toBe("contactado");
  });
});
