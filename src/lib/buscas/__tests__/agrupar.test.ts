import { describe, expect, it } from "vitest";

import {
  MODOS_AGRUPAMENTO_BUSCAS,
  agruparBuscas,
  agruparPorBusca,
} from "../agrupar";
import type { Busca } from "../types";

interface Item {
  id: string;
  buscaId?: string[];
}

function makeBusca(id: string, nome: string, extra: Partial<Busca> = {}): Busca {
  return {
    id,
    nome,
    nicho: "barbearia",
    regiao: "Maringá, PR",
    cor: "#2f82e0",
    criadaEm: "2026-07-01T00:00:00.000Z",
    totalCriados: 0,
    totalExistentes: 0,
    ...extra,
  } as Busca;
}

describe("agruparPorBusca", () => {
  it("agrupa cada item na busca correspondente, um grupo por busca com itens", () => {
    const buscas = [makeBusca("b1", "Barbearias Maringá"), makeBusca("b2", "Tatuagem Curitiba")];
    const itens: Item[] = [
      { id: "l1", buscaId: ["b1"] },
      { id: "l2", buscaId: ["b2"] },
      { id: "l3", buscaId: ["b1"] },
    ];
    const grupos = agruparPorBusca(itens, buscas, (i) => i.buscaId);
    expect(grupos.map((g) => g.chave)).toEqual(["b1", "b2"]);
    expect(grupos[0].titulo).toBe("Barbearias Maringá");
    expect(grupos[0].cor).toBe("#2f82e0");
    expect(grupos[0].itens.map((i) => i.id)).toEqual(["l1", "l3"]);
    expect(grupos[1].itens.map((i) => i.id)).toEqual(["l2"]);
  });

  it("busca sem item nenhum não vira grupo vazio", () => {
    const buscas = [makeBusca("b1", "Com leads"), makeBusca("b2", "Sem leads")];
    const itens: Item[] = [{ id: "l1", buscaId: ["b1"] }];
    const grupos = agruparPorBusca(itens, buscas, (i) => i.buscaId);
    expect(grupos.map((g) => g.chave)).toEqual(["b1"]);
  });

  it('item sem buscaId (ou de busca desconhecida) cai em "Sem busca", no fim', () => {
    const buscas = [makeBusca("b1", "Grupo")];
    const itens: Item[] = [
      { id: "l1", buscaId: ["b1"] },
      { id: "l2" },
      { id: "l3", buscaId: ["busca-apagada"] },
    ];
    const grupos = agruparPorBusca(itens, buscas, (i) => i.buscaId);
    expect(grupos.map((g) => g.chave)).toEqual(["b1", "__sem_busca__"]);
    expect(grupos[1].titulo).toBe("Sem busca");
    expect(grupos[1].cor).toBeUndefined();
    expect(grupos[1].itens.map((i) => i.id)).toEqual(["l2", "l3"]);
  });

  it("item em duas buscas aparece em cada grupo correspondente", () => {
    const buscas = [makeBusca("b1", "Grupo 1"), makeBusca("b2", "Grupo 2")];
    const itens: Item[] = [{ id: "l1", buscaId: ["b1", "b2"] }];
    const grupos = agruparPorBusca(itens, buscas, (i) => i.buscaId);
    expect(grupos[0].itens.map((i) => i.id)).toEqual(["l1"]);
    expect(grupos[1].itens.map((i) => i.id)).toEqual(["l1"]);
  });

  it("sem nenhuma busca e todos os itens sem buscaId: um único grupo Sem busca", () => {
    const itens: Item[] = [{ id: "l1" }, { id: "l2" }];
    const grupos = agruparPorBusca(itens, [], (i) => i.buscaId);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].chave).toBe("__sem_busca__");
  });

  it("sem itens: nenhum grupo", () => {
    expect(agruparPorBusca<Item>([], [makeBusca("b1", "X")], (i) => i.buscaId)).toEqual([]);
  });
});

describe("agruparPorBusca — busca de origem no grupo", () => {
  it("o grupo carrega a busca (o cabeçalho fechado precisa da procedência)", () => {
    const busca = makeBusca("b1", "Dentistas — Centro", {
      nicho: "dentista",
      regiao: "Porto Alegre RS",
      userId: "membro-1",
    });
    const grupos = agruparPorBusca<Item>(
      [{ id: "l1", buscaId: ["b1"] }],
      [busca],
      (i) => i.buscaId,
    );
    expect(grupos[0].busca).toBe(busca);
  });

  it('"Sem busca" não tem procedência nenhuma — não há busca de origem', () => {
    const grupos = agruparPorBusca<Item>([{ id: "l1" }], [], (i) => i.buscaId);
    expect(grupos[0].busca).toBeUndefined();
  });
});

describe("agruparBuscas", () => {
  it("modo nenhum: um grupo único com a lista intacta", () => {
    const buscas = [makeBusca("b1", "A"), makeBusca("b2", "B")];
    const grupos = agruparBuscas(buscas, "nenhum");
    expect(grupos).toHaveLength(1);
    expect(grupos[0].itens).toEqual(buscas);
  });

  it("lista vazia não vira grupo vazio em nenhum dos modos", () => {
    for (const modo of MODOS_AGRUPAMENTO_BUSCAS) {
      expect(agruparBuscas([], modo)).toEqual([]);
    }
  });

  it("por mês: um grupo por mês, na ordem em que a lista chegou (mais recente primeiro)", () => {
    const buscas = [
      makeBusca("b1", "A", { criadaEm: "2026-08-09T12:00:00.000Z" }),
      makeBusca("b2", "B", { criadaEm: "2026-08-01T12:00:00.000Z" }),
      makeBusca("b3", "C", { criadaEm: "2026-06-20T12:00:00.000Z" }),
    ];
    const grupos = agruparBuscas(buscas, "mes");
    expect(grupos.map((g) => g.chave)).toEqual(["mes:2026-08", "mes:2026-06"]);
    expect(grupos[0].titulo).toBe("Agosto de 2026");
    expect(grupos[0].itens.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(grupos[1].itens.map((b) => b.id)).toEqual(["b3"]);
  });

  it("o mês é o de São Paulo, não o do ISO cru", () => {
    // 22h do dia 31/07 em Brasília = 01/08 01:00 UTC: é busca de JULHO
    // para quem a rodou.
    const grupos = agruparBuscas(
      [makeBusca("b1", "A", { criadaEm: "2026-08-01T01:00:00.000Z" })],
      "mes",
    );
    expect(grupos[0].chave).toBe("mes:2026-07");
  });

  it("data ilegível não some da tela nem contamina outro mês", () => {
    const grupos = agruparBuscas([makeBusca("b1", "A", { criadaEm: "sei lá" })], "mes");
    expect(grupos[0].chave).toBe("mes:sem-data");
    expect(grupos[0].itens.map((b) => b.id)).toEqual(["b1"]);
  });

  it("por nicho: caixa e espaço não criam dois grupos do mesmo nicho", () => {
    const buscas = [
      makeBusca("b1", "A", { nicho: "Dentista" }),
      makeBusca("b2", "B", { nicho: " dentista " }),
      makeBusca("b3", "C", { nicho: "barbearia" }),
    ];
    const grupos = agruparBuscas(buscas, "nicho");
    expect(grupos.map((g) => g.chave)).toEqual(["nicho:dentista", "nicho:barbearia"]);
    expect(grupos[0].titulo).toBe("Dentista");
    expect(grupos[0].itens.map((b) => b.id)).toEqual(["b1", "b2"]);
  });

  it("busca sem nicho cai num grupo próprio, não no primeiro que aparecer", () => {
    const grupos = agruparBuscas(
      [makeBusca("b1", "A", { nicho: "" }), makeBusca("b2", "B", { nicho: "dentista" })],
      "nicho",
    );
    expect(grupos.map((g) => g.chave)).toEqual(["nicho:sem-nicho", "nicho:dentista"]);
    expect(grupos[0].titulo).toBe("Sem nicho");
  });
});
