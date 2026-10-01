import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";

import { lerCiclos } from "../ciclos";
import { confirmarEnvio } from "../confirmar";
import { TENTATIVAS_MAX, anotarRotacao, liberarClaim, reservarLead } from "../envios";
import { liberarRevisao, marcarContactadoRevisao } from "../revisao";

/**
 * O HISTÓRICO POR CICLO — `filaEnvios/{leadId}/ciclos/{claimId}` (ver
 * "Ciclos" em ARCHITECTURE.md).
 *
 * O doc principal de `filaEnvios` é UM por lead e cada reserva o sobrescreve:
 * só o último ciclo ficava visível, e foi isso que impediu dizer, no
 * diagnóstico, quantas vezes um lead tinha sido levado e o que o aparelho
 * disse em cada vez. Cada reserva agora nasce também como um registro
 * PRÓPRIO, que nenhuma reserva seguinte toca, e que fecha UMA vez com o
 * resultado, o detalhe e o horário do fechamento.
 */

const T0 = new Date("2026-03-10T10:00:00Z");
const depois = (min: number) => new Date(T0.getTime() + min * 60_000);

function lead(id: string) {
  return {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    horarios: { faixas: [], utcOffsetMinutes: 0, obtidoEm: "2026-03-01T00:00:00.000Z" },
    criadoEm: "2026-03-01T00:00:00.000Z",
    atualizadoEm: "2026-03-01T00:00:00.000Z",
  };
}

const confirmarComo = (
  db: FakeFirestore,
  claimId: string,
  resultado: "enviado" | "falhou" | "invalido",
  detalhe: string | null,
  now: Date,
) => confirmarEnvio(db, "ChIJa", claimId, resultado, { detalhe, userId: "u1", inicioDiaOperacionalHora: 0, now });

describe("cada reserva vira um ciclo", () => {
  it("a reserva abre o ciclo com quando, quem e (depois) qual skin — ainda sem resultado", async () => {
    const db = new FakeFirestore();
    const reserva = await reservarLead(db, "ChIJa", "celular-1", T0);
    await anotarRotacao(db, "ChIJa", reserva!.claimId, "barbearia-editorial");

    expect(await lerCiclos(db, "ChIJa")).toEqual([
      {
        claimId: reserva!.claimId,
        leadId: "ChIJa",
        reservadoEm: T0.toISOString(),
        dispositivo: "celular-1",
        rotacaoSkinId: "barbearia-editorial",
        resultado: null,
        detalhe: null,
        fechadoEm: null,
      },
    ]);
  });

  it("o confirmar fecha o ciclo NA MESMA transação: resultado, detalhe e horário", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa"));
    const reserva = await reservarLead(db, "ChIJa", "android", T0);

    await confirmarComo(db, reserva!.claimId, "enviado", "print não anexou", depois(2));

    expect((await lerCiclos(db, "ChIJa"))[0]).toMatchObject({
      resultado: "enviado",
      detalhe: "print não anexou",
      fechadoEm: depois(2).toISOString(),
    });
  });

  it("três ciclos, três registros — cada um com o que o aparelho disse naquela vez", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa"));

    const c1 = await reservarLead(db, "ChIJa", "android", T0, { tentativasMax: TENTATIVAS_MAX });
    await confirmarComo(db, c1!.claimId, "falhou", "whatsapp travou", depois(1));
    const c2 = await reservarLead(db, "ChIJa", "android", depois(10), { tentativasMax: TENTATIVAS_MAX });
    await liberarClaim(db, "ChIJa", c2!.claimId);
    const c3 = await reservarLead(db, "ChIJa", "android", depois(20), { tentativasMax: TENTATIVAS_MAX });
    await confirmarComo(db, c3!.claimId, "enviado", null, depois(21));

    const ciclos = await lerCiclos(db, "ChIJa");
    // Mais antigo primeiro: é a história, na ordem em que aconteceu.
    expect(ciclos.map((c) => [c.claimId, c.resultado, c.detalhe])).toEqual([
      [c1!.claimId, "falhou", "whatsapp travou"],
      [c2!.claimId, "devolvida", null],
      [c3!.claimId, "enviado", null],
    ]);
    // O doc principal continua UM só, com a forma de sempre.
    expect(db.getDoc("filaEnvios/ChIJa")).toMatchObject({ claimId: c3!.claimId, estado: "enviado", reservas: 3 });
  });

  it("as saídas da revisão fecham o ciclo com a decisão do operador", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa"));
    db.seed("leads/ChIJb", { ...lead("ChIJb"), placeId: "ChIJb" });
    const a = await reservarLead(db, "ChIJa", "android", T0);
    const b = await reservarLead(db, "ChIJb", "android", T0);
    const mais = depois(60);

    await liberarRevisao(db, "ChIJa", mais);
    await marcarContactadoRevisao(db, "ChIJb", { userId: "u1", inicioDiaOperacionalHora: 0, now: mais });

    expect((await lerCiclos(db, "ChIJa"))[0]).toMatchObject({ claimId: a!.claimId, resultado: "liberado_revisao", fechadoEm: mais.toISOString() });
    expect((await lerCiclos(db, "ChIJb"))[0]).toMatchObject({ claimId: b!.claimId, resultado: "contactado_revisao", fechadoEm: mais.toISOString() });
  });
});

describe("o ciclo fecha UMA vez", () => {
  it("confirmação repetida da mesma claim não reescreve o fechamento", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa"));
    const reserva = await reservarLead(db, "ChIJa", "android", T0);
    await confirmarComo(db, reserva!.claimId, "enviado", "primeiro", depois(1));

    await confirmarComo(db, reserva!.claimId, "enviado", "segundo", depois(5));

    expect((await lerCiclos(db, "ChIJa"))[0]).toMatchObject({ detalhe: "primeiro", fechadoEm: depois(1).toISOString() });
  });

  it("ciclo já fechado não é reaberto nem sobrescrito por um fechamento atrasado", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa"));
    const reserva = await reservarLead(db, "ChIJa", "android", T0);
    // O operador decidiu antes do aparelho: liberou.
    await liberarRevisao(db, "ChIJa", depois(60));
    db.seed(`filaEnvios/ChIJa/ciclos/${reserva!.claimId}`, {
      ...(db.getDoc(`filaEnvios/ChIJa/ciclos/${reserva!.claimId}`) as Record<string, unknown>),
    });

    // Uma reserva NOVA nasce: o ciclo velho não é tocado.
    const nova = await reservarLead(db, "ChIJa", "android", depois(61));

    const ciclos = await lerCiclos(db, "ChIJa");
    expect(ciclos).toHaveLength(2);
    expect(ciclos[0]).toMatchObject({ claimId: reserva!.claimId, resultado: "liberado_revisao" });
    expect(ciclos[1]).toMatchObject({ claimId: nova!.claimId, resultado: null });
  });

  it("claim de ANTES dos ciclos existirem ganha o registro ao fechar, com o que o doc principal sabe", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa"));
    db.seed("filaEnvios/ChIJa", {
      leadId: "ChIJa",
      estado: "reservado",
      claimId: "claim-antiga",
      reservadoEm: "2026-03-09T22:00:00.000Z",
      expiraEm: "2026-03-09T22:05:00.000Z",
      dispositivo: "android",
      tentativas: 0,
      ultimoErro: null,
      enviadoEm: null,
      rotacaoSkinId: "barbearia-editorial",
    });

    await confirmarComo(db, "claim-antiga", "enviado", null, T0);

    expect(await lerCiclos(db, "ChIJa")).toEqual([
      {
        claimId: "claim-antiga",
        leadId: "ChIJa",
        reservadoEm: "2026-03-09T22:00:00.000Z",
        dispositivo: "android",
        rotacaoSkinId: "barbearia-editorial",
        resultado: "enviado",
        detalhe: null,
        fechadoEm: T0.toISOString(),
      },
    ]);
  });

  it("lead sem ciclo nenhum: lista vazia, nunca erro", async () => {
    expect(await lerCiclos(new FakeFirestore(), "ChIJnada")).toEqual([]);
  });
});
