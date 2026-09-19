import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { DEFAULT_FILA_CONFIG, type FilaConfig } from "../config";
import { listarGruposPendentes } from "../respostasPendentes";
import {
  CANAL_INDIVIDUAL,
  EXCECAO_GRUPO_ID,
  FILA_EXCECAO_LOG_COLLECTION,
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

/** A config efetiva com exceção configurada — número + lead de contexto. */
function comExcecao(extra: Partial<FilaConfig> = {}): FilaConfig {
  return {
    ...DEFAULT_FILA_CONFIG,
    numeroExcecao: "5544999998888",
    leadContextoExcecao: "ChIJcontexto",
    ...extra,
  };
}

describe("processarMensagemRecebida — casamento com o lead", () => {
  it("telefone com espaços e formatação casa com o lead (normalização por dígitos)", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);

    const resultado = await processarMensagemRecebida(
      db,
      corpo({ remetente: "+55 (16) 98213-3909" }),
      T0,
      DEFAULT_FILA_CONFIG,
    );

    expect(resultado.processada).toBe(true);
    expect(db.getDoc("leads/ChIJlead1/respostas/hash-1")).toMatchObject({ texto: "Oi, tenho interesse!" });
  });

  it("remetente sem lead correspondente: nada persiste em lugar nenhum", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead({ telefoneIntl: "+55 44 99999-0000" }) as unknown as Record<string, unknown>);

    const resultado = await processarMensagemRecebida(db, corpo(), T0, DEFAULT_FILA_CONFIG);

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

    const resultado = await processarMensagemRecebida(db, corpo(), T0, DEFAULT_FILA_CONFIG);

    expect(resultado.processada).toBe(true);
  });
});

describe("processarMensagemRecebida — canal de grupo", () => {
  it("canal diferente do individual é descartado, nada persiste", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);

    const resultado = await processarMensagemRecebida(
      db,
      corpo({ canal: "group_chat_defaults_1" }),
      T0,
      DEFAULT_FILA_CONFIG,
    );

    expect(resultado).toEqual({ processada: false, motivo: "canal_grupo" });
    expect(db.getDoc("leads/ChIJlead1/respostas/hash-1")).toBeUndefined();
    expect(await listarGruposPendentes(db)).toEqual([]);
  });
});

describe("processarMensagemRecebida — dedupe por chave", () => {
  it("chave repetida não reprocessa: status e grupo pendente não mudam de novo", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);

    await processarMensagemRecebida(db, corpo(), T0, DEFAULT_FILA_CONFIG);
    const t2 = new Date(T0.getTime() + 5_000);
    const resultado = await processarMensagemRecebida(
      db,
      corpo({ recebidoEm: t2.toISOString() }),
      t2,
      DEFAULT_FILA_CONFIG,
    );

    expect(resultado).toEqual({ processada: false, motivo: "chave_repetida" });
    const [grupo] = await listarGruposPendentes(db);
    // só UMA mensagem no grupo — a repetição não foi adicionada de novo
    expect(grupo.mensagens).toHaveLength(1);
    expect(grupo.ultimaMensagemEm).toBe(T0.toISOString());
  });

  it("recebidoEm ESTÁVEL (o mesmo carimbo da notificação original) é o que faz o reenvio deduplicar — chave diferente NÃO deduplicaria", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);

    // A macro reenvia após queda de rede com o MESMO recebidoEm (contrato:
    // carimbo da notificação, nunca do instante da chamada HTTP) — mesma
    // chave, dedupe funciona.
    await processarMensagemRecebida(
      db,
      corpo({ chave: "hash-A", recebidoEm: T0.toISOString() }),
      T0,
      DEFAULT_FILA_CONFIG,
    );
    const reenvio = await processarMensagemRecebida(
      db,
      corpo({ chave: "hash-A", recebidoEm: T0.toISOString() }),
      new Date(T0.getTime() + 5_000),
      DEFAULT_FILA_CONFIG,
    );
    expect(reenvio).toEqual({ processada: false, motivo: "chave_repetida" });

    // Duas mensagens DE VERDADE distintas (chave própria cada) continuam
    // processando normalmente, uma por uma.
    const t2 = new Date(T0.getTime() + 60_000);
    await processarMensagemRecebida(
      db,
      corpo({ chave: "hash-B", texto: "outra pergunta", recebidoEm: t2.toISOString() }),
      t2,
      DEFAULT_FILA_CONFIG,
    );

    const [grupo] = await listarGruposPendentes(db);
    expect(grupo.mensagens.map((m) => m.texto)).toEqual(["Oi, tenho interesse!", "outra pergunta"]);
  });
});

describe("processarMensagemRecebida — transição de status", () => {
  it("contactado -> respondeu na primeira mensagem", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead({ status: "contactado" }) as unknown as Record<string, unknown>);

    await processarMensagemRecebida(db, corpo(), T0, DEFAULT_FILA_CONFIG);

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

    await processarMensagemRecebida(db, corpo(), T0, DEFAULT_FILA_CONFIG);

    const lead = db.getDoc("leads/ChIJlead1");
    expect(lead?.status).toBe("respondeu");
    expect((lead?.contato as Record<string, unknown> | undefined)?.respondeuEm).toBe("2026-02-15T00:00:00.000Z");
  });

  it("lead em fechado NUNCA é rebaixado, mas recebe a mensagem", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead({ status: "fechado" }) as unknown as Record<string, unknown>);

    const resultado = await processarMensagemRecebida(db, corpo(), T0, DEFAULT_FILA_CONFIG);

    expect(resultado.processada).toBe(true);
    expect(db.getDoc("leads/ChIJlead1")?.status).toBe("fechado");
    expect(db.getDoc("leads/ChIJlead1/respostas/hash-1")).toMatchObject({ texto: "Oi, tenho interesse!" });
  });

  it("lead em novo recebe a mensagem sem virar respondeu (não pulou o contato)", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead({ status: "novo" }) as unknown as Record<string, unknown>);

    await processarMensagemRecebida(db, corpo(), T0, DEFAULT_FILA_CONFIG);

    expect(db.getDoc("leads/ChIJlead1")?.status).toBe("novo");
  });
});

describe("processarMensagemRecebida — agrupamento", () => {
  it("três mensagens seguidas do mesmo lead acumulam no MESMO grupo pendente", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJlead1", baseLead() as unknown as Record<string, unknown>);

    await processarMensagemRecebida(db, corpo({ chave: "h1", texto: "Oi" }), T0, DEFAULT_FILA_CONFIG);
    const t2 = new Date(T0.getTime() + 5_000);
    await processarMensagemRecebida(
      db,
      corpo({ chave: "h2", texto: "tudo bem?", recebidoEm: t2.toISOString() }),
      t2,
      DEFAULT_FILA_CONFIG,
    );
    const t3 = new Date(T0.getTime() + 10_000);
    await processarMensagemRecebida(
      db,
      corpo({ chave: "h3", texto: "quero saber mais", recebidoEm: t3.toISOString() }),
      t3,
      DEFAULT_FILA_CONFIG,
    );

    const [grupo] = await listarGruposPendentes(db);
    expect(grupo.mensagens.map((m) => m.texto)).toEqual(["Oi", "tudo bem?", "quero saber mais"]);
  });
});

describe("processarMensagemRecebida — número de exceção", () => {
  it("numeroExcecao vazio (o padrão): remetente que não é lead continua sem_lead, comportamento IDÊNTICO ao de hoje", async () => {
    const db = new FakeFirestore();

    const resultado = await processarMensagemRecebida(
      db,
      corpo({ remetente: "5544999998888" }),
      T0,
      DEFAULT_FILA_CONFIG,
    );

    expect(resultado).toEqual({ processada: false, motivo: "sem_lead" });
    expect(await listarGruposPendentes(db)).toEqual([]);
  });

  it("mensagem do número de exceção agrupa sob EXCECAO_GRUPO_ID, nunca sob o leadId de contexto", async () => {
    const db = new FakeFirestore();

    const resultado = await processarMensagemRecebida(
      db,
      corpo({ remetente: "5544999998888", texto: "quanto custa?" }),
      T0,
      comExcecao(),
    );

    expect(resultado).toEqual({ processada: true });
    const grupos = await listarGruposPendentes(db);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].leadId).toBe(EXCECAO_GRUPO_ID);
    expect(grupos[0].mensagens.map((m) => m.texto)).toEqual(["quanto custa?"]);
  });

  it("a mensagem NÃO entra em leads/{leadContextoExcecao}/respostas — vai para coleção própria", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJcontexto", baseLead({ placeId: "ChIJcontexto" }) as unknown as Record<string, unknown>);

    await processarMensagemRecebida(
      db,
      corpo({ remetente: "5544999998888", chave: "chave-excecao" }),
      T0,
      comExcecao(),
    );

    expect(db.getDoc("leads/ChIJcontexto/respostas/chave-excecao")).toBeUndefined();
    expect(db.getDoc(`${FILA_EXCECAO_LOG_COLLECTION}/chave-excecao`)).toMatchObject({
      texto: "Oi, tenho interesse!",
    });
  });

  it("não move o status do lead de contexto", async () => {
    const db = new FakeFirestore();
    db.seed(
      "leads/ChIJcontexto",
      baseLead({ placeId: "ChIJcontexto", status: "contactado" }) as unknown as Record<string, unknown>,
    );

    await processarMensagemRecebida(db, corpo({ remetente: "5544999998888" }), T0, comExcecao());

    expect(db.getDoc("leads/ChIJcontexto")?.status).toBe("contactado");
  });

  it("número de exceção com espaços e formatação casa (normalização por dígitos)", async () => {
    const db = new FakeFirestore();

    const resultado = await processarMensagemRecebida(
      db,
      corpo({ remetente: "+55 (44) 99999-8888" }),
      T0,
      comExcecao(),
    );

    expect(resultado).toEqual({ processada: true });
    expect((await listarGruposPendentes(db))[0]?.leadId).toBe(EXCECAO_GRUPO_ID);
  });

  it("chave repetida do número de exceção não reprocessa (mesmo dedupe do caminho real)", async () => {
    const db = new FakeFirestore();

    await processarMensagemRecebida(
      db,
      corpo({ remetente: "5544999998888", chave: "chave-1" }),
      T0,
      comExcecao(),
    );
    const t2 = new Date(T0.getTime() + 5_000);
    const resultado = await processarMensagemRecebida(
      db,
      corpo({ remetente: "5544999998888", chave: "chave-1", recebidoEm: t2.toISOString() }),
      t2,
      comExcecao(),
    );

    expect(resultado).toEqual({ processada: false, motivo: "chave_repetida" });
    const [grupo] = await listarGruposPendentes(db);
    expect(grupo.mensagens).toHaveLength(1);
  });

  it("três mensagens seguidas do número de exceção acumulam no MESMO grupo", async () => {
    const db = new FakeFirestore();

    await processarMensagemRecebida(
      db,
      corpo({ remetente: "5544999998888", chave: "e1", texto: "Oi" }),
      T0,
      comExcecao(),
    );
    const t2 = new Date(T0.getTime() + 5_000);
    await processarMensagemRecebida(
      db,
      corpo({ remetente: "5544999998888", chave: "e2", texto: "tudo bem?", recebidoEm: t2.toISOString() }),
      t2,
      comExcecao(),
    );

    const [grupo] = await listarGruposPendentes(db);
    expect(grupo.mensagens.map((m) => m.texto)).toEqual(["Oi", "tudo bem?"]);
  });

  it("canal de grupo continua descartado mesmo vindo do número de exceção", async () => {
    const db = new FakeFirestore();

    const resultado = await processarMensagemRecebida(
      db,
      corpo({ remetente: "5544999998888", canal: "group_chat_defaults_1" }),
      T0,
      comExcecao(),
    );

    expect(resultado).toEqual({ processada: false, motivo: "canal_grupo" });
    expect(await listarGruposPendentes(db)).toEqual([]);
  });

  it("o número de exceção NUNCA casa com um lead real por engano — mesmo se o remetente batesse por coincidência", async () => {
    // Regra: o casamento com o número de exceção vem ANTES do casamento com
    // lead. Mesmo que exista um lead com esse telefone, a mensagem vai para
    // o caminho de exceção — é config explícita do admin.
    const db = new FakeFirestore();
    db.seed(
      "leads/ChIJcoincidencia",
      baseLead({ placeId: "ChIJcoincidencia", telefoneIntl: "+55 44 99999-8888" }) as unknown as Record<
        string,
        unknown
      >,
    );

    await processarMensagemRecebida(db, corpo({ remetente: "5544999998888" }), T0, comExcecao());

    const grupos = await listarGruposPendentes(db);
    expect(grupos.map((g) => g.leadId)).toEqual([EXCECAO_GRUPO_ID]);
    expect(db.getDoc("leads/ChIJcoincidencia")?.status).toBe("contactado");
  });
});
