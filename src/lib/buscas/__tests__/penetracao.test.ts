import { beforeEach, describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { calcularPenetracaoGrupo, penetracaoParaLead, recalcularPenetracao } from "../penetracao";
import { getBusca } from "../repo";
import type { Lead } from "@/lib/leads/types";

let db: FakeFirestore;

function seedBusca(id: string, nicho: string, regiao: string, extra: Record<string, unknown> = {}) {
  db.seed(`buscas/${id}`, {
    id,
    nome: `${nicho} ${id}`,
    nicho,
    regiao,
    cor: "#2f82e0",
    criadaEm: "2026-07-01T00:00:00.000Z",
    totalCriados: 0,
    totalExistentes: 0,
    ...extra,
  });
}

function seedLead(placeId: string, buscaId: string[], over: Partial<Lead> = {}) {
  db.seed(`leads/${placeId}`, {
    placeId,
    nome: placeId,
    status: "novo",
    enriquecido: false,
    buscaId,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
    ...over,
  });
}

beforeEach(() => {
  db = new FakeFirestore();
});

describe("calcularPenetracaoGrupo", () => {
  it("reúne leads de TODAS as buscas com o mesmo nicho+região (não só a busca dada)", async () => {
    seedBusca("b1", "barbearia", "Maringá PR");
    seedBusca("b2", "barbearia", "Maringá PR"); // mesmo grupo, busca diferente
    seedBusca("b3", "barbearia", "Sarandi PR"); // região diferente — fora do grupo

    seedLead("l1", ["b1"], { siteProprio: true });
    seedLead("l2", ["b2"], { siteProprio: false, temSite: false });
    seedLead("l3", ["b3"], { siteProprio: false, temSite: false });

    const busca = await getBusca(db, "b1");
    const r = await calcularPenetracaoGrupo(db, busca);

    expect(r.total).toBe(2); // só l1 e l2 (b1+b2), l3 é de outra região
    expect(r.comSiteProprio).toBe(1);
    expect(r.semNada).toBe(1);
  });

  it("comparação de nicho+região ignora caixa e espaços extras", async () => {
    seedBusca("b1", "Barbearia", "Maringá PR");
    seedBusca("b2", "barbearia", "  maringá   pr  ");
    seedLead("l1", ["b1"], { siteProprio: true });
    seedLead("l2", ["b2"], { siteProprio: true });

    const busca = await getBusca(db, "b1");
    const r = await calcularPenetracaoGrupo(db, busca);

    expect(r.total).toBe(2);
  });
});

describe("recalcularPenetracao", () => {
  it("cacheia o agregado no doc da busca", async () => {
    seedBusca("b1", "barbearia", "Maringá PR");
    for (let i = 0; i < 5; i++) {
      seedLead(`l${i}`, ["b1"], { siteProprio: i < 3 });
    }

    const atualizada = await recalcularPenetracao(db, "b1");

    expect(atualizada.penetracao).toMatchObject({ total: 5, comSiteProprio: 3, semNada: 2 });
    expect(atualizada.penetracao?.percentuais).toEqual({
      comSiteProprio: 60,
      soRedeSocial: 0,
      semNada: 40,
    });
    expect(db.getDoc("buscas/b1")).toMatchObject({ penetracao: { total: 5 } });
  });

  it("recalcula ao ser chamada de novo, refletindo leads novos", async () => {
    seedBusca("b1", "barbearia", "Maringá PR");
    seedLead("l1", ["b1"], { siteProprio: true });
    await recalcularPenetracao(db, "b1");

    seedLead("l2", ["b1"], { siteProprio: false, temSite: false });
    const atualizada = await recalcularPenetracao(db, "b1");

    expect(atualizada.penetracao?.total).toBe(2);
  });
});

describe("penetracaoParaLead", () => {
  it("usa a busca mais recente do lead que já tem penetração cacheada", () => {
    const lead: Pick<Lead, "buscaId"> = { buscaId: ["antiga", "recente"] };
    const buscas = [
      { id: "antiga", nicho: "dentista", regiao: "Sarandi PR", penetracao: { total: 1, comSiteProprio: 1, soRedeSocial: 0, semNada: 0, desconhecidos: 0 } },
      { id: "recente", nicho: "barbearia", regiao: "Maringá PR", penetracao: { total: 8, comSiteProprio: 6, soRedeSocial: 1, semNada: 1, desconhecidos: 0, percentuais: { comSiteProprio: 75, soRedeSocial: 12, semNada: 13 } } },
    ];

    const r = penetracaoParaLead(lead, buscas);

    expect(r).toMatchObject({ nicho: "barbearia", regiao: "Maringá PR" });
    expect(r?.penetracao.percentuais?.comSiteProprio).toBe(75);
  });

  it("pula buscas sem penetração cacheada ainda", () => {
    const lead: Pick<Lead, "buscaId"> = { buscaId: ["b1", "b2"] };
    const buscas = [
      { id: "b1", nicho: "dentista", regiao: "Sarandi PR", penetracao: { total: 5, comSiteProprio: 5, soRedeSocial: 0, semNada: 0, desconhecidos: 0, percentuais: { comSiteProprio: 100, soRedeSocial: 0, semNada: 0 } } },
      { id: "b2", nicho: "dentista", regiao: "Sarandi PR" }, // ainda sem penetracao
    ];

    const r = penetracaoParaLead(lead, buscas);

    expect(r?.penetracao.total).toBe(5);
  });

  it("sem buscaId ou sem nenhuma busca com penetração → undefined", () => {
    expect(penetracaoParaLead({ buscaId: [] }, [])).toBeUndefined();
    expect(penetracaoParaLead({}, [])).toBeUndefined();
  });
});
