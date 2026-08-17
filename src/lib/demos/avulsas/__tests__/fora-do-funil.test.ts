import { beforeEach, describe, expect, it } from "vitest";

import { recalcularPenetracao } from "@/lib/buscas/penetracao";
import { BUSCAS_COLLECTION } from "@/lib/buscas/types";
import { montarFilaDoDia } from "@/lib/leads/hoje";
import { calcularPenetracaoSite } from "@/lib/leads/penetracao";
import { getMetrics, getMetricsPorUsuario } from "@/lib/leads/metrics";
import { listLeads, saveDemo, upsertLeads } from "@/lib/leads/repo";
import { LEADS_COLLECTION } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { getProgressoMetaUsuario } from "@/lib/usuarios/metas";

import { criarDemoAvulsa, listDemosAvulsas } from "../repo";
import { DEMOS_AVULSAS_COLLECTION } from "../types";

/**
 * REQUISITO CENTRAL DA FEATURE: a demo avulsa não entra em contagem
 * nenhuma do funil de prospecção. Ela não é lead, não conta em meta, não
 * entra na penetração por nicho/cidade, não aparece em /leads nem na fila
 * de /hoje.
 *
 * O que estes testes provam não é um filtro — é a CONSEQUÊNCIA de a
 * avulsa morar em coleção própria. Cada asserção aqui compara o funil
 * ANTES e DEPOIS de criar avulsas: nada pode mudar. Um dia em que alguém
 * mover a avulsa pra dentro de `/leads`, este arquivo é o que quebra.
 */

let db: FakeFirestore;

const CONFIG = { skinId: "barbearia-editorial", themeId: "creme" };
const AGORA = new Date("2026-08-10T12:00:00.000Z");

async function criarTresAvulsas() {
  await criarDemoAvulsa(db, { nome: "Avulsa 1" }, CONFIG, AGORA, "u1");
  await criarDemoAvulsa(db, { nome: "Avulsa 2", cidade: "Maringá - PR" }, CONFIG, AGORA, "u1");
  await criarDemoAvulsa(db, { nome: "Avulsa 3", pais: "Portugal" }, CONFIG, AGORA, "u2");
}

/** Um lead de verdade, com demo salva — o lado do funil que DEVE contar. */
async function criarLeadComDemo(placeId: string, buscaId: string) {
  await upsertLeads(
    db,
    [
      {
        placeId,
        nome: `Lead ${placeId}`,
        endereco: "Av. Brasil, 100",
        temSite: true,
        siteUrl: "https://site.com",
        siteProprio: true,
      },
    ],
    { nicho: "barbearia", regiao: "Maringá PR" },
    buscaId,
    AGORA,
  );
  await saveDemo(db, placeId, { ...CONFIG, dados: {} }, AGORA, "u1");
}

beforeEach(() => {
  db = new FakeFirestore();
});

describe("não vira lead", () => {
  it("criar avulsa não escreve nada em /leads", async () => {
    await criarTresAvulsas();
    expect(await listLeads(db)).toEqual([]);
    expect((await db.collection(LEADS_COLLECTION).get()).docs).toHaveLength(0);
  });

  it("as avulsas ficam na coleção própria", async () => {
    await criarTresAvulsas();
    expect((await db.collection(DEMOS_AVULSAS_COLLECTION).get()).docs).toHaveLength(3);
    expect(await listDemosAvulsas(db)).toHaveLength(3);
  });

  it("não aparecem em /leads nem misturadas com leads de verdade", async () => {
    await criarLeadComDemo("place-1", "busca-1");
    await criarTresAvulsas();

    const leads = await listLeads(db);
    expect(leads).toHaveLength(1);
    expect(leads[0].placeId).toBe("place-1");
  });
});

describe("não conta em métricas nem em metas", () => {
  it("`demosCriadas` do dashboard ignora as avulsas", async () => {
    await criarLeadComDemo("place-1", "busca-1");
    const antes = await getMetrics(db, AGORA);

    await criarTresAvulsas();
    expect(await getMetrics(db, AGORA)).toEqual(antes);
    expect(antes.demosCriadas).toBe(1);
  });

  it("o rollup por usuário ignora as avulsas do mesmo usuário", async () => {
    await criarLeadComDemo("place-1", "busca-1");
    const antes = await getMetricsPorUsuario(db, AGORA);

    await criarTresAvulsas();
    expect(await getMetricsPorUsuario(db, AGORA)).toEqual(antes);
    expect(antes.u1.demos).toBe(1);
  });

  it("meta de prospecção não se move (a avulsa não consome contador nenhum)", async () => {
    const metas = { prospeccoesDia: 5, prospeccoesSemana: 20 };
    const antes = await getProgressoMetaUsuario(db, "u1", metas, AGORA);

    await criarTresAvulsas();
    expect(await getProgressoMetaUsuario(db, "u1", metas, AGORA)).toEqual(antes);
    expect(antes.dia.usado).toBe(0);
  });
});

describe("não entra na penetração por nicho/cidade", () => {
  it("o agregado cacheado no doc da busca não muda", async () => {
    await criarLeadComDemo("place-1", "busca-1");
    await db.collection(BUSCAS_COLLECTION).doc("busca-1").set({
      id: "busca-1",
      nicho: "barbearia",
      regiao: "Maringá PR",
      criadaEm: AGORA.toISOString(),
    });

    const antes = (await recalcularPenetracao(db, "busca-1")).penetracao;
    await criarTresAvulsas();
    expect((await recalcularPenetracao(db, "busca-1")).penetracao).toEqual(antes);
    expect(antes!.total).toBe(1);
  });

  it("a agregação pura nunca vê uma avulsa (só recebe Lead[])", async () => {
    await criarLeadComDemo("place-1", "busca-1");
    await criarTresAvulsas();
    // A base da penetração é `listLeads`, e ela não alcança /demosAvulsas.
    expect(calcularPenetracaoSite(await listLeads(db)).total).toBe(1);
  });
});

describe("não entra na fila de /hoje", () => {
  it("nenhuma seção da fila cresce ao criar avulsas", async () => {
    await criarLeadComDemo("place-1", "busca-1");
    const opts = { followUpDias: 3, now: AGORA };

    const antes = montarFilaDoDia(await listLeads(db), opts);
    await criarTresAvulsas();
    const depois = montarFilaDoDia(await listLeads(db), opts);

    expect(depois).toEqual(antes);
    // "Demo pronta e lead ainda novo" é a seção que uma avulsa vazaria
    // primeiro, se ela fosse um lead: é demo salva com status "novo".
    expect(antes.demosParadas.map((l) => l.placeId)).toEqual(["place-1"]);
  });
});
