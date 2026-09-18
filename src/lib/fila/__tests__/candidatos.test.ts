import { describe, expect, it } from "vitest";

import {
  MOTIVOS_ESTRUTURAIS,
  POOL_MAX,
  POOL_TTL_MS,
  candidatoEstavel,
  construirPool,
  estruturalVazio,
  lerPool,
  lerPoolBruto,
  motivoEstrutural,
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

describe("motivoEstrutural — o diagnóstico por trás de candidatoEstavel", () => {
  it("lead pronto: undefined (nenhum motivo)", () => {
    expect(motivoEstrutural(lead("ChIJa"))).toBeUndefined();
  });

  const casos: Array<[string, Partial<Lead>, (typeof MOTIVOS_ESTRUTURAIS)[number]]> = [
    ["status diferente de novo", { status: "contactado" }, "status"],
    ["descartado à mão", { descartado: true }, "descartado"],
    ["número marcado como sem WhatsApp", { telefoneInvalido: true }, "telefoneInvalido"],
    ["sem telefone nenhum", { telefoneIntl: undefined }, "semTelefone"],
    ["sem demo", { demo: undefined }, "semDemo"],
    [
      "capturas ainda rodando",
      { capturas: { estado: "rodando", execucaoId: "e", pedidoEm: "x" } as Lead["capturas"] },
      "capturaNaoPronta",
    ],
    [
      "capturas prontas mas sem imagem de celular (mesmo balde: a peça não existe)",
      {
        capturas: {
          estado: "pronto",
          execucaoId: "e",
          pedidoEm: "x",
          imagens: [{ ancora: "hero", tela: "desktop", ordem: 1, url: "u", largura: 1, altura: 1 }],
        } as Lead["capturas"],
      },
      "capturaNaoPronta",
    ],
    ["sem fuso derivável", { horarios: undefined, endereco: undefined }, "semFuso"],
    [
      "seloContato gravado (clique manual do WhatsApp)",
      { seloContato: { userId: "u1", em: "2026-03-05T12:00:00.000Z" } },
      "contactadoForaDaFila",
    ],
    [
      "registrosEnvio não vazio (mesmo sem seloContato)",
      {
        registrosEnvio: [
          { em: "2026-03-05T12:00:00.000Z", horaLocalLead: "09:00", diaSemanaLocalLead: 4 },
        ],
      },
      "contactadoForaDaFila",
    ],
    [
      "contato.primeiroContatoEm preenchido",
      { contato: { primeiroContatoEm: "2026-03-05T12:00:00.000Z" } },
      "contactadoForaDaFila",
    ],
  ];
  for (const [nome, override, esperado] of casos) {
    it(`${nome} → "${esperado}"`, () => {
      expect(motivoEstrutural(lead("ChIJa", override))).toBe(esperado);
    });
  }

  it("quando vários filtros falham ao mesmo tempo, conta pelo PRIMEIRO da ordem de avaliação", () => {
    // descartado E telefoneInvalido juntos: "descartado" é checado antes.
    expect(
      motivoEstrutural(lead("ChIJa", { descartado: true, telefoneInvalido: true })),
    ).toBe("descartado");
  });

  describe("contactadoForaDaFila — o clique manual do WhatsApp, que não mexe em status", () => {
    it("lead com seloContato e status ainda 'novo' é excluído, com a razão nova", () => {
      const l = lead("ChIJa", { seloContato: { userId: "u1", em: "2026-03-05T12:00:00.000Z" } });
      expect(l.status).toBe("novo"); // a premissa do buraco: o clique não mudou status
      expect(motivoEstrutural(l)).toBe("contactadoForaDaFila");
    });

    it("lead enviado PELA fila (status e selo mudam juntos, na confirmação) retorna \"status\" — não a razão nova", () => {
      // `confirmarEnvio` grava status e selo na MESMA transação: quem chega
      // aqui com selo tem status !== "novo" também, e "status" é checado
      // ANTES — a ordem certa não rotula o envio automático como "fora da
      // fila", que seria mentira (ver o comentário de `motivoEstrutural`).
      const l = lead("ChIJa", {
        status: "contactado",
        seloContato: { userId: "u1", em: "2026-03-05T12:00:00.000Z" },
        registrosEnvio: [
          { em: "2026-03-05T12:00:00.000Z", horaLocalLead: "09:00", diaSemanaLocalLead: 4 },
        ],
        contato: { primeiroContatoEm: "2026-03-05T12:00:00.000Z" },
      });
      expect(motivoEstrutural(l)).toBe("status");
    });
  });

  it("o telefone do enriquecimento vale quando o da busca falta — não conta como semTelefone", () => {
    const l = lead("ChIJa", {
      telefoneIntl: undefined,
      detalhes: { telefoneIntl: "+55 44 90000-0000", enriquecidoEm: "x" } as Lead["detalhes"],
    });
    expect(motivoEstrutural(l)).toBeUndefined();
  });

  it("tentativas esgotadas não é um motivo ESTRUTURAL — motivoEstrutural nem olha o envio", () => {
    // O lead em si está limpo; só a fila (envio) o exclui — ver candidatoEstavel.
    expect(motivoEstrutural(lead("ChIJa"))).toBeUndefined();
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

  it("conta o diagnóstico estrutural na MESMA passada — cada lead barrado cai no balde certo", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ok", lead("ok") as unknown as Record<string, unknown>);
    db.seed("leads/status", lead("status", { status: "contactado" }) as unknown as Record<string, unknown>);
    db.seed("leads/descartado", lead("descartado", { descartado: true }) as unknown as Record<string, unknown>);
    db.seed(
      "leads/invalido",
      lead("invalido", { telefoneInvalido: true }) as unknown as Record<string, unknown>,
    );
    db.seed(
      "leads/semtel",
      lead("semtel", { telefoneIntl: undefined }) as unknown as Record<string, unknown>,
    );
    db.seed("leads/semdemo", lead("semdemo", { demo: undefined }) as unknown as Record<string, unknown>);
    db.seed(
      "leads/semcaptura",
      lead("semcaptura", {
        capturas: { estado: "rodando", execucaoId: "e", pedidoEm: "x" } as Lead["capturas"],
      }) as unknown as Record<string, unknown>,
    );
    db.seed(
      "leads/semfuso",
      lead("semfuso", { horarios: undefined, endereco: undefined }) as unknown as Record<string, unknown>,
    );
    db.seed(
      "leads/foradafila",
      lead("foradafila", {
        seloContato: { userId: "u1", em: "2026-03-05T12:00:00.000Z" },
      }) as unknown as Record<string, unknown>,
    );

    const pool = await construirPool(db, AGORA);

    expect(pool.candidatos.map((c) => c.id)).toEqual(["ok"]);
    expect(pool.estrutural).toEqual({
      status: 1,
      contactadoForaDaFila: 1,
      descartado: 1,
      telefoneInvalido: 1,
      semTelefone: 1,
      semDemo: 1,
      capturaNaoPronta: 1,
      semFuso: 1,
    });
    // A contagem do funil bate com quem de fato ficou de fora do pool.
    expect(pool.candidatos.map((c) => c.id)).not.toContain("foradafila");
  });

  it("lead barrado só por tentativas esgotadas some do pool sem incrementar contador estrutural nenhum", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    db.seed(
      "filaEnvios/ChIJa",
      envio({ estado: "falhou", tentativas: 3 }) as unknown as Record<string, unknown>,
    );

    const pool = await construirPool(db, AGORA);

    expect(pool.candidatos).toEqual([]);
    expect(pool.estrutural).toEqual(estruturalVazio());
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

describe("lerPoolBruto — leitura para o diagnóstico, sem TTL e sem reconstruir", () => {
  it("pool nunca construído: undefined, e nenhuma varredura de /leads acontece", async () => {
    const base = new FakeFirestore();
    base.seed("leads/ChIJa", lead("ChIJa") as unknown as Record<string, unknown>);
    const { db, varreduras } = comContador(base);

    const pool = await lerPoolBruto(db);

    expect(pool).toBeUndefined();
    expect(varreduras.leads ?? 0).toBe(0);
  });

  it("devolve o pool mesmo BEM além do TTL, sem reconstruir", async () => {
    const base = new FakeFirestore();
    base.seed("leads/ChIJnovo", lead("ChIJnovo") as unknown as Record<string, unknown>);
    base.seed("filaCandidatos/pool", {
      geradoEm: new Date(AGORA.getTime() - 10 * POOL_TTL_MS).toISOString(),
      candidatos: [{ id: "ChIJvelho", nicho: "barbearia", offset: 0, faixas: [], criadoEm: "2020-01-01T00:00:00.000Z" }],
      lidos: 5,
      truncado: false,
      estrutural: estruturalVazio(),
    });
    const { db, varreduras } = comContador(base);

    const pool = await lerPoolBruto(db);

    expect(pool?.candidatos.map((c) => c.id)).toEqual(["ChIJvelho"]);
    expect(varreduras.leads ?? 0).toBe(0);
  });

  it("doc anterior à migração (sem 'estrutural') normaliza para zero, não quebra", async () => {
    const db = new FakeFirestore();
    db.seed("filaCandidatos/pool", {
      geradoEm: AGORA.toISOString(),
      candidatos: [],
      lidos: 3,
      truncado: false,
      // sem campo `estrutural` — doc escrito antes desta mudança existir.
    });

    const pool = await lerPoolBruto(db);

    expect(pool?.estrutural).toEqual(estruturalVazio());
  });

  it("doc corrompido/ausente é undefined, não erro", async () => {
    const db = new FakeFirestore();
    db.seed("filaCandidatos/pool", { lixo: true });

    await expect(lerPoolBruto(db)).resolves.toBeUndefined();
  });
});
