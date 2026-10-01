import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import type { AppDb } from "@/lib/firestore-like";
import type { Lead } from "@/lib/leads/types";

import { construirPool } from "../candidatos";
import { DEFAULT_FILA_CONFIG, validateFilaConfigPatch } from "../config";
import { confirmarEnvio } from "../confirmar";
import {
  EPOCH_ISO,
  TENTATIVAS_MAX,
  claimExpiradaSemConfirmacao,
  emRevisao,
  leadDisponivel,
  liberarClaim,
  reservarLead,
  type FilaEnvioDoc,
} from "../envios";
import { liberarRevisao, listarRevisao, marcarContactadoRevisao } from "../revisao";
import { confirmarTeste, injetarTeste, marcarTesteEntregue } from "../teste";
import { LEAD_TESTE_ID, leadDeTesteInicial } from "../leadTeste";

/**
 * Sem corte do legado (`""`): este arquivo testa OUTRAS regras, e os leads
 * dele são de março — antes do corte padrão. O corte tem testes próprios
 * (`fila-legado.route.test.ts`).
 */
const SEM_CORTE = "";

/**
 * A REVISÃO DE CLAIM NÃO CONFIRMADA — a proteção contra mensagem repetida
 * que não depende do aparelho (ver o bloco em `lib/fila/estado.ts`).
 *
 * Claim que venceu sem NENHUMA confirmação nunca volta sozinha: vai para
 * revisão, sem prazo, e só sai por ação do operador ou por uma confirmação
 * do próprio aparelho. Estes testes travam o que a regra promete e as duas
 * coisas que ela NÃO pode quebrar (falha reportada e claim de teste).
 */

/** Meio-dia UTC; a claim abaixo é reservada às 9h e expira às 9h05. */
const AGORA = new Date("2026-03-10T12:00:00Z");
const DIA = 24 * 60 * 60 * 1000;

function envio(overrides: Partial<FilaEnvioDoc> = {}): FilaEnvioDoc {
  return {
    leadId: "ChIJa",
    estado: "reservado",
    claimId: "c",
    reservadoEm: "2026-03-10T09:00:00.000Z",
    expiraEm: "2026-03-10T09:05:00.000Z",
    dispositivo: "android",
    tentativas: 0,
    ultimoErro: null,
    enviadoEm: null,
    ...overrides,
  };
}

function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    busca: { nicho: "Barbearia", regiao: "Maringá", em: "2026-03-01T00:00:00.000Z" },
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

describe("claim vencida SEM CONFIRMAÇÃO vai para revisão", () => {
  it("o silêncio é o que põe em revisão: reservado + prazo vencido + nunca confirmado", () => {
    const doc = envio();
    expect(claimExpiradaSemConfirmacao(doc, AGORA)).toBe(true);
    expect(emRevisao(doc, AGORA)).toBe(true);
    expect(leadDisponivel(doc, AGORA, TENTATIVAS_MAX)).toBe(false);
  });

  it("claim VIVA continua barrando por ser viva, não por revisão", () => {
    const viva = envio({ reservadoEm: AGORA.toISOString(), expiraEm: "2026-03-10T12:05:00.000Z" });
    expect(emRevisao(viva, AGORA)).toBe(false);
    expect(leadDisponivel(viva, AGORA, TENTATIVAS_MAX)).toBe(false);
  });

  it("a reserva de verdade recusa o lead em revisão — o portão que impede a duplicata", async () => {
    const db = new FakeFirestore();
    db.seed("filaEnvios/ChIJa", { ...envio() } as unknown as Record<string, unknown>);

    expect(await reservarLead(db, "ChIJa", "android", AGORA, { tentativasMax: TENTATIVAS_MAX })).toBeNull();
    // Recusar não pode reescrever a claim anterior.
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({ claimId: "c", estado: "reservado" });
  });

  it("o pool não oferece o lead em revisão, e a revisão não é motivo estrutural", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    db.seed("filaEnvios/ChIJa", { ...envio() } as unknown as Record<string, unknown>);

    const pool = await construirPool(db, AGORA, { corteLegado: SEM_CORTE });
    expect(pool.candidatos).toEqual([]);
    expect(pool.estrutural.status).toBe(0);
    expect(pool.lidos).toBe(1);
  });

  it("A JANELA ENTRE POOL E CLAIM: pool velho oferece, a reserva recusa", async () => {
    // O caso aritmético que o filtro do pool sozinho não pega — pool de 10min,
    // claim de 5min. Pool construído ANTES da expiração lista o lead; quem
    // recusa nos ~4 minutos seguintes é o portão da reserva.
    const db = new FakeFirestore();
    const reservadoEm = new Date("2026-03-10T12:01:00Z");
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);

    expect(await reservarLead(db, "ChIJa", "android", reservadoEm, { tentativasMax: TENTATIVAS_MAX })).not.toBeNull();

    // t+2min: o pool ainda lista o lead com a claim viva (claim viva não
    // barra no pool; quem decide é a transação da reserva).
    const poolCedo = await construirPool(db, new Date("2026-03-10T12:03:00Z"), { corteLegado: SEM_CORTE });
    expect(poolCedo.candidatos.map((c) => c.id)).toEqual(["ChIJa"]);

    // t+7min: a claim morreu em silêncio às 12h06 e o pool das 12h03 ainda
    // oferece o lead. Sem o portão da reserva, esta chamada mandaria a MESMA
    // mensagem uma segunda vez.
    const depois = new Date("2026-03-10T12:08:00Z");
    expect(await reservarLead(db, "ChIJa", "android", depois, { tentativasMax: TENTATIVAS_MAX })).toBeNull();
  });
});

describe("SEM PRAZO — a revisão nunca vence sozinha", () => {
  it("um dia, trinta dias, um ano depois: continua em revisão e a reserva recusa", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    db.seed("filaEnvios/ChIJa", { ...envio() } as unknown as Record<string, unknown>);

    for (const dias of [1, 30, 365]) {
      const depois = new Date(AGORA.getTime() + dias * DIA);
      expect(emRevisao(envio(), depois)).toBe(true);
      expect((await construirPool(db, depois, { corteLegado: SEM_CORTE })).candidatos).toEqual([]);
      expect(await reservarLead(db, "ChIJa", "android", depois, { tentativasMax: TENTATIVAS_MAX })).toBeNull();
      expect((await listarRevisao(db, depois)).total).toBe(1);
    }
  });

  it("`retencaoEnvioHoras` saiu da config: nem default, nem patch aceito", () => {
    expect("retencaoEnvioHoras" in DEFAULT_FILA_CONFIG).toBe(false);
    expect(() => validateFilaConfigPatch({ retencaoEnvioHoras: 12 })).toThrow();
  });
});

describe("`reservas`: quantas vezes o lead foi levado", () => {
  it("1 na primeira reserva, e soma a cada re-reserva", async () => {
    const db = new FakeFirestore();
    const primeira = await reservarLead(db, "ChIJa", "android", AGORA);
    expect(db.getDoc("filaEnvios/ChIJa")?.reservas).toBe(1);

    await liberarClaim(db, "ChIJa", primeira!.claimId);
    await reservarLead(db, "ChIJa", "android", new Date(AGORA.getTime() + 60_000));
    expect(db.getDoc("filaEnvios/ChIJa")?.reservas).toBe(2);
  });

  it("doc anterior ao contador conta pelo menos a reserva que já existiu", async () => {
    const db = new FakeFirestore();
    db.seed("filaEnvios/ChIJa", { ...envio({ estado: "falhou", tentativas: 1 }) } as unknown as Record<string, unknown>);

    await reservarLead(db, "ChIJa", "android", AGORA, { tentativasMax: TENTATIVAS_MAX });

    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({ reservas: 2, tentativas: 1 });
  });
});

describe("o RECORTE: claim confirmada como falha NÃO vai para revisão", () => {
  it('confirmação "falhou" deixa o doc fora da revisão', () => {
    const falhou = envio({ estado: "falhou", tentativas: 1, ultimoErro: "WhatsApp não abriu" });
    expect(claimExpiradaSemConfirmacao(falhou, AGORA)).toBe(false);
    expect(emRevisao(falhou, AGORA)).toBe(false);
  });

  it("a política de 3 tentativas segue INTACTA", () => {
    for (const tentativas of [0, 1, 2]) {
      expect(leadDisponivel(envio({ estado: "falhou", tentativas }), AGORA, TENTATIVAS_MAX)).toBe(true);
    }
    expect(leadDisponivel(envio({ estado: "falhou", tentativas: TENTATIVAS_MAX }), AGORA, TENTATIVAS_MAX)).toBe(false);
  });

  it("ponta a ponta: confirmar 'falhou' e o lead volta à fila na mesma hora", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);

    const reserva = await reservarLead(db, "ChIJa", "android", AGORA, { tentativasMax: TENTATIVAS_MAX });
    await confirmarEnvio(db, "ChIJa", reserva!.claimId, "falhou", {
      detalhe: "WhatsApp não abriu a conversa",
      userId: "u1",
      inicioDiaOperacionalHora: 0,
      now: AGORA,
    });

    // Aparelho FALOU: nada saiu, e o lead é reservável de novo no instante
    // seguinte.
    const depois = new Date(AGORA.getTime() + 1000);
    expect(emRevisao(db.getDoc("filaEnvios/ChIJa") as unknown as FilaEnvioDoc, depois)).toBe(false);
    const pool = await construirPool(db, depois, { corteLegado: SEM_CORTE });
    expect(pool.candidatos.map((c) => c.id)).toEqual(["ChIJa"]);
    expect(await reservarLead(db, "ChIJa", "android", depois, { tentativasMax: TENTATIVAS_MAX })).not.toBeNull();
  });

  it('"enviado" e "invalido" continuam terminais, como sempre foram', () => {
    for (const estado of ["enviado", "invalido"] as const) {
      const doc = envio({ estado });
      expect(emRevisao(doc, AGORA)).toBe(false);
      expect(leadDisponivel(doc, AGORA, TENTATIVAS_MAX)).toBe(false);
    }
  });
});

describe("claim DEVOLVIDA de propósito não é silêncio", () => {
  it("`liberarClaim` grava expiraEm <= reservadoEm, e isso é a invariante", async () => {
    const db = new FakeFirestore();
    const reserva = await reservarLead(db, "ChIJa", "android", AGORA);
    await liberarClaim(db, "ChIJa", reserva!.claimId);

    const doc = db.getDoc("filaEnvios/ChIJa") as unknown as FilaEnvioDoc;
    expect(doc.estado).toBe("reservado");
    expect(doc.expiraEm).toBe(EPOCH_ISO);
    expect(new Date(doc.expiraEm).getTime()).toBeLessThanOrEqual(new Date(doc.reservadoEm).getTime());

    // `/proximo` chama `liberarClaim` quando desiste ANTES de montar a tarefa
    // (lead sem print, sem telefone, marcador sem resolver): nada saiu, e o
    // servidor sabe. Pô-lo em revisão afirmaria um envio que nunca existiu.
    const depois = new Date(AGORA.getTime() + 60_000);
    expect(emRevisao(doc, depois)).toBe(false);
    expect(leadDisponivel(doc, depois, TENTATIVAS_MAX)).toBe(true);
  });

  it("uma reserva NOVA sempre nasce com expiraEm à frente de reservadoEm", async () => {
    const db = new FakeFirestore();
    await reservarLead(db, "ChIJa", "android", AGORA);
    const doc = db.getDoc("filaEnvios/ChIJa") as unknown as FilaEnvioDoc;
    expect(new Date(doc.expiraEm).getTime()).toBeGreaterThan(new Date(doc.reservadoEm).getTime());
  });
});

describe("CLAIM DE TESTE nunca põe o lead fixo em revisão", () => {
  /**
   * Duas camadas independentes, e o teste cobra as duas: a tarefa de teste
   * vive em `filaTestes/atual` (nunca escreve `filaEnvios`), e `construirPool`
   * pula `leadDeTeste === true`. Se a revisão enxergasse as claims de teste,
   * o PRIMEIRO teste prenderia o lead fixo para sempre e o recurso de teste
   * repetível morreria na primeira volta — daí as dez voltas seguidas.
   */
  it("dez ciclos de teste seguidos, e o lead fixo nunca vai para revisão", async () => {
    const db = new FakeFirestore();
    db.seed("leads/" + LEAD_TESTE_ID, leadDeTesteInicial() as unknown as Record<string, unknown>);
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);

    for (let volta = 0; volta < 10; volta += 1) {
      const now = new Date(AGORA.getTime() + volta * 60_000);
      const doc = await injetarTeste(
        db,
        {
          leadId: LEAD_TESTE_ID,
          nome: "Barbearia Dom Aurélio",
          numero: "5544984570105",
          texto: "oi",
          printUrl: "u",
          criadoPor: "admin",
          pulou: [],
        },
        now,
      );
      expect(await marcarTesteEntregue(db, doc.claimId, now)).not.toBeNull();
      // Nem mesmo confirmando: o caminho de teste não toca `filaEnvios`.
      await confirmarTeste(db, doc.claimId, "enviado", null, now);

      // 1ª camada: nenhuma claim de `filaEnvios` foi criada para o lead fixo.
      expect(db.getDoc(`filaEnvios/${LEAD_TESTE_ID}`)).toBeUndefined();
    }

    // 2ª camada: mesmo se uma claim silenciosa existisse ali, o lead fixo não
    // entra no pool — nem como candidato, nem em revisão.
    db.seed("filaEnvios/" + LEAD_TESTE_ID, {
      ...envio({ leadId: LEAD_TESTE_ID }),
    } as unknown as Record<string, unknown>);
    const pool = await construirPool(db, AGORA, { corteLegado: SEM_CORTE });
    expect(pool.candidatos.map((c) => c.id)).toEqual(["ChIJa"]);
    expect(pool.lidos).toBe(1); // o lead de teste não entra em contagem nenhuma
  });

  it("o disparo de teste não escreve em filaEnvios em nenhuma das três etapas", async () => {
    const db = new FakeFirestore();
    const escritas: string[] = [];
    const espiao: AppDb = {
      collection(name: string) {
        const real = db.collection(name);
        return {
          ...real,
          doc: (id: string) => {
            const ref = real.doc(id);
            return {
              ...ref,
              get: () => ref.get(),
              set: (data: Record<string, unknown>, opcoes?: { merge?: boolean }) => {
                escritas.push(`${name}/${id}`);
                return ref.set(data, opcoes);
              },
            };
          },
          get: () => real.get(),
        };
      },
      runTransaction: (fn) => db.runTransaction(fn),
    };

    const doc = await injetarTeste(
      espiao,
      {
        leadId: LEAD_TESTE_ID,
        nome: "Barbearia Dom Aurélio",
        numero: "5544984570105",
        texto: "oi",
        printUrl: "u",
        criadoPor: "admin",
        pulou: [],
      },
      AGORA,
    );
    await marcarTesteEntregue(espiao, doc.claimId, AGORA);
    await confirmarTeste(espiao, doc.claimId, "enviado", null, AGORA);

    expect(escritas.every((chave) => chave.startsWith("filaTestes/"))).toBe(true);
    expect(escritas.some((chave) => chave.startsWith("filaEnvios/"))).toBe(false);
  });
});

describe("as saídas da revisão mexem na fila de verdade", () => {
  it("LIBERAR: o lead volta ao POOL e à RESERVA — não só some da lista", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    db.seed("filaEnvios/ChIJa", { ...envio({ reservas: 1 }) } as unknown as Record<string, unknown>);

    expect((await listarRevisao(db, AGORA)).total).toBe(1);
    expect((await construirPool(db, AGORA, { corteLegado: SEM_CORTE })).candidatos).toEqual([]);

    expect(await liberarRevisao(db, "ChIJa", AGORA)).toEqual({ ok: true });

    expect((await listarRevisao(db, AGORA)).total).toBe(0);
    const pool = await construirPool(db, AGORA, { corteLegado: SEM_CORTE });
    expect(pool.candidatos.map((c) => c.id)).toEqual(["ChIJa"]);
    expect(await reservarLead(db, "ChIJa", "android", AGORA, { tentativasMax: TENTATIVAS_MAX })).not.toBeNull();
    expect(db.getDoc("filaEnvios/ChIJa")?.reservas).toBe(2);
  });

  it("MARCAR CONTACTADO: o lead sai da fila para sempre (status, não revisão)", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    db.seed("filaEnvios/ChIJa", { ...envio() } as unknown as Record<string, unknown>);

    expect(
      await marcarContactadoRevisao(db, "ChIJa", { userId: "u1", inicioDiaOperacionalHora: 0, now: AGORA }),
    ).toEqual({ ok: true });

    expect((await listarRevisao(db, AGORA)).total).toBe(0);
    const pool = await construirPool(db, AGORA, { corteLegado: SEM_CORTE });
    expect(pool.candidatos).toEqual([]);
    expect(pool.estrutural.status).toBe(1);
  });

  it("a recusa por claim ativa é decidida DENTRO da transação", async () => {
    // Dois operadores com a mesma lista aberta: um libera, o aparelho leva o
    // lead, e o segundo clica em cima da lista velha. A transação relê o doc,
    // vê a claim NOVA e viva, e recusa — em vez de atropelar um envio em curso.
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    db.seed("filaEnvios/ChIJa", { ...envio() } as unknown as Record<string, unknown>);
    expect((await listarRevisao(db, AGORA)).total).toBe(1);

    await liberarRevisao(db, "ChIJa", AGORA);
    const depois = new Date(AGORA.getTime() + 60_000);
    const nova = await reservarLead(db, "ChIJa", "android", depois, { tentativasMax: TENTATIVAS_MAX });
    expect(nova).not.toBeNull();

    for (const acao of [
      () => liberarRevisao(db, "ChIJa", depois),
      () => marcarContactadoRevisao(db, "ChIJa", { userId: "u1", inicioDiaOperacionalHora: 0, now: depois }),
    ]) {
      expect(await acao()).toEqual({ ok: false, motivo: "claim_ativa", expiraEm: nova!.expiraEm });
    }
    // A claim nova fica intacta — o aparelho pode estar enviando agora.
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({ claimId: nova!.claimId, estado: "reservado" });
    expect(db.getDoc("leads/ChIJa")?.status).toBe("novo");
  });
});
