import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { listarGruposPendentes } from "../respostasPendentes";
import {
  CANAL_INDIVIDUAL,
  processarMensagemRecebida,
  type CorpoMensagemRecebida,
} from "../mensagemRecebida";

const T0 = new Date("2026-03-01T10:00:00.000Z");

function baseLead(extra: Partial<Lead> = {}): Lead {
  return {
    placeId: "ChIJlead1",
    nome: "Barbearia do Zé",
    status: "contactado",
    enriquecido: false,
    telefoneIntl: "+55 16 98213-3909",
    criadoEm: "2026-02-01T00:00:00.000Z",
    atualizadoEm: "2026-02-01T00:00:00.000Z",
    ...extra,
  };
}

function corpo(extra: Partial<CorpoMensagemRecebida> = {}): CorpoMensagemRecebida {
  return {
    remetente: "+55 16 98213-3909",
    texto: "Oi, tenho interesse!",
    canal: CANAL_INDIVIDUAL,
    recebidoEm: T0.toISOString(),
    chave: "hash-1",
    ...extra,
  };
}

describe("processarMensagemRecebida — casamento com o lead", () => {
  it("telefone com espaços e formatação casa com o lead (normalização por dígitos)", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);

    const resultado = await processarMensagemRecebida(db, corpo({ remetente: "+55 (16) 98213-3909" }), T0);

    expect(resultado.processada).toBe(true);
    expect(db.getDoc("leads/ChIJlead1/respostas/hash-1")).toMatchObject({ texto: "Oi, tenho interesse!" });
  });

  it("remetente sem lead correspondente: nada persiste em lugar nenhum", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead({ telefoneIntl: "+55 44 99999-0000" }) as unknown as Record<string, unknown>);

    const resultado = await processarMensagemRecebida(db, corpo(), T0);

    expect(resultado).toEqual({ processada: false, motivo: "sem_lead" });
    expect(db.getDoc("leads/ChIJlead1/respostas/hash-1")).toBeUndefined();
    expect(await listarGruposPendentes(db)).toEqual([]);
    // status do lead não mudou
    expect(db.getDoc("leads/ChIJlead1")?.status).toBe("contactado");
  });

  it("detalhes.telefoneIntl (enriquecido) tem precedência, mesma regra de montarMensagemParaLead", async () => {
    const db = new FakeFirestore();
    db.seed(
      "leads/ChIJlead1",
      baseLead({
        telefoneIntl: "+55 44 0000-0000",
        detalhes: { enriquecidoEm: "2026-02-01T00:00:00.000Z", telefoneIntl: "+55 16 98213-3909" },
      }) as unknown as Record<string, unknown>,
    );

    const resultado = await processarMensagemRecebida(db, corpo(), T0);

    expect(resultado.processada).toBe(true);
  });
});

describe("processarMensagemRecebida — canal de grupo", () => {
  it("canal diferente do individual é descartado, nada persiste", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);

    const resultado = await processarMensagemRecebida(db, corpo({ canal: "group_chat_defaults_1" }), T0);

    expect(resultado).toEqual({ processada: false, motivo: "canal_grupo" });
    expect(db.getDoc("leads/ChIJlead1/respostas/hash-1")).toBeUndefined();
    expect(await listarGruposPendentes(db)).toEqual([]);
  });
});

describe("processarMensagemRecebida — dedupe por chave", () => {
  it("chave repetida não reprocessa: status e grupo pendente não mudam de novo", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);

    await processarMensagemRecebida(db, corpo(), T0);
    const t2 = new Date(T0.getTime() + 5_000);
    const resultado = await processarMensagemRecebida(db, corpo({ recebidoEm: t2.toISOString() }), t2);

    expect(resultado).toEqual({ processada: false, motivo: "chave_repetida" });
    const [grupo] = await listarGruposPendentes(db);
    // só UMA mensagem no grupo — a repetição não foi adicionada de novo
    expect(grupo.mensagens).toHaveLength(1);
    expect(grupo.ultimaMensagemEm).toBe(T0.toISOString());
  });

  it("recebidoEm é o carimbo DA NOTIFICAÇÃO — chave nova (reenvio após queda de rede) NÃO deduplica, mas cada chave só processa uma vez", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);

    await processarMensagemRecebida(db, corpo({ chave: "hash-A" }), T0);
    await processarMensagemRecebida(db, corpo({ chave: "hash-A" }), T0);

    const [grupo] = await listarGruposPendentes(db);
    expect(grupo.mensagens).toHaveLength(1);
  });
});

describe("processarMensagemRecebida — transição de status", () => {
  it("contactado -> respondeu na primeira mensagem", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead({ status: "contactado" }) as unknown as Record<string, unknown>);

    await processarMensagemRecebida(db, corpo(), T0);

    const lead = db.getDoc("leads/ChIJlead1");
    expect(lead?.status).toBe("respondeu");
    expect((lead?.contato as Record<string, unknown> | undefined)?.respondeuEm).toBe(T0.toISOString());
  });

  it("lead já em respondeu recebe a mensagem sem regravar status", async () => {
    const db = new FakeFirestore();
    db.seed(
      "leads/ChIJlead1",
      baseLead({ status: "respondeu", contato: { respondeuEm: "2026-02-15T00:00:00.000Z" } }) as unknown as Record<
        string,
        unknown
      >,
    );

    await processarMensagemRecebida(db, corpo(), T0);

    const lead = db.getDoc("leads/ChIJlead1");
    expect(lead?.status).toBe("respondeu");
    expect((lead?.contato as Record<string, unknown> | undefined)?.respondeuEm).toBe("2026-02-15T00:00:00.000Z");
  });

  it("lead em fechado NUNCA é rebaixado, mas recebe a mensagem", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead({ status: "fechado" }) as unknown as Record<string, unknown>);

    const resultado = await processarMensagemRecebida(db, corpo(), T0);

    expect(resultado.processada).toBe(true);
    expect(db.getDoc("leads/ChIJlead1")?.status).toBe("fechado");
    expect(db.getDoc("leads/ChIJlead1/respostas/hash-1")).toMatchObject({ texto: "Oi, tenho interesse!" });
  });

  it("lead em novo recebe a mensagem sem virar respondeu (não pulou o contato)", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead({ status: "novo" }) as unknown as Record<string, unknown>);

    await processarMensagemRecebida(db, corpo(), T0);

    expect(db.getDoc("leads/ChIJlead1")?.status).toBe("novo");
  });
});

describe("processarMensagemRecebida — agrupamento", () => {
  it("três mensagens seguidas do mesmo lead acumulam no MESMO grupo pendente", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);

    await processarMensagemRecebida(db, corpo({ chave: "h1", texto: "Oi" }), T0);
    const t2 = new Date(T0.getTime() + 5_000);
    await processarMensagemRecebida(db, corpo({ chave: "h2", texto: "tudo bem?", recebidoEm: t2.toISOString() }), t2);
    const t3 = new Date(T0.getTime() + 10_000);
    await processarMensagemRecebida(db, corpo({ chave: "h3", texto: "quero saber mais", recebidoEm: t3.toISOString() }), t3);

    const [grupo] = await listarGruposPendentes(db);
    expect(grupo.mensagens.map((m) => m.texto)).toEqual(["Oi", "tudo bem?", "quero saber mais"]);
  });
});
