import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import {
  ClaimInvalidoError,
  TENTATIVAS_MAX,
  anotarRotacao,
  confirmarClaim,
  liberarClaim,
  reservarLead,
} from "../envios";

const DOC = "filaEnvios/ChIJlead1";

describe("reservarLead", () => {
  it("reserva simples: lead sem doc devolve claimId e grava o estado", async () => {
    const db = new FakeFirestore();
    const now = new Date("2026-03-10T12:00:00Z");

    const reserva = await reservarLead(db, "ChIJlead1", "celular-1", now);

    expect(reserva?.claimId).toEqual(expect.any(String));
    expect(reserva?.expiraEm).toBe(new Date(now.getTime() + 5 * 60 * 1000).toISOString());
    expect(db.getDoc(DOC)).toMatchObject({
      leadId: "ChIJlead1",
      estado: "reservado",
      claimId: reserva?.claimId,
      dispositivo: "celular-1",
      reservadoEm: now.toISOString(),
      expiraEm: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      tentativas: 0,
      ultimoErro: null,
      enviadoEm: null,
    });
  });

  it("segunda reserva concorrente do mesmo lead falha (devolve null)", async () => {
    const db = new FakeFirestore();
    const now = new Date("2026-03-10T12:00:00Z");

    const primeira = await reservarLead(db, "ChIJlead1", "celular-1", now);
    const segunda = await reservarLead(db, "ChIJlead1", "celular-2", new Date(now.getTime() + 1000));

    expect(primeira).not.toBeNull();
    expect(segunda).toBeNull();
    expect(db.getDoc(DOC)?.claimId).toBe(primeira?.claimId); // a reserva original não foi tocada
  });

  it("claim expirada é re-reservável (e ganha um claimId novo)", async () => {
    const db = new FakeFirestore();
    db.seed("filaEnvios/ChIJlead1", {
      leadId: "ChIJlead1",
      estado: "reservado",
      claimId: "claim-velho",
      reservadoEm: "2026-03-10T11:00:00.000Z",
      expiraEm: "2026-03-10T11:05:00.000Z", // expirou há muito
      dispositivo: "celular-1",
      tentativas: 2,
      ultimoErro: "timeout",
      enviadoEm: null,
    });

    const reserva = await reservarLead(db, "ChIJlead1", "celular-2", new Date("2026-03-10T12:00:00Z"));

    expect(reserva).not.toBeNull();
    expect(reserva?.claimId).not.toBe("claim-velho");
    expect(db.getDoc(DOC)).toMatchObject({
      claimId: reserva?.claimId,
      dispositivo: "celular-2",
      tentativas: 2, // histórico do lead sobrevive à re-reserva
      ultimoErro: "timeout",
    });
  });

  it("estado terminal (enviado/inválido/falhou) nunca é re-reservado por esta função", async () => {
    const db = new FakeFirestore();
    for (const estado of ["enviado", "invalido", "falhou"] as const) {
      db.seed(DOC, {
        leadId: "ChIJlead1",
        estado,
        claimId: "claim-x",
        reservadoEm: "2026-03-10T10:00:00.000Z",
        expiraEm: "2026-03-10T10:05:00.000Z", // já expiraria, mas o estado não é "reservado"
        dispositivo: "celular-1",
        tentativas: 0,
        ultimoErro: null,
        enviadoEm: null,
      });

      const reserva = await reservarLead(db, "ChIJlead1", "celular-2", new Date("2026-03-10T12:00:00Z"));

      expect(reserva).toBeNull();
    }
  });
});

describe("reservarLead — política de reenvio explícita", () => {
  function semearFalha(db: FakeFirestore, tentativas: number) {
    db.seed(DOC, {
      leadId: "ChIJlead1",
      estado: "falhou",
      claimId: "claim-x",
      reservadoEm: "2026-03-10T10:00:00.000Z",
      expiraEm: "2026-03-10T10:05:00.000Z",
      dispositivo: "celular-1",
      tentativas,
      ultimoErro: "whatsapp travou",
      enviadoEm: null,
    });
  }

  it("com tentativasMax, um lead que falhou volta à fila", async () => {
    const db = new FakeFirestore();
    semearFalha(db, 1);

    const reserva = await reservarLead(db, "ChIJlead1", "celular-2", new Date("2026-03-10T12:00:00Z"), {
      tentativasMax: TENTATIVAS_MAX,
    });

    expect(reserva).not.toBeNull();
    // O histórico de falhas do LEAD sobrevive à nova reserva.
    expect(db.getDoc(DOC)).toMatchObject({ tentativas: 1, ultimoErro: "whatsapp travou" });
  });

  it("esgotadas as tentativas, o lead PARA (sem ser excluído nem invalidado)", async () => {
    const db = new FakeFirestore();
    semearFalha(db, TENTATIVAS_MAX);

    const reserva = await reservarLead(db, "ChIJlead1", "celular-2", new Date("2026-03-10T12:00:00Z"), {
      tentativasMax: TENTATIVAS_MAX,
    });

    expect(reserva).toBeNull();
    // Continua ali, inteiro, para inspeção manual.
    expect(db.getDoc(DOC)).toMatchObject({ estado: "falhou", tentativas: TENTATIVAS_MAX });
  });

  it("enviado e invalido são terminais em QUALQUER política", async () => {
    for (const estado of ["enviado", "invalido"] as const) {
      const db = new FakeFirestore();
      semearFalha(db, 0);
      db.seed(DOC, { ...db.getDoc(DOC), estado });

      const reserva = await reservarLead(db, "ChIJlead1", "c", new Date("2026-03-10T12:00:00Z"), {
        tentativasMax: 99,
      });

      expect(reserva).toBeNull();
    }
  });
});

describe("anotarRotacao", () => {
  it("carimba na claim a skin cuja frase saiu", async () => {
    const db = new FakeFirestore();
    const reserva = await reservarLead(db, "ChIJlead1", "celular-1", new Date("2026-03-10T12:00:00Z"));

    await anotarRotacao(db, "ChIJlead1", reserva!.claimId, "barbearia-editorial");

    expect(db.getDoc(DOC)).toMatchObject({
      rotacaoSkinId: "barbearia-editorial",
      estado: "reservado",
      claimId: reserva!.claimId,
    });
  });

  it("mensagem sem rotação (grupo/global) grava null, não some", async () => {
    const db = new FakeFirestore();
    const reserva = await reservarLead(db, "ChIJlead1", "celular-1", new Date("2026-03-10T12:00:00Z"));

    await anotarRotacao(db, "ChIJlead1", reserva!.claimId, null);

    expect(db.getDoc(DOC)?.rotacaoSkinId).toBeNull();
  });

  it("claimId que não bate é rejeitado, como nas outras escritas", async () => {
    const db = new FakeFirestore();
    await reservarLead(db, "ChIJlead1", "celular-1", new Date("2026-03-10T12:00:00Z"));

    await expect(anotarRotacao(db, "ChIJlead1", "claim-de-outro", "x")).rejects.toThrow(
      ClaimInvalidoError,
    );
  });
});

describe("confirmarClaim", () => {
  it("confirma 'enviado': grava enviadoEm e limpa ultimoErro", async () => {
    const db = new FakeFirestore();
    const now = new Date("2026-03-10T12:00:00Z");
    const reserva = await reservarLead(db, "ChIJlead1", "celular-1", now);

    await confirmarClaim(db, "ChIJlead1", reserva!.claimId, "enviado", null, new Date(now.getTime() + 2000));

    expect(db.getDoc(DOC)).toMatchObject({
      estado: "enviado",
      enviadoEm: new Date(now.getTime() + 2000).toISOString(),
      ultimoErro: null,
      tentativas: 0,
    });
  });

  it("confirma 'falhou': incrementa tentativas e grava ultimoErro", async () => {
    const db = new FakeFirestore();
    const reserva = await reservarLead(db, "ChIJlead1", "celular-1", new Date("2026-03-10T12:00:00Z"));

    await confirmarClaim(db, "ChIJlead1", reserva!.claimId, "falhou", "whatsapp travou");

    const doc = db.getDoc(DOC);
    expect(doc?.estado).toBe("falhou");
    expect(doc?.tentativas).toBe(1);
    expect(doc?.ultimoErro).toBe("whatsapp travou");
    expect(doc?.enviadoEm).toBeNull();
  });

  it("confirma 'invalido': não incrementa tentativas", async () => {
    const db = new FakeFirestore();
    const reserva = await reservarLead(db, "ChIJlead1", "celular-1", new Date("2026-03-10T12:00:00Z"));

    await confirmarClaim(db, "ChIJlead1", reserva!.claimId, "invalido", "numero nao existe");

    const doc = db.getDoc(DOC);
    expect(doc?.estado).toBe("invalido");
    expect(doc?.tentativas).toBe(0);
    expect(doc?.ultimoErro).toBe("numero nao existe");
  });

  it("claimId velho é REJEITADO (não ignorado em silêncio) quando o lead já foi re-reservado", async () => {
    const db = new FakeFirestore();
    const claimVelho = await reservarLead(db, "ChIJlead1", "celular-1", new Date("2026-03-10T11:00:00Z"));
    // Expira e é re-reservada por outro ciclo antes do celular travado voltar.
    db.seed(DOC, { ...db.getDoc(DOC), expiraEm: "2026-03-10T11:01:00.000Z" });
    await reservarLead(db, "ChIJlead1", "celular-2", new Date("2026-03-10T12:00:00Z"));

    await expect(
      confirmarClaim(db, "ChIJlead1", claimVelho!.claimId, "enviado"),
    ).rejects.toThrow(ClaimInvalidoError);
    // A reserva NOVA continua intacta — a confirmação velha não mexeu nela.
    expect(db.getDoc(DOC)?.estado).toBe("reservado");
  });

  it("confirmar lead nunca reservado é rejeitado", async () => {
    const db = new FakeFirestore();
    await expect(
      confirmarClaim(db, "ChIJnunca-existiu", "qualquer-claim", "enviado"),
    ).rejects.toThrow(ClaimInvalidoError);
  });
});

describe("liberarClaim", () => {
  it("libera antes de expirar — o lead volta a ser reservável na hora", async () => {
    const db = new FakeFirestore();
    const reserva = await reservarLead(db, "ChIJlead1", "celular-1", new Date("2026-03-10T12:00:00Z"));

    await liberarClaim(db, "ChIJlead1", reserva!.claimId);
    const nova = await reservarLead(db, "ChIJlead1", "celular-2", new Date("2026-03-10T12:00:01Z"));

    expect(nova).not.toBeNull();
    expect(nova?.claimId).not.toBe(reserva?.claimId);
  });

  it("claimId velho também é rejeitado em liberarClaim", async () => {
    const db = new FakeFirestore();
    const claimVelho = await reservarLead(db, "ChIJlead1", "celular-1", new Date("2026-03-10T11:00:00Z"));
    db.seed(DOC, { ...db.getDoc(DOC), expiraEm: "2026-03-10T11:01:00.000Z" });
    await reservarLead(db, "ChIJlead1", "celular-2", new Date("2026-03-10T12:00:00Z"));

    await expect(liberarClaim(db, "ChIJlead1", claimVelho!.claimId)).rejects.toThrow(
      ClaimInvalidoError,
    );
  });
});
