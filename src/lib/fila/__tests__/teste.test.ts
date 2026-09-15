import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";

import { RESERVA_DURACAO_MS } from "../envios";
import {
  CLAIM_TESTE_PREFIXO,
  FILA_TESTES_COLLECTION,
  FILA_TESTE_DOC,
  TESTE_VALIDADE_MS,
  confirmarTeste,
  ehClaimDeTeste,
  injetarTeste,
  lerTestePendente,
  marcarTesteEntregue,
} from "../teste";

/**
 * A TAREFA DE TESTE, pura: injetar, entregar UMA vez, expirar sozinha e
 * confirmar sem efeito colateral. Relógio congelado em tudo — "expira em 15
 * minutos" sem instante fixo é um teste que às vezes passa.
 */

const AGORA = new Date("2026-03-10T10:00:00Z");

function injecao(overrides: Partial<Parameters<typeof injetarTeste>[1]> = {}) {
  return {
    leadId: "radar-lead-teste",
    nome: "Barbearia Dom Aurélio",
    numero: "5544984570105",
    texto: "Oi, Barbearia Dom Aurélio!",
    printUrl: "https://storage/hero-cel.png",
    criadoPor: "admin-1",
    pulou: [],
    ...overrides,
  };
}

function novoDb(): FakeFirestore {
  return new FakeFirestore();
}

describe("claimId de teste", () => {
  it("tem prefixo próprio e não colide com o claimId real (12 chars base64url)", async () => {
    const db = novoDb();
    const doc = await injetarTeste(db, injecao(), AGORA);

    expect(doc.claimId.startsWith(CLAIM_TESTE_PREFIXO)).toBe(true);
    expect(doc.claimId).toHaveLength(CLAIM_TESTE_PREFIXO.length + 12);
    expect(ehClaimDeTeste(doc.claimId)).toBe(true);
  });

  it("um claimId de tamanho real nunca é lido como de teste", () => {
    // `randomBytes(9).toString("base64url")` — sempre 12 caracteres, e o
    // alfabeto inclui "-" e "_", então é o PREFIXO que separa os espaços.
    expect(ehClaimDeTeste("teAbCdEfGhIj")).toBe(false);
    expect(ehClaimDeTeste("t-e-s-t-e-Ab")).toBe(false);
  });
});

describe("tarefa de teste — validade de 15 minutos", () => {
  it("fica pendente enquanto está dentro do prazo", async () => {
    const db = novoDb();
    await injetarTeste(db, injecao(), AGORA);

    const quase = new Date(AGORA.getTime() + TESTE_VALIDADE_MS - 1000);
    expect(await lerTestePendente(db, quase)).toBeDefined();
  });

  it("some sozinha ao expirar — sem job de limpeza", async () => {
    const db = novoDb();
    await injetarTeste(db, injecao(), AGORA);

    const depois = new Date(AGORA.getTime() + TESTE_VALIDADE_MS + 1);
    expect(await lerTestePendente(db, depois)).toBeUndefined();
    // O doc continua lá: é o rastro de que houve um teste que ninguém puxou.
    expect(db.getDoc(`${FILA_TESTES_COLLECTION}/${FILA_TESTE_DOC}`)).toBeDefined();
  });

  it("expirada não pode mais ser entregue", async () => {
    const db = novoDb();
    const doc = await injetarTeste(db, injecao(), AGORA);

    const depois = new Date(AGORA.getTime() + TESTE_VALIDADE_MS + 1);
    expect(await marcarTesteEntregue(db, doc.claimId, depois)).toBeNull();
    expect(db.getDoc(`${FILA_TESTES_COLLECTION}/${FILA_TESTE_DOC}`)?.estado).toBe("pendente");
  });
});

describe("tarefa de teste — one-shot", () => {
  it("a segunda entrega da mesma claim devolve null", async () => {
    const db = novoDb();
    const doc = await injetarTeste(db, injecao(), AGORA);

    expect(await marcarTesteEntregue(db, doc.claimId, AGORA)).not.toBeNull();
    expect(await marcarTesteEntregue(db, doc.claimId, AGORA)).toBeNull();
  });

  it("a entrega devolve um expiraEm com a MESMA janela de uma claim real", async () => {
    const db = novoDb();
    const doc = await injetarTeste(db, injecao(), AGORA);

    const entregue = await marcarTesteEntregue(db, doc.claimId, AGORA);
    expect(entregue?.expiraEm).toBe(new Date(AGORA.getTime() + RESERVA_DURACAO_MS).toISOString());
  });

  it("injetar de novo sobrescreve: um aparelho, uma tarefa de teste por vez", async () => {
    const db = novoDb();
    const primeira = await injetarTeste(db, injecao(), AGORA);
    const segunda = await injetarTeste(db, injecao({ leadId: "ChIJoutro" }), AGORA);

    expect(segunda.claimId).not.toBe(primeira.claimId);
    const atual = db.getDoc(`${FILA_TESTES_COLLECTION}/${FILA_TESTE_DOC}`);
    expect(atual?.claimId).toBe(segunda.claimId);
    expect(atual?.leadId).toBe("ChIJoutro");
    // A claim antiga morre junto: confirmar com ela é 409 na rota.
    expect(await confirmarTeste(db, primeira.claimId, "enviado", null, AGORA)).toBeNull();
  });
});

describe("tarefa de teste — confirmação", () => {
  it("registra o resultado e o detalhe", async () => {
    const db = novoDb();
    const doc = await injetarTeste(db, injecao(), AGORA);
    await marcarTesteEntregue(db, doc.claimId, AGORA);

    const confirmacao = await confirmarTeste(db, doc.claimId, "enviado", "print não anexou", AGORA);

    expect(confirmacao).toEqual({ estado: "confirmado", resultado: "enviado", repetida: false });
    expect(db.getDoc(`${FILA_TESTES_COLLECTION}/${FILA_TESTE_DOC}`)).toMatchObject({
      estado: "confirmado",
      resultado: "enviado",
      detalhe: "print não anexou",
      confirmadoEm: AGORA.toISOString(),
    });
  });

  it("repetir a mesma confirmação devolve sucesso sem reescrever nada", async () => {
    const db = novoDb();
    const doc = await injetarTeste(db, injecao(), AGORA);
    await marcarTesteEntregue(db, doc.claimId, AGORA);
    await confirmarTeste(db, doc.claimId, "enviado", "primeiro", AGORA);

    const depois = new Date(AGORA.getTime() + 60_000);
    const repetida = await confirmarTeste(db, doc.claimId, "falhou", "segundo", depois);

    expect(repetida).toEqual({ estado: "confirmado", resultado: "enviado", repetida: true });
    expect(db.getDoc(`${FILA_TESTES_COLLECTION}/${FILA_TESTE_DOC}`)).toMatchObject({
      resultado: "enviado",
      detalhe: "primeiro",
      confirmadoEm: AGORA.toISOString(),
    });
  });

  it("claim que não é a atual devolve null (a rota traduz em 409)", async () => {
    const db = novoDb();
    await injetarTeste(db, injecao(), AGORA);

    expect(await confirmarTeste(db, "teste-naoexiste0", "enviado", null, AGORA)).toBeNull();
  });

  it("o ciclo inteiro não toca lead, contador de envios nem filaEnvios", async () => {
    const db = novoDb();
    const lead = { placeId: "radar-lead-teste", nome: "Barbearia Dom Aurélio", status: "novo" };
    const contador = { enviados: 4, envios: ["2026-03-10T09:00:00.000Z"], ultimoEventoEm: null };
    db.seed("leads/radar-lead-teste", lead);
    db.seed("filaContadores/2026-03-10", contador);

    const doc = await injetarTeste(db, injecao(), AGORA);
    await marcarTesteEntregue(db, doc.claimId, AGORA);
    await confirmarTeste(db, doc.claimId, "enviado", null, AGORA);

    expect(db.getDoc("leads/radar-lead-teste")).toEqual(lead);
    expect(db.getDoc("filaContadores/2026-03-10")).toEqual(contador);
    expect(db.getDoc("filaEnvios/radar-lead-teste")).toBeUndefined();
  });
});
