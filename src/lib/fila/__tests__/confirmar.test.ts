import { describe, expect, it } from "vitest";

import { confirmarEnvio } from "../confirmar";
import { reservarLead } from "../envios";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import type { AppDb, UsageTransaction } from "@/lib/firestore-like";

const AGORA = new Date("2026-03-10T10:00:00Z");

/**
 * O Firestore REAL recusa `get` depois de `set` dentro de uma transação
 * ("Firestore transactions require all reads to be executed before all
 * writes"); o fake, que só enfileira as escritas, deixaria passar calado. Um
 * confirmar que violasse isso passaria em toda a suíte e quebraria só em
 * produção, na primeira mensagem da noite — então a regra é verificada aqui.
 */
function comOrdemVigiada(base: FakeFirestore): { db: AppDb; violacoes: string[] } {
  const violacoes: string[] = [];
  const db: AppDb = {
    collection: (name) => base.collection(name),
    runTransaction: (fn) =>
      base.runTransaction((tx) => {
        let escreveu = false;
        const vigiada: UsageTransaction = {
          get: async (ref) => {
            if (escreveu) violacoes.push("get depois de set");
            return tx.get(ref);
          },
          set: (ref, data, options) => {
            escreveu = true;
            return tx.set(ref, data, options);
          },
        };
        return fn(vigiada);
      }),
  };
  return { db, violacoes };
}

describe("confirmarEnvio — a transação", () => {
  it("faz TODAS as leituras antes de TODAS as escritas", async () => {
    const base = new FakeFirestore();
    base.seed("leads/ChIJa", {
      placeId: "ChIJa",
      nome: "Lead",
      status: "novo",
      enriquecido: false,
      demo: { skinId: "barbearia-editorial" },
      horarios: { faixas: [], utcOffsetMinutes: 0, obtidoEm: "x" },
      criadoEm: "2026-03-01T00:00:00.000Z",
      atualizadoEm: "2026-03-01T00:00:00.000Z",
    });
    base.seed("frasesProspeccao/barbearia-editorial", { frases: ["a", "b"], indice: 0 });
    const reserva = await reservarLead(base, "ChIJa", "android", AGORA);
    base.seed("filaEnvios/ChIJa", {
      ...base.getDoc("filaEnvios/ChIJa"),
      rotacaoSkinId: "barbearia-editorial",
    });

    const { db, violacoes } = comOrdemVigiada(base);
    await confirmarEnvio(db, "ChIJa", reserva!.claimId, "enviado", {
      userId: "radar-device",
      inicioDiaOperacionalHora: 0,
      now: AGORA,
    });

    expect(violacoes).toEqual([]);
  });

  it("nada é gravado quando a claim não bate — nem o contador, nem o lead", async () => {
    const base = new FakeFirestore();
    base.seed("leads/ChIJa", { placeId: "ChIJa", status: "novo" });
    await reservarLead(base, "ChIJa", "android", AGORA);
    const antes = JSON.stringify([base.getDoc("leads/ChIJa"), base.getDoc("filaEnvios/ChIJa")]);

    await expect(
      confirmarEnvio(base, "ChIJa", "claim-de-outro", "enviado", {
        userId: "radar-device",
        inicioDiaOperacionalHora: 0,
        now: AGORA,
      }),
    ).rejects.toThrow();

    expect(JSON.stringify([base.getDoc("leads/ChIJa"), base.getDoc("filaEnvios/ChIJa")])).toBe(antes);
    expect(base.getDoc("filaContadores/2026-03-10")).toBeUndefined();
  });

  it("o dia operacional respeita a hora de corte configurada", async () => {
    const base = new FakeFirestore();
    base.seed("leads/ChIJa", {
      placeId: "ChIJa",
      nome: "L",
      status: "novo",
      enriquecido: false,
      criadoEm: "x",
      atualizadoEm: "x",
    });
    const reserva = await reservarLead(base, "ChIJa", "android", AGORA);

    // 01h em São Paulo do dia 11; com corte às 5h, ainda é o plantão do dia 10.
    const madrugada = new Date("2026-03-11T04:00:00Z");
    await confirmarEnvio(base, "ChIJa", reserva!.claimId, "enviado", {
      userId: "u",
      inicioDiaOperacionalHora: 5,
      now: madrugada,
    });

    expect(base.getDoc("filaContadores/2026-03-10")).toMatchObject({ enviados: 1 });
    expect(base.getDoc("filaContadores/2026-03-11")).toBeUndefined();
  });
});

/**
 * O TEXTO SAIU, O PRINT NÃO FOI ANEXADO. A macro reporta "enviado" de
 * propósito nesse caso — reportar "falhou" devolveria o lead à fila e a
 * pessoa receberia a mesma mensagem duas vezes, que é o padrão que mais
 * gera denúncia no WhatsApp. O preço é um lead contactado sem a peça que
 * vende; o que estes testes protegem é o único rastro que torna esse lead
 * ENCONTRÁVEL depois, em vez de exigir abrir um por um.
 */
describe("confirmarEnvio — o detalhe de um envio que DEU CERTO", () => {
  const OPCOES = { userId: "radar-device", inicioDiaOperacionalHora: 0, now: AGORA };

  async function reservado() {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", {
      placeId: "ChIJa",
      nome: "Lead",
      status: "novo",
      enriquecido: false,
      criadoEm: "2026-03-01T00:00:00.000Z",
      atualizadoEm: "2026-03-01T00:00:00.000Z",
    });
    const reserva = await reservarLead(db, "ChIJa", "android", AGORA);
    return { db, claimId: reserva!.claimId };
  }

  it("grava em detalheEnvio — e ultimoErro continua null", async () => {
    const { db, claimId } = await reservado();

    await confirmarEnvio(db, "ChIJa", claimId, "enviado", {
      ...OPCOES,
      detalhe: "print não anexou",
    });

    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({
      estado: "enviado",
      enviadoEm: AGORA.toISOString(),
      detalheEnvio: "print não anexou",
      // `ultimoErro` é semanticamente FALHA: é o que a ficha mostra na tarja
      // do lead parado. Sujá-lo com o detalhe de um envio bem-sucedido
      // confundiria as duas coisas justamente no diagnóstico.
      ultimoErro: null,
    });
  });

  it("envio sem detalhe nenhum grava string vazia, nunca null", async () => {
    const { db, claimId } = await reservado();

    await confirmarEnvio(db, "ChIJa", claimId, "enviado", OPCOES);

    expect(db.getDoc("filaEnvios/ChIJa")?.detalheEnvio).toBe("");
  });

  it("'falhou' continua indo para ultimoErro, e não inventa pendência", async () => {
    const { db, claimId } = await reservado();

    await confirmarEnvio(db, "ChIJa", claimId, "falhou", {
      ...OPCOES,
      detalhe: "whatsapp travou",
    });

    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({
      estado: "falhou",
      ultimoErro: "whatsapp travou",
      // A lista de pendência do painel lista por detalheEnvio: um lead que
      // FALHOU não é pendência de print — ele volta à fila sozinho.
      detalheEnvio: "",
    });
  });

  it("confirmar repetido não reescreve o detalhe já gravado", async () => {
    const { db, claimId } = await reservado();
    await confirmarEnvio(db, "ChIJa", claimId, "enviado", {
      ...OPCOES,
      detalhe: "print não anexou",
    });

    // A rede caiu depois do envio e o celular reenvia o confirmar — com um
    // detalhe diferente, que é o pior caso: o caminho idempotente devolve
    // 200 sem alterar NADA, e "nada" inclui o detalhe.
    const repetida = await confirmarEnvio(db, "ChIJa", claimId, "enviado", {
      ...OPCOES,
      detalhe: "tudo certo desta vez",
      now: new Date(AGORA.getTime() + 60_000),
    });

    expect(repetida).toMatchObject({ estado: "enviado", repetida: true });
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({
      detalheEnvio: "print não anexou",
      enviadoEm: AGORA.toISOString(),
    });
  });
});
