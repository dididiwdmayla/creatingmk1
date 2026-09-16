import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";

import { RESERVA_DURACAO_MS } from "../envios";
import type { FilaTesteDoc } from "../estado";
import {
  CLAIM_TESTE_PREFIXO,
  FILA_TESTES_COLLECTION,
  FILA_TESTE_DOC,
  REPETICOES_TESTE_MAX,
  TESTE_VALIDADE_MS,
  cancelarRepeticoesTeste,
  confirmarTeste,
  ehClaimDeTeste,
  injetarTeste,
  lerTestePendente,
  marcarTesteEntregue,
  repeticoesRestantesEfetivas,
  repeticoesValidas,
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

/**
 * AUTO-REPEAT — o item novo: um campo de repetições no painel, para não ter
 * que rearmar dez vezes na mão. A regra de segurança central é que o REARME
 * só acontece na CONFIRMAÇÃO, nunca no disparo: um ciclo quebrado (o
 * aparelho travou, a confirmação nunca chegou) não pode virar laço infinito
 * de envios reais para `numeroTeste`.
 */

describe("repeticoesValidas — teto rígido do campo", () => {
  it("ausente vira 1 — o disparo de sempre, sem rearme automático", () => {
    expect(repeticoesValidas(undefined)).toBe(1);
  });

  it("aceita de 1 até o teto, inclusive as pontas", () => {
    expect(repeticoesValidas(1)).toBe(1);
    expect(repeticoesValidas(REPETICOES_TESTE_MAX)).toBe(REPETICOES_TESTE_MAX);
  });

  it("barra acima do teto — o campo é para operador distraído, não disparo em massa", () => {
    expect(repeticoesValidas(REPETICOES_TESTE_MAX + 1)).toBeUndefined();
    expect(repeticoesValidas(50)).toBeUndefined();
  });

  it("barra zero, negativo, fracionário e não-número", () => {
    expect(repeticoesValidas(0)).toBeUndefined();
    expect(repeticoesValidas(-1)).toBeUndefined();
    expect(repeticoesValidas(2.5)).toBeUndefined();
    expect(repeticoesValidas("10")).toBeUndefined();
  });
});

describe("injetarTeste — o campo de repetições congelado na injeção", () => {
  it("sem `repeticoes`, nasce com 1 total e 0 restantes — igual ao disparo de sempre", async () => {
    const db = novoDb();
    const doc = await injetarTeste(db, injecao(), AGORA);

    expect(doc.repeticoesTotal).toBe(1);
    expect(doc.repeticoesRestantes).toBe(0);
    expect(doc.repeticoesCanceladasEm).toBeNull();
  });

  it("com `repeticoes: 10`, nasce com 9 restantes — a primeira já é o ciclo 1 dos 10", async () => {
    const db = novoDb();
    const doc = await injetarTeste(db, injecao({ repeticoes: 10 }), AGORA);

    expect(doc.repeticoesTotal).toBe(10);
    expect(doc.repeticoesRestantes).toBe(9);
  });
});

describe("confirmarTeste — o rearme automático", () => {
  it("cada confirmação rearma e decrementa; a DÉCIMA confirmação não rearma mais", async () => {
    const db = novoDb();
    const primeira = await injetarTeste(db, injecao({ repeticoes: 10 }), AGORA);

    let claimId = primeira.claimId;
    const claimIds = new Set([claimId]);
    for (let ciclo = 1; ciclo <= 10; ciclo += 1) {
      await marcarTesteEntregue(db, claimId, AGORA);
      const confirmacao = await confirmarTeste(db, claimId, "enviado", null, AGORA);
      expect(confirmacao).toEqual({ estado: "confirmado", resultado: "enviado", repetida: false });

      const atual = db.getDoc(`${FILA_TESTES_COLLECTION}/${FILA_TESTE_DOC}`) as unknown as {
        estado: string;
        claimId: string;
        repeticoesRestantes: number;
      };
      if (ciclo < 10) {
        // Rearmou: um novo ciclo `pendente`, com claim NOVA e um a menos.
        expect(atual.estado).toBe("pendente");
        expect(atual.repeticoesRestantes).toBe(9 - ciclo);
        expect(atual.claimId).not.toBe(claimId);
        claimId = atual.claimId;
        claimIds.add(claimId);
      } else {
        // A décima: sem mais o que rearmar, para em "confirmado".
        expect(atual.estado).toBe("confirmado");
        expect(atual.repeticoesRestantes).toBe(0);
      }
    }
    expect(claimIds.size).toBe(10); // dez ciclos, dez claims distintas.
  });

  it("confirmação que NUNCA CHEGA não rearma — a regra de segurança central", async () => {
    const db = novoDb();
    const doc = await injetarTeste(db, injecao({ repeticoes: 3 }), AGORA);
    await marcarTesteEntregue(db, doc.claimId, AGORA);

    // Nenhuma chamada a `confirmarTeste`: o ciclo trava aqui, e é isto que
    // impede um ciclo quebrado de virar laço infinito de envios reais.
    const atual = db.getDoc(`${FILA_TESTES_COLLECTION}/${FILA_TESTE_DOC}`);
    expect(atual).toMatchObject({ estado: "entregue", claimId: doc.claimId, repeticoesRestantes: 2 });
  });

  it("expiração da tarefa REARMADA cancela junto as repetições que sobravam (sem escrita)", async () => {
    const db = novoDb();
    const primeira = await injetarTeste(db, injecao({ repeticoes: 3 }), AGORA);
    await marcarTesteEntregue(db, primeira.claimId, AGORA);
    await confirmarTeste(db, primeira.claimId, "enviado", null, AGORA); // rearma: ciclo 2, restam 1

    const rearmado = db.getDoc(`${FILA_TESTES_COLLECTION}/${FILA_TESTE_DOC}`) as unknown as {
      estado: string;
      claimId: string;
      repeticoesRestantes: number;
      expiraEm: string;
    };
    expect(rearmado.estado).toBe("pendente");
    expect(rearmado.repeticoesRestantes).toBe(1);

    const depoisDoPrazo = new Date(AGORA.getTime() + TESTE_VALIDADE_MS + 1);
    // O aparelho nunca puxou o ciclo rearmado — some sozinho, como sempre.
    expect(await marcarTesteEntregue(db, rearmado.claimId, depoisDoPrazo)).toBeNull();
    expect(await lerTestePendente(db, depoisDoPrazo)).toBeUndefined();

    // O doc CRU ainda guarda 1 (nada reescreve por expiração) — é a leitura
    // EFETIVA que já mostra 0, sem job de limpeza nenhum.
    expect(db.getDoc(`${FILA_TESTES_COLLECTION}/${FILA_TESTE_DOC}`)).toMatchObject({
      repeticoesRestantes: 1,
    });
    expect(repeticoesRestantesEfetivas(rearmado as unknown as FilaTesteDoc, depoisDoPrazo)).toBe(0);
  });

  it("dez ciclos de auto-repeat não sujam filaEnvios, o lead nem o contador do dia", async () => {
    const db = novoDb();
    const lead = { placeId: "radar-lead-teste", nome: "Barbearia Dom Aurélio", status: "novo" };
    const contador = { enviados: 4, envios: ["2026-03-10T09:00:00.000Z"], ultimoEventoEm: null };
    db.seed("leads/radar-lead-teste", lead);
    db.seed("filaContadores/2026-03-10", contador);

    let claimId = (await injetarTeste(db, injecao({ repeticoes: 10 }), AGORA)).claimId;
    for (let i = 0; i < 10; i += 1) {
      await marcarTesteEntregue(db, claimId, AGORA);
      await confirmarTeste(db, claimId, "enviado", null, AGORA);
      claimId = (db.getDoc(`${FILA_TESTES_COLLECTION}/${FILA_TESTE_DOC}`) as unknown as {
        claimId: string;
      }).claimId;
    }

    expect(db.getDoc("leads/radar-lead-teste")).toEqual(lead);
    expect(db.getDoc("filaContadores/2026-03-10")).toEqual(contador);
    expect(db.getDoc("filaEnvios/radar-lead-teste")).toBeUndefined();
  });
});

describe("cancelarRepeticoesTeste — mão única, a qualquer momento", () => {
  it("zera as restantes sem afetar a tarefa EM VOO (entregue, ainda sem confirmação)", async () => {
    const db = novoDb();
    const doc = await injetarTeste(db, injecao({ repeticoes: 4 }), AGORA);
    await marcarTesteEntregue(db, doc.claimId, AGORA); // em voo

    const cancelado = await cancelarRepeticoesTeste(db, AGORA);

    expect(cancelado).toMatchObject({
      claimId: doc.claimId,
      estado: "entregue",
      repeticoesRestantes: 0,
      repeticoesCanceladasEm: AGORA.toISOString(),
    });

    // A tarefa em voo confirma normalmente — só não rearma mais.
    const confirmacao = await confirmarTeste(db, doc.claimId, "enviado", null, AGORA);
    expect(confirmacao).toEqual({ estado: "confirmado", resultado: "enviado", repetida: false });
    expect(db.getDoc(`${FILA_TESTES_COLLECTION}/${FILA_TESTE_DOC}`)).toMatchObject({
      estado: "confirmado",
      repeticoesRestantes: 0,
    });
  });

  it("sem teste nenhum, devolve null", async () => {
    const db = novoDb();
    expect(await cancelarRepeticoesTeste(db, AGORA)).toBeNull();
  });

  it("quando já não resta nada, é idempotente e não inventa um cancelamento", async () => {
    const db = novoDb();
    const doc = await injetarTeste(db, injecao(), AGORA); // repeticoes=1 → 0 restantes

    const resultado = await cancelarRepeticoesTeste(db, AGORA);

    expect(resultado).toMatchObject({
      claimId: doc.claimId,
      repeticoesRestantes: 0,
      repeticoesCanceladasEm: null,
    });
  });
});
