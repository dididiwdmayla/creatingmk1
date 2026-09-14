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
