import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FILA_CANDIDATOS_COLLECTION, FILA_CANDIDATOS_DOC } from "@/lib/fila/candidatos";
import {
  FILA_TESTES_COLLECTION,
  FILA_TESTE_DOC,
  TESTE_VALIDADE_MS,
  cancelarRepeticoesTeste,
  injetarTeste,
} from "@/lib/fila/teste";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import type { Lead } from "@/lib/leads/types";
import { GET } from "../fila/proximo/route";
import { POST } from "../fila/confirmar/route";

/**
 * O CICLO DA TAREFA DE TESTE pelas rotas que o aparelho de fato chama.
 *
 * O requisito duro é que o aparelho NÃO MUDE: a macro continua batendo em
 * `/proximo` e `/confirmar`, com o mesmo contrato, e só recebe — naquela
 * volta — a tarefa de teste em vez da normal. O que estes testes protegem é
 * isso, e a promessa que vem junto: o mesmo lead pode ser testado dez vezes
 * sem NENHUMA consequência (status, contador, rotação, selo, filaEnvios).
 */

const CHAVE = "chave-do-celular";
const USER = "radar-device";
const TERCA_10H = new Date("2026-03-10T10:00:00Z");
const NUMERO_TESTE = "5544984570105";
const DIA = "filaContadores/2026-03-10";
const TESTE_DOC = `${FILA_TESTES_COLLECTION}/${FILA_TESTE_DOC}`;

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
      imagens: [
        { ancora: "hero", tela: "celular", ordem: 1, url: "https://storage/hero.png", largura: 1, altura: 1 },
      ],
    },
    criadoEm: "2026-03-01T00:00:00.000Z",
    atualizadoEm: "2026-03-01T00:00:00.000Z",
    ...overrides,
  } as Lead;
}

function semear(...leads: Lead[]) {
  for (const l of leads) db.seed(`leads/${l.placeId}`, l as unknown as Record<string, unknown>);
}

function proximo() {
  return GET(
    new Request("http://localhost/api/fila/proximo", {
      headers: { authorization: `Bearer ${CHAVE}` },
    }),
  ).then((r) => r.json());
}

function confirmar(corpo: unknown) {
  return POST(
    new Request("http://localhost/api/fila/confirmar", {
      method: "POST",
      headers: { authorization: `Bearer ${CHAVE}`, "content-type": "application/json" },
      body: JSON.stringify(corpo),
    }),
  );
}

/** Injeta direto pelo módulo — a rota de injeção tem testes próprios. */
function injetar(leadId = "ChIJalvo", overrides: Record<string, unknown> = {}) {
  return injetarTeste(
    db,
    {
      leadId,
      nome: `Lead ${leadId}`,
      numero: NUMERO_TESTE,
      texto: "Oi! Fiz um site de exemplo pra você.",
      printUrl: "https://storage/hero.png",
      criadoPor: "admin-1",
      pulou: [],
      ...overrides,
    },
    new Date(),
  );
}

/** O pool é cache: entre cenários ele precisa sair do caminho. */
function esquecerPool() {
  db.deleteDoc(`${FILA_CANDIDATOS_COLLECTION}/${FILA_CANDIDATOS_DOC}`);
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

describe("GET /api/fila/proximo — a tarefa de teste", () => {
  it("sai pela MESMA rota, com `teste: true` e o contrato achatado intacto", async () => {
    semear(lead("ChIJalvo"));
    const injetada = await injetar();

    const corpo = await proximo();

    expect(corpo).toMatchObject({
      temTarefa: true,
      teste: true,
      id: injetada.claimId,
      leadId: "ChIJalvo",
      nome: "Lead ChIJalvo",
      numero: NUMERO_TESTE,
      printUrl: "https://storage/hero.png",
      motivo: "",
    });
    // Mesma janela de uma claim real: a chave significa a mesma coisa.
    expect(corpo.expiraEm).toBe(new Date(TERCA_10H.getTime() + 5 * 60 * 1000).toISOString());
  });

  it("o número é o `numeroTeste`, NUNCA o telefone do lead", async () => {
    semear(lead("ChIJalvo", { telefoneIntl: "+55 44 90000-0000" }));
    await injetar();

    const corpo = await proximo();

    expect(corpo.numero).toBe(NUMERO_TESTE);
    expect(corpo.numero).not.toBe("5544900000000");
  });

  it("vem ANTES do portão de ritmo — a fila pausada não engole o teste", async () => {
    db.seed("config/fila", { ativo: false, numeroTeste: NUMERO_TESTE });
    semear(lead("ChIJalvo"));
    await injetar();

    const corpo = await proximo();

    expect(corpo).toMatchObject({ temTarefa: true, teste: true, motivo: "" });
  });

  it("nem a meta atingida engole o teste", async () => {
    db.seed("config/fila", { metaDiaria: 1 });
    db.seed(DIA, { enviados: 9, envios: [], ultimoEventoEm: null });
    await injetar();

    expect(await proximo()).toMatchObject({ temTarefa: true, teste: true });
  });

  it("ONE-SHOT: a segunda volta já não traz o teste", async () => {
    await injetar();

    expect((await proximo()).teste).toBe(true);
    esquecerPool();
    const segunda = await proximo();
    expect(segunda.teste).toBe(false);
    expect(segunda.temTarefa).toBe(false);
  });

  it("expirada, some sozinha e a volta seguinte é a fila normal", async () => {
    semear(lead("ChIJreal"));
    await injetar("ChIJalvo");

    vi.setSystemTime(new Date(TERCA_10H.getTime() + TESTE_VALIDADE_MS + 1000));
    const corpo = await proximo();

    expect(corpo.teste).toBe(false);
    expect(corpo.leadId).toBe("ChIJreal");
    expect(db.getDoc(TESTE_DOC)?.estado).toBe("pendente");
  });

  it("não reserva claim, não move status e não encosta em filaEnvios", async () => {
    semear(lead("ChIJalvo"));
    const antes = db.getDoc("leads/ChIJalvo");
    await injetar();

    await proximo();

    expect(db.getDoc("filaEnvios/ChIJalvo")).toBeUndefined();
    expect(db.getDoc("leads/ChIJalvo")).toEqual(antes);
  });

  it("sem teste pendente, a chave `teste` é false e a fila real segue igual", async () => {
    semear(lead("ChIJreal"));

    const corpo = await proximo();

    expect(corpo).toMatchObject({ temTarefa: true, teste: false, leadId: "ChIJreal" });
    expect(db.getDoc("filaEnvios/ChIJreal")?.estado).toBe("reservado");
  });
});

describe("POST /api/fila/confirmar — a claim de teste", () => {
  async function ciclo(leadId = "ChIJalvo") {
    semear(lead(leadId));
    await injetar(leadId);
    return proximo();
  }

  it("aceita normalmente e registra o resultado", async () => {
    const tarefa = await ciclo();

    const res = await confirmar({
      id: tarefa.id,
      leadId: tarefa.leadId,
      resultado: "enviado",
      detalhe: "print não anexou",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, teste: true, estado: "enviado", repetida: false });
    expect(db.getDoc(TESTE_DOC)).toMatchObject({
      estado: "confirmado",
      resultado: "enviado",
      detalhe: "print não anexou",
    });
  });

  it("NÃO incrementa o contador do dia", async () => {
    db.seed(DIA, { enviados: 4, envios: ["2026-03-10T09:00:00.000Z"], ultimoEventoEm: "2026-03-10T09:00:00.000Z" });
    const antes = db.getDoc(DIA);
    const tarefa = await ciclo();

    await confirmar({ id: tarefa.id, leadId: tarefa.leadId, resultado: "enviado" });

    expect(db.getDoc(DIA)).toEqual(antes);
  });

  it("NÃO move o status do lead, não grava selo e não gira a rotação", async () => {
    db.seed("frasesProspeccao/barbearia-editorial", {
      skinId: "barbearia-editorial",
      frases: ["oi"],
      indice: 0,
    });
    const rotacaoAntes = db.getDoc("frasesProspeccao/barbearia-editorial");
    const tarefa = await ciclo();
    const leadAntes = db.getDoc("leads/ChIJalvo");

    await confirmar({ id: tarefa.id, leadId: tarefa.leadId, resultado: "enviado" });

    const depois = db.getDoc("leads/ChIJalvo");
    expect(depois).toEqual(leadAntes);
    expect(depois?.status).toBe("novo");
    expect(depois?.seloContato).toBeUndefined();
    expect(depois?.registrosEnvio).toBeUndefined();
    expect(db.getDoc("frasesProspeccao/barbearia-editorial")).toEqual(rotacaoAntes);
  });

  it("`invalido` não marca o telefone do lead como sem WhatsApp", async () => {
    const tarefa = await ciclo();

    await confirmar({ id: tarefa.id, leadId: tarefa.leadId, resultado: "invalido" });

    expect(db.getDoc("leads/ChIJalvo")?.telefoneInvalido).toBeUndefined();
    expect(db.getDoc(TESTE_DOC)?.resultado).toBe("invalido");
  });

  it("claim de teste que não é a atual devolve 409, como no caminho real", async () => {
    await ciclo();

    const res = await confirmar({ id: "teste-naoexiste0", leadId: "ChIJalvo", resultado: "enviado" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ erro: "claim_invalida" });
  });

  it("confirmar repetido devolve sucesso sem reescrever nada", async () => {
    const tarefa = await ciclo();
    await confirmar({ id: tarefa.id, leadId: tarefa.leadId, resultado: "enviado", detalhe: "primeiro" });

    const res = await confirmar({
      id: tarefa.id,
      leadId: tarefa.leadId,
      resultado: "falhou",
      detalhe: "segundo",
    });

    expect(await res.json()).toMatchObject({ ok: true, teste: true, repetida: true, estado: "enviado" });
    expect(db.getDoc(TESTE_DOC)).toMatchObject({ resultado: "enviado", detalhe: "primeiro" });
  });

  it("o caminho real continua respondendo `teste: false`", async () => {
    semear(lead("ChIJreal"));
    const tarefa = await proximo();

    const res = await confirmar({ id: tarefa.id, leadId: tarefa.leadId, resultado: "enviado" });

    expect(await res.json()).toMatchObject({ ok: true, teste: false, estado: "enviado" });
    expect(db.getDoc("leads/ChIJreal")?.status).toBe("contactado");
  });
});

describe("dez testes no mesmo lead", () => {
  it("não sujam filaEnvios, nem o lead, nem o contador", async () => {
    db.seed(DIA, { enviados: 4, envios: [], ultimoEventoEm: null });
    semear(lead("ChIJalvo"));
    const leadAntes = db.getDoc("leads/ChIJalvo");
    const contadorAntes = db.getDoc(DIA);

    for (let i = 0; i < 10; i += 1) {
      const injetada = await injetar("ChIJalvo");
      const tarefa = await proximo();
      expect(tarefa.teste).toBe(true);
      expect(tarefa.id).toBe(injetada.claimId);
      await confirmar({ id: tarefa.id, leadId: "ChIJalvo", resultado: "enviado" });
      esquecerPool();
    }

    expect(db.getDoc("filaEnvios/ChIJalvo")).toBeUndefined();
    expect(db.getDoc("leads/ChIJalvo")).toEqual(leadAntes);
    expect(db.getDoc(DIA)).toEqual(contadorAntes);
    // Sobrou UM doc de teste, não dez — o id é da claim atual, não do lead.
    expect(db.getDoc(TESTE_DOC)?.leadId).toBe("ChIJalvo");
  });
});

describe("auto-repeat — o servidor rearma sozinho a cada confirmação", () => {
  it("dez repetições pedidas de UMA VEZ: dez voltas de /proximo e /confirmar por elas mesmas", async () => {
    semear(lead("ChIJalvo"));
    const primeira = await injetar("ChIJalvo", { repeticoes: 10 });
    expect(primeira.repeticoesTotal).toBe(10);
    expect(primeira.repeticoesRestantes).toBe(9);

    for (let ciclo = 1; ciclo <= 10; ciclo += 1) {
      esquecerPool();
      const tarefa = await proximo();
      expect(tarefa.teste).toBe(true);
      const res = await confirmar({ id: tarefa.id, leadId: "ChIJalvo", resultado: "enviado" });
      expect(res.status).toBe(200);
    }

    // Zerou sozinho: nenhum rearme depois da décima confirmação.
    expect(db.getDoc(TESTE_DOC)).toMatchObject({ estado: "confirmado", repeticoesRestantes: 0 });
    // `ChIJalvo` também é um lead real elegível — não checamos a volta
    // SEGUINTE de propósito (ela cairia na fila normal e o reservaria de
    // verdade, o que provaria outra coisa); o que este teste protege é que
    // as DEZ voltas de teste, sozinhas, nunca tocaram `filaEnvios`.
    expect(db.getDoc("filaEnvios/ChIJalvo")).toBeUndefined();
  });

  it("cancelar no meio do ciclo impede o próximo rearme — a tarefa em voo segue seu curso", async () => {
    semear(lead("ChIJalvo"));
    await injetar("ChIJalvo", { repeticoes: 5 });

    const primeira = await proximo();
    expect(primeira.teste).toBe(true);

    const cancelado = await cancelarRepeticoesTeste(db, new Date());
    expect(cancelado).toMatchObject({ repeticoesRestantes: 0 });

    // A tarefa já entregue confirma normalmente — o cancelamento não a afeta.
    const res = await confirmar({ id: primeira.id, leadId: "ChIJalvo", resultado: "enviado" });
    expect(res.status).toBe(200);

    esquecerPool();
    const segunda = await proximo();
    expect(segunda.teste).toBe(false); // não rearmou
  });

  it("expirada sem ser puxada, a tarefa rearmada cancela as repetições que sobravam", async () => {
    semear(lead("ChIJalvo"));
    await injetar("ChIJalvo", { repeticoes: 3 });

    const primeira = await proximo();
    await confirmar({ id: primeira.id, leadId: "ChIJalvo", resultado: "enviado" }); // rearma

    expect(db.getDoc(TESTE_DOC)).toMatchObject({ estado: "pendente", repeticoesRestantes: 1 });

    vi.setSystemTime(new Date(TERCA_10H.getTime() + TESTE_VALIDADE_MS + 1000));
    esquecerPool();
    const depois = await proximo();

    // Some sozinha, como qualquer tarefa expirada — a volta seguinte não
    // traz teste nenhum (cai na fila normal, que é outro caminho já coberto
    // em "GET /api/fila/proximo — a tarefa de teste" acima).
    expect(depois.teste).toBe(false);
    expect(db.getDoc(TESTE_DOC)).toMatchObject({ estado: "pendente", repeticoesRestantes: 1 });
  });

  it("o contrato de /proximo e /confirmar não muda com o rearme", async () => {
    semear(lead("ChIJalvo"));
    await injetar("ChIJalvo", { repeticoes: 3 });

    const tarefa = await proximo();
    const res = await confirmar({ id: tarefa.id, leadId: "ChIJalvo", resultado: "enviado" });
    const corpoConfirmar = await res.json();

    expect(Object.keys(tarefa).sort()).toEqual(
      [
        "temTarefa",
        "tipo",
        "teste",
        "id",
        "leadId",
        "nome",
        "numero",
        "texto",
        "printUrl",
        "expiraEm",
        "motivo",
      ].sort(),
    );
    expect(Object.keys(corpoConfirmar).sort()).toEqual(
      ["ok", "teste", "estado", "repetida", "tentativas", "parado"].sort(),
    );
  });
});
