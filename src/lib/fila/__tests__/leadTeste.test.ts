import { describe, expect, it } from "vitest";

import { calcularPenetracaoGrupo } from "@/lib/buscas/penetracao";
import { getMetrics, getMetricsPorUsuario } from "@/lib/leads/metrics";
import { listLeads } from "@/lib/leads/repo";
import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";

import { construirPool } from "../candidatos";
import { LEAD_TESTE_ID, ehLeadDeTeste, garantirLeadDeTeste, leadDeTesteInicial } from "../leadTeste";

/**
 * O INVENTÁRIO — o trabalho central do lead fixo de teste não é criá-lo, é
 * garantir que ele não vaze para lugar nenhum.
 *
 * Um lead de teste somado à penetração de site por nicho envenena, EM
 * SILÊNCIO, um número que é usado como argumento de venda; somado ao pool
 * da fila, manda mensagem de verdade sozinho às dez da noite. Cada teste
 * abaixo cobre uma das varreduras que existem hoje, e todos comparam o
 * MESMO cenário com e sem a marcação — um agregado que passasse a incluir
 * o lead de teste quebraria aqui, não em produção.
 */

const AGORA = new Date("2026-03-10T10:00:00Z");
const EM = "2026-03-10T09:00:00.000Z";

function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    siteProprio: true,
    temSite: true,
    busca: { nicho: "barbearia", regiao: "Maringá", em: EM },
    buscaId: ["busca-1"],
    demo: { skinId: "barbearia-editorial", criadoPor: "u1" },
    horarios: { faixas: [], utcOffsetMinutes: -180, obtidoEm: EM },
    capturas: {
      estado: "pronto",
      execucaoId: "e1",
      pedidoEm: EM,
      imagens: [{ ancora: "hero", tela: "celular", ordem: 1, url: "u", largura: 1, altura: 1 }],
    },
    contato: { primeiroContatoEm: EM, primeiroContatoPor: "u1" },
    criadoEm: EM,
    atualizadoEm: EM,
    ...overrides,
  } as Lead;
}

/**
 * O lead de teste com a MESMA forma do lead normal acima — mudando só a
 * marcação. É isso que torna cada asserção abaixo uma prova: o que o tira
 * do agregado é `leadDeTeste`, não um dado faltando por acaso.
 */
function leadTeste(): Lead {
  return lead(LEAD_TESTE_ID, { leadDeTeste: true, nome: "Barbearia Dom Aurélio" });
}

function comLeads(...leads: Lead[]): FakeFirestore {
  const db = new FakeFirestore();
  for (const l of leads) db.seed(`leads/${l.placeId}`, l as unknown as Record<string, unknown>);
  return db;
}

describe("lead fixo de teste — o doc", () => {
  it("nasce com nicho de skin registrada, demo e horário de funcionamento", () => {
    const inicial = leadDeTesteInicial();
    expect(inicial.placeId).toBe(LEAD_TESTE_ID);
    expect(inicial.leadDeTeste).toBe(true);
    expect(inicial.demo?.skinId).toBe("barbearia-editorial");
    expect(inicial.busca?.nicho).toBe("barbearia");
    expect(inicial.horarios?.faixas.length).toBeGreaterThan(0);
    expect(inicial.horarios?.utcOffsetMinutes).toBe(-180);
    // Um negócio plausível: se a mensagem escapar, parece prospecção normal.
    expect(inicial.nome).not.toMatch(/teste/i);
    expect(inicial.endereco).toBeTruthy();
  });

  it("não tem forma de placeId do Google — busca nenhuma pode sobrescrevê-lo", () => {
    expect(LEAD_TESTE_ID.startsWith("ChIJ")).toBe(false);
  });

  it("garantirLeadDeTeste cria uma vez e NUNCA sobrescreve o que já existe", async () => {
    const db = new FakeFirestore();
    const criado = await garantirLeadDeTeste(db);
    expect(criado.placeId).toBe(LEAD_TESTE_ID);

    // A captura gerada à mão pelo operador é o que não pode ser perdido:
    // é ela que faz o alvo estar PRONTO na noite do teste.
    db.seed(`leads/${LEAD_TESTE_ID}`, {
      ...(criado as unknown as Record<string, unknown>),
      capturas: {
        estado: "pronto",
        execucaoId: "gerada-a-mao",
        pedidoEm: EM,
        imagens: [{ ancora: "hero", tela: "celular", ordem: 1, url: "u", largura: 1, altura: 1 }],
      },
    });

    const segunda = await garantirLeadDeTeste(db);
    expect(segunda.capturas?.execucaoId).toBe("gerada-a-mao");
  });

  it("ehLeadDeTeste só reconhece a marcação explícita", () => {
    expect(ehLeadDeTeste(leadDeTesteInicial())).toBe(true);
    expect(ehLeadDeTeste(lead("ChIJa"))).toBe(false);
    expect(ehLeadDeTeste(undefined)).toBe(false);
  });
});

describe("lead fixo de teste — fora de toda listagem e agregado", () => {
  it("listLeads não o devolve (e com ele /leads, /demos, /hoje, /mundo e a análise de grupo)", async () => {
    const db = comLeads(lead("ChIJa"), leadTeste());
    const leads = await listLeads(db);
    expect(leads.map((l) => l.placeId)).toEqual(["ChIJa"]);
  });

  it("listLeads não o devolve nem com filtro que ele casaria", async () => {
    const db = comLeads(leadTeste());
    expect(await listLeads(db, { status: "novo" })).toHaveLength(0);
    expect(await listLeads(db, { buscaId: "busca-1" })).toHaveLength(0);
    expect(await listLeads(db, { temSite: "com" })).toHaveLength(0);
  });

  it("não entra na penetração de site por nicho+cidade", async () => {
    const db = comLeads(
      ...["a", "b", "c", "d", "e"].map((s) => lead(`ChIJ${s}`, { siteProprio: true })),
      // Sem site próprio: entraria como o único "semNada" e derrubaria o
      // percentual de 100% para 83% — o número que vai numa conversa.
      leadTeste(),
    );
    db.seed("buscas/busca-1", {
      id: "busca-1",
      nome: "barbearia",
      nicho: "barbearia",
      regiao: "Maringá",
      criadoEm: EM,
    });

    const penetracao = await calcularPenetracaoGrupo(db, {
      id: "busca-1",
      nicho: "barbearia",
      regiao: "Maringá",
    });
    expect(penetracao.total).toBe(5);
    expect(penetracao.percentuais?.comSiteProprio).toBe(100);
  });

  it("não conta em getMetrics — nem em demosCriadas, que ele inflaria de fábrica", async () => {
    const semTeste = await getMetrics(comLeads(lead("ChIJa")), AGORA);
    const comTeste = await getMetrics(comLeads(lead("ChIJa"), leadTeste()), AGORA);
    expect(comTeste).toEqual(semTeste);
    expect(comTeste.demosCriadas).toBe(1);
    expect(comTeste.contatosHoje).toBe(1);
  });

  it("não conta no rollup por integrante (demos, contatos, fechamentos)", async () => {
    const db = comLeads(
      lead("ChIJa"),
      leadTeste(),
      leadDeTesteInicial(),
    );
    const rollup = await getMetricsPorUsuario(db, AGORA);
    expect(rollup.u1).toEqual({ buscas: 0, demos: 1, contatos: 1, fechamentosMes: 0 });
  });

  it("não entra no pool da fila — nem como candidato, nem em `lidos`, nem no funil", async () => {
    const db = comLeads(lead("ChIJa"), leadTeste());
    const pool = await construirPool(db, AGORA);

    expect(pool.candidatos.map((c) => c.id)).toEqual(["ChIJa"]);
    expect(pool.lidos).toBe(1);
    expect(Object.values(pool.estrutural).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("não entra no pool nem quando reprovaria numa peneira estrutural", async () => {
    // Descartado à mão: contaria em `estrutural.descartado` e mexeria no
    // funil da tela — o lead de teste não existe para aquela contagem.
    const db = comLeads(leadTeste(), lead(LEAD_TESTE_ID + "-2", { leadDeTeste: true, descartado: true }));
    const pool = await construirPool(db, AGORA);
    expect(pool.lidos).toBe(0);
    expect(pool.estrutural.descartado).toBe(0);
  });
});
