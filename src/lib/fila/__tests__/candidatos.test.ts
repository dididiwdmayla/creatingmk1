import { describe, expect, it } from "vitest";

import {
  POOL_MAX,
  POOL_TTL_MS,
  candidatoEstavel,
  construirPool,
  lerPool,
} from "../candidatos";
import type { FilaEnvioDoc } from "../envios";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import type { AppDb } from "@/lib/firestore-like";
import type { Lead } from "@/lib/leads/types";

const AGORA = new Date("2026-03-10T10:00:00Z");

function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    busca: { nicho: "Barbearia Masculina", regiao: "Maringá", em: "2026-03-01T00:00:00.000Z" },
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

/** Conta quantas vezes CADA coleção foi varrida — é a métrica do item. */
function comContador(db: FakeFirestore): { db: AppDb; varreduras: Record<string, number> } {
  const varreduras: Record<string, number> = {};
  const espiao: AppDb = {
    collection(name: string) {
      const real = db.collection(name);
      return {
        ...real,
        doc: (id: string) => real.doc(id),
        get: async () => {
          varreduras[name] = (varreduras[name] ?? 0) + 1;
          return real.get();
        },
      };
    },
    runTransaction: (fn) => db.runTransaction(fn),
  };
  return { db: espiao, varreduras };
}

describe("candidatoEstavel", () => {
  it("aceita o lead pronto para prospecção", () => {
    expect(candidatoEstavel(lead("ChIJa"), undefined)).toBe(true);
  });

  const recusas: Array<[string, Partial<Lead>]> = [
    ["status diferente de novo", { status: "contactado" }],
    ["descartado à mão", { descartado: true }],
    ["número marcado como sem WhatsApp", { telefoneInvalido: true }],
    ["sem telefone nenhum", { telefoneIntl: undefined }],
    ["sem demo", { demo: undefined }],
    ["capturas ainda rodando", { capturas: { estado: "rodando", execucaoId: "e", pedidoEm: "x" } as Lead["capturas"] }],
    ["sem fuso derivável", { horarios: undefined, endereco: undefined }],
  ];
  for (const [nome, override] of recusas) {
    it(`recusa: ${nome}`, () => {
      expect(candidatoEstavel(lead("ChIJa", override), undefined)).toBe(false);
    });
  }

  it("o telefone do enriquecimento vale quando o da busca falta", () => {
    const l = lead("ChIJa", {
      telefoneIntl: undefined,
      detalhes: { telefoneIntl: "+55 44 90000-0000", enriquecidoEm: "x" } as Lead["detalhes"],
    });
    expect(candidatoEstavel(l, undefined)).toBe(true);
  });

  describe("contra o estado da fila", () => {
    it("enviado e invalido são terminais", () => {
      expect(candidatoEstavel(lead("ChIJa"), envio({ estado: "enviado" }))).toBe(false);
      expect(candidatoEstavel(lead("ChIJa"), envio({ estado: "invalido" }))).toBe(false);
    });

    it("falhou volta enquanto houver tentativa, e para ao esgotar", () => {
      expect(candidatoEstavel(lead("ChIJa"), envio({ estado: "falhou", tentativas: 2 }))).toBe(true);
      expect(candidatoEstavel(lead("ChIJa"), envio({ estado: "falhou", tentativas: 3 }))).toBe(false);
    });

    it("claim viva NÃO barra aqui — quem decide isso é a transação da reserva", () => {
      expect(candidatoEstavel(lead("ChIJa"), envio({ estado: "reservado" }))).toBe(true);
    });
  });
});

describe("construirPool", () => {
  it("reduz o lead ao mínimo, com nicho e fuso já resolvidos", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);

    const pool = await construirPool(db, AGORA);

    expect(pool.candidatos).toEqual([
      {
        id: "ChIJa",
        nicho: "barbearia masculina", // normalizado na varredura, não a cada chamada
        offset: 0,
        faixas: [],
        criadoEm: "2026-03-01T00:00:00.000Z",
      },
    ]);
    expect(pool).toMatchObject({ geradoEm: AGORA.toISOString(), lidos: 1, truncado: false });
  });

  it("ordena por criadoEm e informa quantos leads custou a varredura", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJb", lead("ChIJb", { criadoEm: "2026-02-01T00:00:00.000Z" }) as unknown as Record<string, unknown>);
    db.seed("leads/ChIJa", lead("ChIJa", { criadoEm: "2026-01-01T00:00:00.000Z" }) as unknown as Record<string, unknown>);
    db.seed("leads/ChIJz", lead("ChIJz", { status: "fechado" }) as unknown as Record<string, unknown>);

    const pool = await construirPool(db, AGORA);

    expect(pool.candidatos.map((c) => c.id)).toEqual(["ChIJa", "ChIJb"]);
    expect(pool.lidos).toBe(3); // leu os 3, guardou 2
  });

  it("um lead sem busca entra com nicho vazio (e não quebra)", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa", { busca: undefined }) as unknown as Record<string, unknown>);

    expect((await construirPool(db, AGORA)).candidatos[0].nicho).toBe("");
  });
});

describe("lerPool — o pool é o que evita varrer /leads a cada chamada", () => {
  it("a primeira chamada varre; as seguintes, dentro do TTL, não varrem NADA", async () => {
    const base = new FakeFirestore();
    base.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    const { db, varreduras } = comContador(base);

    await lerPool(db, AGORA);
    expect(varreduras.leads).toBe(1);

    // Nove minutos e cinquenta e nove chamadas depois: nenhuma varredura nova.
    for (let i = 1; i <= 59; i++) {
      await lerPool(db, new Date(AGORA.getTime() + i * 10_000));
    }
    expect(varreduras.leads).toBe(1);
  });

  it("passado o TTL, a varredura acontece de novo", async () => {
    const base = new FakeFirestore();
    base.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    const { db, varreduras } = comContador(base);

    await lerPool(db, AGORA);
    await lerPool(db, new Date(AGORA.getTime() + POOL_TTL_MS + 1));

    expect(varreduras.leads).toBe(2);
  });

  it("pool com data no futuro (relógio que voltou) é tratado como vencido", async () => {
    const base = new FakeFirestore();
    base.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    base.seed("filaCandidatos/pool", {
      geradoEm: new Date(AGORA.getTime() + 60 * 60 * 1000).toISOString(),
      candidatos: [],
      lidos: 0,
      truncado: false,
    });
    const { db, varreduras } = comContador(base);

    const pool = await lerPool(db, AGORA);

    expect(varreduras.leads).toBe(1);
    expect(pool.candidatos).toHaveLength(1);
  });

  it("doc corrompido não vira erro — vira varredura", async () => {
    const base = new FakeFirestore();
    base.seed("filaCandidatos/pool", { lixo: true });
    const { db, varreduras } = comContador(base);

    await expect(lerPool(db, AGORA)).resolves.toMatchObject({ candidatos: [] });
    expect(varreduras.leads).toBe(1);
  });

  it("base acima de POOL_MAX é cortada pelos MAIS NOVOS, e o corte é declarado", async () => {
    const db = new FakeFirestore();
    // POOL_MAX + 1 leads: o de criadoEm mais recente é o que sobra de fora.
    for (let i = 0; i <= POOL_MAX; i++) {
      const id = `ChIJ${String(i).padStart(5, "0")}`;
      const dia = String((i % 27) + 1).padStart(2, "0");
      db.seed(
        `leads/${id}`,
        lead(id, { criadoEm: `2026-01-${dia}T00:00:00.000Z` }) as unknown as Record<string, unknown>,
      );
    }

    const pool = await construirPool(db, AGORA);

    expect(pool.candidatos).toHaveLength(POOL_MAX);
    expect(pool.lidos).toBe(POOL_MAX + 1);
    // O corte nunca é silencioso: quem lê o doc sabe que a base passou do teto.
    expect(pool.truncado).toBe(true);
    // E quem ficou de fora foi o mais NOVO — quem esperou mais continua na fila.
    const cortado = pool.candidatos.at(-1)!;
    expect(cortado.criadoEm <= "2026-01-27T00:00:00.000Z").toBe(true);
    expect(pool.candidatos[0].criadoEm).toBe("2026-01-01T00:00:00.000Z");
  });
});
