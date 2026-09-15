import { describe, expect, it } from "vitest";

import type { AppDb } from "@/lib/firestore-like";
import { DEFAULT_JANELAS_CONTATO } from "@/lib/leads/janelaContato";
import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";

import type { CandidatoFila } from "../candidatos";
import { DEFAULT_FILA_CONFIG, type FilaConfig } from "../config";
import { diaOperacionalKey, proximaViradaDiaOperacional, type FilaContadorSnapshot } from "../contadores";
import { contadorDoPainel, linhasDoPainel } from "../painel";

/**
 * As linhas do painel "Fila de envio". O que estes testes protegem: o
 * painel lê lead POR ID (nunca varre /leads), e RECONFERE cada linha contra
 * o doc fresco — o pool é cache, pode oferecer quem não serve mais, e uma
 * tela que mostrasse o lead recém-descartado como "próximo a receber
 * mensagem" seria pior do que mostrar uma linha a menos.
 */

// Terça, 10h em Brasília (offset -180) → faixa "bom" da barbearia (9h-11h30).
const TERCA_13H_UTC = new Date("2026-03-10T13:00:00Z");

function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    busca: { nicho: "Barbearia Masculina", regiao: "Maringá", em: "2026-03-01T00:00:00.000Z" },
    demo: { skinId: "barbearia-editorial" },
    horarios: { faixas: [], utcOffsetMinutes: -180, obtidoEm: "2026-03-01T00:00:00.000Z" },
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

function candidato(id: string, overrides: Partial<CandidatoFila> = {}): CandidatoFila {
  return {
    id,
    nicho: "barbearia masculina",
    offset: -180,
    faixas: [],
    criadoEm: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function config(overrides: Partial<FilaConfig> = {}): FilaConfig {
  return { ...DEFAULT_FILA_CONFIG, ...overrides };
}

function contador(overrides: Partial<FilaContadorSnapshot> = {}): FilaContadorSnapshot {
  return { totalDoDia: 0, ultimaHora: 0, segundosDesdeUltimoEvento: null, ...overrides };
}

/** Conta varreduras de coleção — a tela não pode varrer /leads atrás de nomes. */
function contandoVarreduras(base: FakeFirestore): { db: AppDb; varridas: () => string[] } {
  const varridas: string[] = [];
  const db: AppDb = {
    collection(name: string) {
      const real = base.collection(name);
      return {
        ...real,
        get: async () => {
          varridas.push(name);
          return real.get();
        },
      };
    },
    runTransaction: (fn) => base.runTransaction(fn),
  };
  return { db, varridas: () => varridas };
}

const OPCOES = {
  janelas: DEFAULT_JANELAS_CONTATO,
  niveisAceitos: ["bom"] as const,
  now: TERCA_13H_UTC,
  comProximaFaixa: false,
};

describe("linhasDoPainel", () => {
  it("nome, nicho CRU, nível e a hora local DO LEAD", async () => {
    const db = new FakeFirestore();
    db.seed("leads/a", lead("a") as unknown as Record<string, unknown>);

    const linhas = await linhasDoPainel(db, [candidato("a")], [{ id: "a", nivel: "bom" }], OPCOES);

    expect(linhas).toEqual([
      {
        leadId: "a",
        nome: "Lead a",
        // O normalizado do pool é "barbearia masculina"; a tela mostra o
        // que a pessoa digitou na busca.
        nicho: "Barbearia Masculina",
        nivel: "bom",
        horaLocal: "10h",
        proximaFaixa: null,
      },
    ]);
  });

  it("lê lead POR ID — nunca varre /leads atrás de nomes", async () => {
    const base = new FakeFirestore();
    base.seed("leads/a", lead("a") as unknown as Record<string, unknown>);
    base.seed("leads/b", lead("b") as unknown as Record<string, unknown>);
    const { db, varridas } = contandoVarreduras(base);

    await linhasDoPainel(db, [candidato("a")], [{ id: "a", nivel: "bom" }], OPCOES);

    expect(varridas()).toEqual([]);
  });

  it("lead DESCARTADO desde o rebuild some da lista — o pool oferece, a tela não mostra", async () => {
    const db = new FakeFirestore();
    db.seed("leads/a", lead("a", { descartado: true }) as unknown as Record<string, unknown>);
    db.seed("leads/b", lead("b") as unknown as Record<string, unknown>);

    const linhas = await linhasDoPainel(
      db,
      [candidato("a"), candidato("b")],
      [
        { id: "a", nivel: "bom" },
        { id: "b", nivel: "bom" },
      ],
      OPCOES,
    );

    expect(linhas.map((l) => l.leadId)).toEqual(["b"]);
  });

  it("lead que sumiu da base não vira linha sem nome", async () => {
    const db = new FakeFirestore();

    expect(await linhasDoPainel(db, [candidato("a")], [{ id: "a", nivel: "bom" }], OPCOES)).toEqual([]);
  });

  it("id fora do pool é ignorado (não dá para saber o fuso dele)", async () => {
    const db = new FakeFirestore();
    db.seed("leads/a", lead("a") as unknown as Record<string, unknown>);

    expect(await linhasDoPainel(db, [], [{ id: "a", nivel: "bom" }], OPCOES)).toEqual([]);
  });

  it("bloqueado: nível null quando fechado, e a PRÓXIMA FAIXA ACEITA", async () => {
    const db = new FakeFirestore();
    db.seed("leads/a", lead("a") as unknown as Record<string, unknown>);
    // 6h da manhã em Brasília: fechado (o padrão comercial estimado é 9h-18h).
    const madrugada = new Date("2026-03-10T09:00:00Z");

    const [linha] = await linhasDoPainel(db, [candidato("a")], [{ id: "a" }], {
      ...OPCOES,
      now: madrugada,
      comProximaFaixa: true,
    });

    expect(linha.nivel).toBeNull();
    expect(linha.horaLocal).toBe("6h");
    expect(linha.proximaFaixa).toEqual({ rotuloDia: "hoje", hora: "9h" });
  });

  it("a próxima faixa segue os NÍVEIS ACEITOS: com razoável liberado, a hora é mais cedo", async () => {
    const db = new FakeFirestore();
    // Sexta: a barbearia tem o "bom" rebaixado a razoável o dia inteiro, e
    // o próximo BOM só na segunda. Às 6h (local) o lead está fechado.
    db.seed("leads/a", lead("a") as unknown as Record<string, unknown>);
    const sextaCedo = new Date("2026-03-13T09:00:00Z");
    const alvo = [{ id: "a" }];

    const [soBom] = await linhasDoPainel(db, [candidato("a")], alvo, {
      ...OPCOES,
      now: sextaCedo,
      comProximaFaixa: true,
    });
    const [comRazoavel] = await linhasDoPainel(db, [candidato("a")], alvo, {
      ...OPCOES,
      niveisAceitos: ["bom", "razoavel"],
      now: sextaCedo,
      comProximaFaixa: true,
    });

    expect(soBom.proximaFaixa).toEqual({ rotuloDia: "segunda", hora: "9h" });
    expect(comRazoavel.proximaFaixa).toEqual({ rotuloDia: "hoje", hora: "9h" });
  });

  it("elegível não recebe próxima faixa — a resposta dele é AGORA", async () => {
    const db = new FakeFirestore();
    db.seed("leads/a", lead("a") as unknown as Record<string, unknown>);

    const [linha] = await linhasDoPainel(db, [candidato("a")], [{ id: "a", nivel: "bom" }], OPCOES);

    expect(linha.proximaFaixa).toBeNull();
  });

  it("preserva a ordem que a seleção entregou — a tela não reordena nada", async () => {
    const db = new FakeFirestore();
    for (const id of ["a", "b", "c"]) {
      db.seed(`leads/${id}`, lead(id) as unknown as Record<string, unknown>);
    }
    const ordem = [{ id: "c" }, { id: "a" }, { id: "b" }].map((x) => ({ ...x, nivel: "bom" as const }));

    const linhas = await linhasDoPainel(db, ["a", "b", "c"].map((id) => candidato(id)), ordem, OPCOES);

    expect(linhas.map((l) => l.leadId)).toEqual(["c", "a", "b"]);
  });
});

describe("contadorDoPainel", () => {
  it("enviados, meta e restante", async () => {
    const painel = contadorDoPainel(config({ metaDiaria: 15 }), contador({ totalDoDia: 7 }), TERCA_13H_UTC);

    expect(painel).toMatchObject({ enviados: 7, meta: 15, restante: 8 });
  });

  it("meta reduzida abaixo do que já saiu: restante 0, nunca negativo", () => {
    const painel = contadorDoPainel(config({ metaDiaria: 5 }), contador({ totalDoDia: 9 }), TERCA_13H_UTC);

    expect(painel.restante).toBe(0);
  });

  it("dia operacional e a virada batem com a chave que o contador usa", () => {
    const cfg = config({ inicioDiaOperacionalHora: 6 });
    const painel = contadorDoPainel(cfg, contador(), TERCA_13H_UTC);

    expect(painel.diaOperacional).toBe(diaOperacionalKey(TERCA_13H_UTC, 6));
    expect(painel.inicioHora).toBe(6);
    // 10h local de terça → a virada é às 6h de QUARTA.
    expect(painel.viraEm).toBe("2026-03-11T09:00:00.000Z");
  });
});

describe("proximaViradaDiaOperacional", () => {
  it("é exatamente o instante em que diaOperacionalKey muda", () => {
    for (const inicioHora of [0, 3, 6, 18, 23]) {
      const agora = new Date("2026-03-10T13:00:00Z");
      const virada = proximaViradaDiaOperacional(agora, inicioHora);

      const antes = new Date(virada.getTime() - 60_000);
      const depois = new Date(virada.getTime() + 60_000);
      expect(diaOperacionalKey(antes, inicioHora)).not.toBe(diaOperacionalKey(depois, inicioHora));
      // E nada muda entre agora e um minuto antes da virada.
      expect(diaOperacionalKey(agora, inicioHora)).toBe(diaOperacionalKey(antes, inicioHora));
    }
  });

  it("é sempre no futuro, mesmo no minuto exato da virada", () => {
    // 6h em ponto (local) com corte às 6h: a próxima é amanhã, não agora.
    const seisEmPonto = new Date("2026-03-10T09:00:00Z");
    const virada = proximaViradaDiaOperacional(seisEmPonto, 6);

    expect(virada.getTime()).toBeGreaterThan(seisEmPonto.getTime());
    expect(virada.toISOString()).toBe("2026-03-11T09:00:00.000Z");
  });

  it("corte 0 é a meia-noite de São Paulo", () => {
    expect(proximaViradaDiaOperacional(new Date("2026-03-10T13:00:00Z"), 0).toISOString()).toBe(
      "2026-03-11T03:00:00.000Z",
    );
  });
});
