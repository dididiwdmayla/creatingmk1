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
  leadDisponivel,
  liberarClaim,
  retencaoMsDeHoras,
  retencaoVenceEm,
  reservarLead,
  retidoPorEnvio,
  type FilaEnvioDoc,
} from "../envios";
import { liberarRetido, listarRetidos } from "../retidos";
import { confirmarTeste, injetarTeste, marcarTesteEntregue } from "../teste";
import { LEAD_TESTE_ID, leadDeTesteInicial } from "../leadTeste";

/**
 * A RETENÇÃO POR CLAIM NÃO CONFIRMADA — a proteção contra mensagem repetida
 * que não depende do aparelho (ver o bloco em `lib/fila/estado.ts`).
 *
 * O caso real: o ciclo rodou inteiro, `/confirmar` respondeu 503, a macro não
 * repetiu, a claim expirou, o lead voltou ao pool e recebeu a MESMA mensagem.
 * Estes testes travam as quatro coisas que a correção promete e as duas que
 * ela NÃO pode quebrar (falha reportada e claim de teste).
 */

const RETENCAO_MS = retencaoMsDeHoras(12);
/** Meio-dia UTC; a claim abaixo é reservada às 9h e expira às 9h05. */
const AGORA = new Date("2026-03-10T12:00:00Z");

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

describe("claim expirada SEM CONFIRMAÇÃO retém o lead pela janela configurada", () => {
  it("o silêncio é o que retém: reservado + prazo vencido + nunca confirmado", () => {
    const doc = envio();
    expect(claimExpiradaSemConfirmacao(doc, AGORA)).toBe(true);
    expect(retidoPorEnvio(doc, AGORA, RETENCAO_MS)).toBe(true);
    // Sem a retenção, a regra antiga dizia LIVRE — é essa que está invertida.
    expect(leadDisponivel(doc, AGORA, TENTATIVAS_MAX)).toBe(true);
    expect(leadDisponivel(doc, AGORA, TENTATIVAS_MAX, RETENCAO_MS)).toBe(false);
  });

  it("a janela conta de `reservadoEm`, não de `expiraEm` — é quando a mensagem saiu", () => {
    const doc = envio();
    expect(retencaoVenceEm(doc, AGORA, RETENCAO_MS)).toBe("2026-03-10T21:00:00.000Z");
  });

  it("claim VIVA continua barrando por ser viva, não por retenção", () => {
    const viva = envio({ reservadoEm: AGORA.toISOString(), expiraEm: "2026-03-10T12:05:00.000Z" });
    expect(claimExpiradaSemConfirmacao(viva, AGORA)).toBe(false);
    expect(leadDisponivel(viva, AGORA, TENTATIVAS_MAX, RETENCAO_MS)).toBe(false);
  });

  it("a reserva de verdade recusa o lead retido — o portão que impede a duplicata", async () => {
    const db = new FakeFirestore();
    db.seed("filaEnvios/ChIJa", { ...envio() } as unknown as Record<string, unknown>);

    const semRetencao = await reservarLead(db, "ChIJa", "android", AGORA, {
      tentativasMax: TENTATIVAS_MAX,
    });
    expect(semRetencao).not.toBeNull(); // a regra antiga, para contraste

    db.seed("filaEnvios/ChIJb", { ...envio({ leadId: "ChIJb" }) } as unknown as Record<
      string,
      unknown
    >);
    const comRetencao = await reservarLead(db, "ChIJb", "android", AGORA, {
      tentativasMax: TENTATIVAS_MAX,
      retencaoMs: RETENCAO_MS,
    });
    expect(comRetencao).toBeNull();
    // Recusar não pode reescrever a claim anterior.
    expect(db.getDoc("filaEnvios/ChIJb")).toMatchObject({ claimId: "c", estado: "reservado" });
  });

  it("o pool não oferece o lead retido, e o oferece sem a retenção ligada", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    db.seed("filaEnvios/ChIJa", { ...envio() } as unknown as Record<string, unknown>);

    const sem = await construirPool(db, AGORA);
    expect(sem.candidatos.map((c) => c.id)).toEqual(["ChIJa"]);

    const com = await construirPool(db, AGORA, { retencaoMs: RETENCAO_MS });
    expect(com.candidatos).toEqual([]);
    // Retenção NÃO é motivo estrutural: o lead passou na peneira do lead.
    expect(com.estrutural.status).toBe(0);
    expect(com.lidos).toBe(1);
  });

  it("A JANELA ENTRE POOL E CLAIM: pool velho oferece, a reserva recusa", async () => {
    // O caso aritmético que o filtro do pool sozinho não pega — pool de 10min,
    // claim de 5min. Pool construído ANTES da expiração lista o lead; quem
    // recusa nos ~4 minutos seguintes é o portão da reserva.
    const db = new FakeFirestore();
    const reservadoEm = new Date("2026-03-10T12:01:00Z");
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);

    const reserva = await reservarLead(db, "ChIJa", "android", reservadoEm, {
      tentativasMax: TENTATIVAS_MAX,
      retencaoMs: RETENCAO_MS,
    });
    expect(reserva).not.toBeNull();

    // t+2min: o pool é construído e AINDA LISTA o lead, mesmo com a claim
    // viva — é a regra declarada de `envioImpedePool` ("claim viva não barra
    // aqui; quem decide é a transação da reserva"). É justamente isso que
    // deixa o pool oferecer, depois, um lead cuja claim já morreu.
    const poolCedo = await construirPool(db, new Date("2026-03-10T12:03:00Z"), {
      retencaoMs: RETENCAO_MS,
    });
    expect(poolCedo.candidatos.map((c) => c.id)).toEqual(["ChIJa"]);

    // t+7min: a claim expirou em silêncio às 12h06 e o pool das 12h03 ainda
    // está dentro do TTL (10min) — `ordenarCandidatos` roda sobre essa lista
    // velha e oferece o lead de novo. Sem o portão da reserva, esta é a
    // chamada que mandaria a MESMA mensagem uma segunda vez.
    const depois = new Date("2026-03-10T12:08:00Z");
    expect(
      await reservarLead(db, "ChIJa", "android", depois, {
        tentativasMax: TENTATIVAS_MAX,
        retencaoMs: RETENCAO_MS,
      }),
    ).toBeNull();
  });
});

describe("o RECORTE: claim confirmada como falha NÃO retém", () => {
  it('confirmação "falhou" deixa o doc fora da retenção', () => {
    const falhou = envio({ estado: "falhou", tentativas: 1, ultimoErro: "WhatsApp não abriu" });
    expect(claimExpiradaSemConfirmacao(falhou, AGORA)).toBe(false);
    expect(retidoPorEnvio(falhou, AGORA, RETENCAO_MS)).toBe(false);
  });

  it("a política de 3 tentativas segue INTACTA com a retenção ligada", () => {
    for (const tentativas of [0, 1, 2]) {
      const doc = envio({ estado: "falhou", tentativas });
      expect(leadDisponivel(doc, AGORA, TENTATIVAS_MAX, RETENCAO_MS)).toBe(true);
    }
    const esgotado = envio({ estado: "falhou", tentativas: TENTATIVAS_MAX });
    expect(leadDisponivel(esgotado, AGORA, TENTATIVAS_MAX, RETENCAO_MS)).toBe(false);
  });

  it("ponta a ponta: confirmar 'falhou' e o lead volta à fila na mesma hora", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);

    const reserva = await reservarLead(db, "ChIJa", "android", AGORA, {
      tentativasMax: TENTATIVAS_MAX,
      retencaoMs: RETENCAO_MS,
    });
    await confirmarEnvio(db, "ChIJa", reserva!.claimId, "falhou", {
      detalhe: "WhatsApp não abriu a conversa",
      userId: "u1",
      inicioDiaOperacionalHora: 0,
      now: AGORA,
    });

    // Aparelho FALOU: nada saiu, e o lead é reservável de novo no instante
    // seguinte — nenhuma espera de 12h.
    const depois = new Date(AGORA.getTime() + 1000);
    expect(retidoPorEnvio(db.getDoc("filaEnvios/ChIJa") as unknown as FilaEnvioDoc, depois, RETENCAO_MS)).toBe(false);
    const pool = await construirPool(db, depois, { retencaoMs: RETENCAO_MS });
    expect(pool.candidatos.map((c) => c.id)).toEqual(["ChIJa"]);
    expect(
      await reservarLead(db, "ChIJa", "android", depois, {
        tentativasMax: TENTATIVAS_MAX,
        retencaoMs: RETENCAO_MS,
      }),
    ).not.toBeNull();
  });

  it('"enviado" e "invalido" continuam terminais, como sempre foram', () => {
    for (const estado of ["enviado", "invalido"] as const) {
      const doc = envio({ estado });
      expect(claimExpiradaSemConfirmacao(doc, AGORA)).toBe(false);
      expect(leadDisponivel(doc, AGORA, TENTATIVAS_MAX, RETENCAO_MS)).toBe(false);
    }
  });
});

describe("claim DEVOLVIDA de propósito não é silêncio", () => {
  it("`liberarClaim` grava expiraEm <= reservadoEm, e isso é a invariante", async () => {
    const db = new FakeFirestore();
    const reserva = await reservarLead(db, "ChIJa", "android", AGORA);
    await liberarClaim(db, "ChIJa", reserva!.claimId);

    const doc = db.getDoc("filaEnvios/ChIJa") as unknown as FilaEnvioDoc;
    // A invariante que separa os dois casos, pinada no doc real.
    expect(doc.estado).toBe("reservado");
    expect(doc.expiraEm).toBe(EPOCH_ISO);
    expect(new Date(doc.expiraEm).getTime()).toBeLessThanOrEqual(
      new Date(doc.reservadoEm).getTime(),
    );

    // `/proximo` chama `liberarClaim` quando desiste ANTES de montar a tarefa
    // (lead sem print, sem telefone): nada saiu, e o servidor sabe. Retê-lo
    // afirmaria um envio que nunca existiu.
    const depois = new Date(AGORA.getTime() + 60_000);
    expect(claimExpiradaSemConfirmacao(doc, depois)).toBe(false);
    expect(retidoPorEnvio(doc, depois, RETENCAO_MS)).toBe(false);
    expect(leadDisponivel(doc, depois, TENTATIVAS_MAX, RETENCAO_MS)).toBe(true);
  });

  it("uma reserva NOVA sempre nasce com expiraEm à frente de reservadoEm", async () => {
    const db = new FakeFirestore();
    await reservarLead(db, "ChIJa", "android", AGORA);
    const doc = db.getDoc("filaEnvios/ChIJa") as unknown as FilaEnvioDoc;
    expect(new Date(doc.expiraEm).getTime()).toBeGreaterThan(
      new Date(doc.reservadoEm).getTime(),
    );
  });
});

describe("retenção VENCIDA devolve o lead ao pool", () => {
  it("um segundo antes retém; um segundo depois, não", () => {
    const doc = envio();
    const venceEm = new Date(retencaoVenceEm(doc, AGORA, RETENCAO_MS)!).getTime();

    const antes = new Date(venceEm - 1000);
    expect(retidoPorEnvio(doc, antes, RETENCAO_MS)).toBe(true);
    expect(leadDisponivel(doc, antes, TENTATIVAS_MAX, RETENCAO_MS)).toBe(false);

    // No instante EXATO do vencimento já está livre: a janela é [início, fim).
    const noPonto = new Date(venceEm);
    expect(retidoPorEnvio(doc, noPonto, RETENCAO_MS)).toBe(false);
    expect(leadDisponivel(doc, noPonto, TENTATIVAS_MAX, RETENCAO_MS)).toBe(true);
  });

  it("vencida, o pool oferece e a reserva aceita de novo", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    db.seed("filaEnvios/ChIJa", { ...envio() } as unknown as Record<string, unknown>);

    const depois = new Date("2026-03-10T21:00:01Z"); // 12h01 depois da reserva
    const pool = await construirPool(db, depois, { retencaoMs: RETENCAO_MS });
    expect(pool.candidatos.map((c) => c.id)).toEqual(["ChIJa"]);

    const reserva = await reservarLead(db, "ChIJa", "android", depois, {
      tentativasMax: TENTATIVAS_MAX,
      retencaoMs: RETENCAO_MS,
    });
    expect(reserva).not.toBeNull();
    // A reserva nova recarimba `reservadoEm`: a janela reinicia do envio NOVO.
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({ reservadoEm: depois.toISOString() });
  });

  it("`retencaoEnvioHoras: 0` desliga a retenção e devolve a regra antiga", async () => {
    expect(retencaoMsDeHoras(0)).toBe(0);
    const doc = envio();
    expect(retidoPorEnvio(doc, AGORA, 0)).toBe(false);
    expect(retencaoVenceEm(doc, AGORA, 0)).toBeUndefined();
    expect(leadDisponivel(doc, AGORA, TENTATIVAS_MAX, 0)).toBe(true);
  });

  it("horas negativas ou não finitas nunca viram janela (nem negativa, nem NaN)", () => {
    for (const horas of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(retencaoMsDeHoras(horas)).toBe(0);
    }
  });
});

describe("a config da retenção", () => {
  it("padrão 12 horas", () => {
    expect(DEFAULT_FILA_CONFIG.retencaoEnvioHoras).toBe(12);
    expect(retencaoMsDeHoras(DEFAULT_FILA_CONFIG.retencaoEnvioHoras)).toBe(12 * 60 * 60 * 1000);
  });

  it("aceita inteiro ≥ 0 e recusa o resto", () => {
    expect(() => validateFilaConfigPatch({ retencaoEnvioHoras: 0 })).not.toThrow();
    expect(() => validateFilaConfigPatch({ retencaoEnvioHoras: 24 })).not.toThrow();
    expect(() => validateFilaConfigPatch({ retencaoEnvioHoras: -1 })).toThrow();
    expect(() => validateFilaConfigPatch({ retencaoEnvioHoras: 1.5 })).toThrow();
    expect(() => validateFilaConfigPatch({ retencaoEnvioHoras: "12" })).toThrow();
  });
});

describe("CLAIM DE TESTE não retém o lead fixo de teste", () => {
  /**
   * Duas camadas independentes, e o teste cobra as duas: a tarefa de teste
   * vive em `filaTestes/atual` (nunca escreve `filaEnvios`), e `construirPool`
   * pula `leadDeTeste === true`. Se a retenção enxergasse as claims de teste,
   * o PRIMEIRO teste bloquearia o lead fixo por 12h e o recurso de teste
   * repetível morreria na primeira volta — daí as dez voltas seguidas.
   */
  it("dez ciclos de teste seguidos, e o lead fixo nunca é retido", async () => {
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
    // entra no pool — nem como candidato, nem como retido.
    db.seed("filaEnvios/" + LEAD_TESTE_ID, {
      ...envio({ leadId: LEAD_TESTE_ID }),
    } as unknown as Record<string, unknown>);
    const pool = await construirPool(db, AGORA, { retencaoMs: RETENCAO_MS });
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

describe("liberação manual devolve o lead à fila de verdade", () => {
  it("liberado, o lead volta ao POOL e à RESERVA — não só à lista", async () => {
    // O que importa aqui é que liberar não seja um efeito cosmético: a
    // liberação reusa a invariante `expiraEm <= reservadoEm` que a própria
    // retenção lê, então os três lugares concordam por construção.
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    db.seed("filaEnvios/ChIJa", { ...envio() } as unknown as Record<string, unknown>);

    expect((await listarRetidos(db, AGORA, RETENCAO_MS)).total).toBe(1);
    expect((await construirPool(db, AGORA, { retencaoMs: RETENCAO_MS })).candidatos).toEqual([]);

    expect(await liberarRetido(db, "ChIJa", AGORA, RETENCAO_MS)).toEqual({ ok: true });

    expect((await listarRetidos(db, AGORA, RETENCAO_MS)).total).toBe(0);
    const pool = await construirPool(db, AGORA, { retencaoMs: RETENCAO_MS });
    expect(pool.candidatos.map((c) => c.id)).toEqual(["ChIJa"]);
    expect(
      await reservarLead(db, "ChIJa", "android", AGORA, {
        tentativasMax: TENTATIVAS_MAX,
        retencaoMs: RETENCAO_MS,
      }),
    ).not.toBeNull();
  });

  it("a recusa por claim ativa é decidida DENTRO da transação", async () => {
    // Entre ler a lista e clicar em liberar, `/proximo` pode ter re-reservado
    // o lead (retenção vencida no intervalo). A transação relê o doc, vê a
    // claim NOVA e viva, e recusa — em vez de atropelar um envio em curso.
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    db.seed("filaEnvios/ChIJa", { ...envio() } as unknown as Record<string, unknown>);

    // A tela leu a lista com o lead retido...
    expect((await listarRetidos(db, AGORA, RETENCAO_MS)).total).toBe(1);

    // ...e nesse meio-tempo a janela venceu e o aparelho levou o lead.
    const depois = new Date("2026-03-10T21:00:01Z");
    const nova = await reservarLead(db, "ChIJa", "android", depois, {
      tentativasMax: TENTATIVAS_MAX,
      retencaoMs: RETENCAO_MS,
    });
    expect(nova).not.toBeNull();

    const recusa = await liberarRetido(db, "ChIJa", depois, RETENCAO_MS);
    expect(recusa).toEqual({
      ok: false,
      motivo: "claim_ativa",
      expiraEm: nova!.expiraEm,
    });
    // A claim nova fica intacta — o aparelho pode estar enviando agora.
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({ claimId: nova!.claimId });
  });

  it("`retencaoEnvioHoras: 0` não lista nada e não varre a coleção", async () => {
    const db = new FakeFirestore();
    let varreduras = 0;
    const espiao: AppDb = {
      collection(name: string) {
        const real = db.collection(name);
        return {
          ...real,
          doc: (id: string) => real.doc(id),
          get: async () => {
            varreduras += 1;
            return real.get();
          },
        };
      },
      runTransaction: (fn) => db.runTransaction(fn),
    };
    db.seed("filaEnvios/ChIJa", { ...envio() } as unknown as Record<string, unknown>);

    expect(await listarRetidos(espiao, AGORA, 0)).toEqual({ total: 0, linhas: [] });
    expect(varreduras).toBe(0);
  });
});
