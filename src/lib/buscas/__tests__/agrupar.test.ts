import { describe, expect, it } from "vitest";

import { agruparPorBusca } from "../agrupar";
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
