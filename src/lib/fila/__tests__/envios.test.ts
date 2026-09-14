import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import {
  ClaimInvalidoError,
  confirmarClaim,
  liberarClaim,
  reservarLead,
} from "../envios";

const DOC = "filaEnvios/ChIJlead1";

describe("reservarLead", () => {
  it("reserva simples: lead sem doc devolve claimId e grava o estado", async () => {
    const db = new FakeFirestore();
    const now = new Date("2026-03-10T12:00:00Z");

    const claimId = await reservarLead(db, "ChIJlead1", "celular-1", now);

    expect(claimId).toEqual(expect.any(String));
    expect(db.getDoc(DOC)).toMatchObject({
      leadId: "ChIJlead1",
      estado: "reservado",
      claimId,
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
    expect(db.getDoc(DOC)?.claimId).toBe(primeira); // a reserva original não foi tocada
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

    const claimId = await reservarLead(db, "ChIJlead1", "celular-2", new Date("2026-03-10T12:00:00Z"));

    expect(claimId).not.toBeNull();
    expect(claimId).not.toBe("claim-velho");
    expect(db.getDoc(DOC)).toMatchObject({
      claimId,
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

      const claimId = await reservarLead(db, "ChIJlead1", "celular-2", new Date("2026-03-10T12:00:00Z"));

      expect(claimId).toBeNull();
    }
  });
});

describe("confirmarClaim", () => {
  it("confirma 'enviado': grava enviadoEm e limpa ultimoErro", async () => {
    const db = new FakeFirestore();
    const now = new Date("2026-03-10T12:00:00Z");
    const claimId = await reservarLead(db, "ChIJlead1", "celular-1", now);

    await confirmarClaim(db, "ChIJlead1", claimId!, "enviado", null, new Date(now.getTime() + 2000));

    expect(db.getDoc(DOC)).toMatchObject({
      estado: "enviado",
      enviadoEm: new Date(now.getTime() + 2000).toISOString(),
      ultimoErro: null,
      tentativas: 0,
    });
  });

  it("confirma 'falhou': incrementa tentativas e grava ultimoErro", async () => {
    const db = new FakeFirestore();
    const claimId = await reservarLead(db, "ChIJlead1", "celular-1", new Date("2026-03-10T12:00:00Z"));

    await confirmarClaim(db, "ChIJlead1", claimId!, "falhou", "whatsapp travou");

    const doc = db.getDoc(DOC);
    expect(doc?.estado).toBe("falhou");
    expect(doc?.tentativas).toBe(1);
    expect(doc?.ultimoErro).toBe("whatsapp travou");
    expect(doc?.enviadoEm).toBeNull();
  });

  it("confirma 'invalido': não incrementa tentativas", async () => {
    const db = new FakeFirestore();
    const claimId = await reservarLead(db, "ChIJlead1", "celular-1", new Date("2026-03-10T12:00:00Z"));

    await confirmarClaim(db, "ChIJlead1", claimId!, "invalido", "numero nao existe");

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
      confirmarClaim(db, "ChIJlead1", claimVelho!, "enviado"),
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
    const claimId = await reservarLead(db, "ChIJlead1", "celular-1", new Date("2026-03-10T12:00:00Z"));

    await liberarClaim(db, "ChIJlead1", claimId!);
    const novoClaimId = await reservarLead(db, "ChIJlead1", "celular-2", new Date("2026-03-10T12:00:01Z"));

    expect(novoClaimId).not.toBeNull();
    expect(novoClaimId).not.toBe(claimId);
  });

  it("claimId velho também é rejeitado em liberarClaim", async () => {
    const db = new FakeFirestore();
    const claimVelho = await reservarLead(db, "ChIJlead1", "celular-1", new Date("2026-03-10T11:00:00Z"));
    db.seed(DOC, { ...db.getDoc(DOC), expiraEm: "2026-03-10T11:01:00.000Z" });
    await reservarLead(db, "ChIJlead1", "celular-2", new Date("2026-03-10T12:00:00Z"));

    await expect(liberarClaim(db, "ChIJlead1", claimVelho!)).rejects.toThrow(ClaimInvalidoError);
  });
});
