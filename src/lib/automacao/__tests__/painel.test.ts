import { describe, expect, it } from "vitest";

import { FILA_CANDIDATOS_COLLECTION, FILA_CANDIDATOS_DOC, construirPool } from "@/lib/fila/candidatos";
import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";

import { DISPARO_PENDENTE_MS, disparoPendente, execucaoAtiva } from "../disparo";
import { calcularEstoque } from "../estoque";
import { montarPainelAutomacao, resumirExecucao } from "../painel";
import { execucaoMorta, resumoCabecalho, type PainelAutomacao } from "../painelTipos";
import type { ExecucaoAutomacao } from "../execucao";

/**
 * Sem corte do legado (`""`): este arquivo testa OUTRAS regras, e os leads
 * dele são de março — antes do corte padrão. O corte tem testes próprios
 * (`fila-legado.route.test.ts`).
 */
const SEM_CORTE = "";

const AGORA = new Date("2026-09-20T12:00:00Z");

function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    endereco: "Av. Brasil, 100 - Centro, Maringá - PR, 87013-000, Brasil",
    busca: { nicho: "barbearia", regiao: "Maringá", em: "2026-09-01T00:00:00.000Z" },
    demo: { skinId: "barbearia-editorial", themeId: "creme", dados: {}, criadoEm: "2026-09-19T06:40:00.000Z", atualizadoEm: "x" },
    horarios: { faixas: [], utcOffsetMinutes: -180, obtidoEm: "2026-09-01T00:00:00.000Z" },
    capturas: {
      estado: "pronto",
      execucaoId: "e1",
      pedidoEm: "2026-09-01T00:00:00.000Z",
      imagens: [
        { ancora: "servicos", tela: "celular", ordem: 2, url: "https://s/servicos.png", largura: 1, altura: 1 },
        { ancora: "hero", tela: "desktop", ordem: 1, url: "https://s/hero-desk.png", largura: 1, altura: 1 },
        { ancora: "hero", tela: "celular", ordem: 1, url: "https://s/hero-cel.png", largura: 1, altura: 1 },
      ],
    },
    criadoEm: "2026-09-01T00:00:00.000Z",
    atualizadoEm: "2026-09-01T00:00:00.000Z",
    ...overrides,
  } as Lead;
}

function demoAuto(aprovacao?: "pendente" | "aprovada" | "reprovada"): Lead["demo"] {
  return {
    skinId: "barbearia-editorial",
    themeId: "creme",
    dados: {},
    criadoEm: "2026-09-20T06:40:00.000Z",
    atualizadoEm: "x",
    origem: "automacao",
    ...(aprovacao && { aprovacao }),
  };
}

function semear(db: FakeFirestore, ...leads: Lead[]) {
  for (const l of leads) db.seed(`leads/${l.placeId}`, l as unknown as Record<string, unknown>);
}

/** Uma base com um lead em cada situação que o estoque distingue. */
function base(db: FakeFirestore) {
  semear(
    db,
    lead("pronto-1"),
    lead("pronto-2", { criadoEm: "2026-08-20T00:00:00.000Z" }),
    lead("pendente-print", { demo: demoAuto("pendente") }),
    lead("pendente-gerando", {
      demo: demoAuto(),
      capturas: { estado: "rodando", execucaoId: "e2", pedidoEm: "2026-09-20T11:55:00.000Z" },
      criadoEm: "2026-08-25T00:00:00.000Z",
    }),
    lead("manual-gerando", {
      capturas: { estado: "enfileirado", execucaoId: "e3", pedidoEm: "2026-09-20T11:58:00.000Z" },
    }),
    lead("aprovada", { demo: demoAuto("aprovada") }),
    lead("reprovada", { demo: demoAuto("reprovada") }),
    lead("contactado-pendente", { status: "contactado", demo: demoAuto("pendente") }),
    lead("teste-fixo", { leadDeTeste: true, demo: demoAuto("pendente") }),
  );
}

describe("pool da fila apura o estoque e a fila de aprovação na mesma passada", () => {
  it("o estoque do pool é o MESMO de calcularEstoque", async () => {
    const db = new FakeFirestore();
    base(db);
    const pool = await construirPool(db, AGORA, { corteLegado: SEM_CORTE });
    expect(pool.estoque).toEqual(await calcularEstoque(db, AGORA));
    expect(pool.estoque).toEqual({ prontos: 3, aguardandoAprovacao: 1, capturasEmAndamento: 2, total: 6 });
  });

  it("fila de aprovação: só demo automática pendente no funil, ordem justa, sem o lead de teste", async () => {
    const db = new FakeFirestore();
    base(db);
    const pool = await construirPool(db, AGORA, { corteLegado: SEM_CORTE });
    // pendente-gerando é mais antigo (criadoEm 25/08) que pendente-print (01/09).
    expect(pool.aprovacaoPendentes).toEqual(["pendente-gerando", "pendente-print"]);
    expect(pool.aprovacaoPendentesTotal).toBe(2);
  });

  it("os candidatos não mudaram: o pool continua só com quem passa em candidatoEstavel", async () => {
    const db = new FakeFirestore();
    base(db);
    const pool = await construirPool(db, AGORA, { corteLegado: SEM_CORTE });
    expect(pool.candidatos.map((c) => c.id).sort()).toEqual(["aprovada", "pronto-1", "pronto-2"]);
  });
});

describe("montarPainelAutomacao", () => {
  it("config, estoque (com a hora do retrato) e a fila de aprovação com os detalhes do item", async () => {
    const db = new FakeFirestore();
    base(db);
    const painel = await montarPainelAutomacao(db, AGORA);

    expect(painel.config.ativo).toBe(false);
    expect(painel.estoque).toMatchObject({ total: 6, prontos: 3, geradoEm: AGORA.toISOString() });
    expect(painel.aprovacao.total).toBe(2);
    const [gerando, print] = painel.aprovacao.itens;
    expect(gerando).toMatchObject({
      leadId: "pendente-gerando",
      nome: "Lead pendente-gerando",
      nicho: "barbearia",
      cidade: "Maringá - PR",
      skinId: "barbearia-editorial",
      captura: { estado: "rodando" },
    });
    expect(gerando.captura.heroUrl).toBeUndefined();
    expect(gerando.skinNome).not.toBe("barbearia-editorial"); // nome legível do registro
    expect(print.captura).toMatchObject({ estado: "pronto", heroUrl: "https://s/hero-cel.png" });
  });

  it("reconfere cada item contra o doc fresco: o decidido sai mesmo com pool dentro do TTL", async () => {
    const db = new FakeFirestore();
    base(db);
    await montarPainelAutomacao(db, AGORA); // grava o pool
    const doc = db.getDoc("leads/pendente-print") as unknown as Lead;
    semear(db, { ...doc, demo: { ...doc.demo!, aprovacao: "aprovada" } });

    const painel = await montarPainelAutomacao(db, new Date(AGORA.getTime() + 60_000));
    expect(painel.aprovacao.itens.map((i) => i.leadId)).toEqual(["pendente-gerando"]);
    expect(painel.aprovacao.total).toBe(1);
  });

  it("pool anterior à última execução é refeito; posterior e dentro do TTL é reusado", async () => {
    const db = new FakeFirestore();
    base(db);
    await montarPainelAutomacao(db, AGORA);
    // Uma demo automática nova, criada por uma execução DEPOIS do retrato.
    semear(db, lead("nova", { demo: demoAuto("pendente") }));

    const umMinuto = new Date(AGORA.getTime() + 60_000);
    expect((await montarPainelAutomacao(db, umMinuto)).aprovacao.total).toBe(2);

    db.seed("automacao/ultima", { execucaoId: "x", estado: "concluida", em: new Date(AGORA.getTime() + 30_000).toISOString() });
    const depois = await montarPainelAutomacao(db, umMinuto);
    expect(depois.aprovacao.total).toBe(3);
    expect(depois.estoque?.geradoEm).toBe(umMinuto.toISOString());
  });

  it("pool gravado antes do retrato do estoque existir é refeito", async () => {
    const db = new FakeFirestore();
    base(db);
    db.seed(`${FILA_CANDIDATOS_COLLECTION}/${FILA_CANDIDATOS_DOC}`, {
      geradoEm: AGORA.toISOString(),
      candidatos: [],
      lidos: 0,
      truncado: false,
      estrutural: {},
      manuaisPendentes: [],
      manuaisPendentesTotal: 0,
    });
    const painel = await montarPainelAutomacao(db, AGORA);
    expect(painel.estoque?.total).toBe(6);
  });

  it("última execução resumida — com a falha e o motivo", async () => {
    const db = new FakeFirestore();
    const execucao: ExecucaoAutomacao = {
      id: "ex1",
      estado: "falhou",
      disparo: "schedule",
      runUrl: "https://github.com/x/y/actions/runs/1",
      iniciadaEm: "2026-09-20T06:30:00.000Z",
      atualizadaEm: "2026-09-20T06:40:00.000Z",
      finalizadaEm: "2026-09-20T06:40:00.000Z",
      alvo: 15,
      falta: 5,
      estoqueAntes: { prontos: 8, aguardandoAprovacao: 2, capturasEmAndamento: 0, total: 10 },
      unidades: [
        { id: "u1", tipo: "demo", leadId: "a", fonte: "existente", estado: "feita", tentativas: 1 },
        { id: "u2", tipo: "demo", leadId: "b", fonte: "existente", estado: "falhou", tentativas: 1, motivo: "x" },
        { id: "u3", tipo: "busca", estado: "nao_processada", tentativas: 0 },
      ],
      demosCriadas: ["a"],
      buscas: [{ parChave: "p", nicho: "barbearia", regiao: "Maringá", buscaId: "b", paginas: 2, novos: 4 }],
      paresTentados: ["p"],
      requisicoesBusca: 2,
      chamadasIA: 3,
      falhas: [{ unidadeId: "u2", tipo: "demo", leadId: "b", motivo: "validação falhou", em: "x" }],
      motivo: "erro: 3 erros seguidos",
      erro: "3 erros seguidos",
    };
    db.seed("automacaoExecucoes/ex1", execucao as unknown as Record<string, unknown>);
    db.seed("automacao/ultima", { execucaoId: "ex1", estado: "falhou", em: execucao.finalizadaEm! });

    const { ultima } = await montarPainelAutomacao(db, AGORA);
    expect(ultima).toEqual(resumirExecucao(execucao));
    expect(ultima).toMatchObject({
      estado: "falhou",
      demosCriadas: 1,
      buscas: 1,
      leadsNovos: 4,
      requisicoesBusca: 2,
      chamadasIA: 3,
      falhas: 1,
      primeiraFalha: "validação falhou",
      unidades: { feita: 1, falhou: 1, nao_processada: 1 },
      erro: "3 erros seguidos",
    });
  });
});

describe("execução ativa", () => {
  it("trava viva é execução ativa; vencida não é", async () => {
    const db = new FakeFirestore();
    db.seed("automacao/trava", { execucaoId: "ex1", expiraEm: "2026-09-20T12:05:00.000Z" });
    expect(await execucaoAtiva(db, AGORA)).toEqual({
      tipo: "execucao",
      execucaoId: "ex1",
      expiraEm: "2026-09-20T12:05:00.000Z",
    });
    expect(await execucaoAtiva(db, new Date("2026-09-20T12:06:00Z"))).toBeNull();
  });

  it("pedido de disparo pendente até o ponteiro andar ou o prazo vencer", () => {
    const em = "2026-09-20T11:58:00.000Z";
    expect(disparoPendente({ em, por: "admin" }, undefined, AGORA)).toEqual({ em, por: "admin" });
    expect(disparoPendente({ em }, { em: "2026-09-20T06:30:00.000Z" }, AGORA)).toEqual({ em });
    // planejar gravou o ponteiro depois do pedido: virou execução.
    expect(disparoPendente({ em }, { em: "2026-09-20T11:59:00.000Z" }, AGORA)).toBeUndefined();
    // workflow nunca começou: o botão não fica preso para sempre.
    const tarde = new Date(new Date(em).getTime() + DISPARO_PENDENTE_MS);
    expect(disparoPendente({ em }, undefined, tarde)).toBeUndefined();
    // pedido desfeito
    expect(disparoPendente({ em: "" }, undefined, AGORA)).toBeUndefined();
  });
});

describe("linha do cabeçalho fechado", () => {
  const painel = (over: Partial<PainelAutomacao> = {}): PainelAutomacao => ({
    config: {
      ativo: true,
      alvoEstoque: 15,
      aprovacaoAutomatica: false,
      textoIA: true,
      corteLegado: "2026-08-10",
      tetoBuscasNoite: 6,
      tetoIANoite: 20,
      intervaloParHoras: 20,
      saturacaoExecucoes: 3,
      saturacaoMinNovos: 3,
      expiracaoDemoHoras: 72,
    },
    expiracao: null,
    estoque: { prontos: 9, aguardandoAprovacao: 3, capturasEmAndamento: 0, total: 12, geradoEm: "x" },
    ultima: null,
    ativa: null,
    aprovacao: { itens: [], total: 3 },
    disparoDisponivel: true,
    ...over,
  });

  it("o formato pedido", () => {
    expect(resumoCabecalho(painel())).toBe("ligada · estoque 12/15 · 3 aguardando aprovação");
  });

  it("a forma curta do celular: sem a palavra estoque, e a falha antes dos pendentes", () => {
    expect(resumoCabecalho(painel(), true)).toBe("ligada · 12/15 · 3 a aprovar");
    const ativa = { tipo: "disparo" as const, em: "x" };
    expect(resumoCabecalho(painel({ ativa }), true)).toBe("ligada · 12/15 · rodando");
  });

  it("desligada, sem pendência e sem retrato", () => {
    expect(
      resumoCabecalho(
        painel({
          config: { ...painel().config, ativo: false },
          estoque: null,
          aprovacao: { itens: [], total: 0 },
        }),
      ),
    ).toBe("desligada");
  });

  it("falha da última execução aparece fechado — e a execução morta conta como falha", () => {
    const ultima = resumirExecucao({
      id: "ex1",
      estado: "rodando",
      disparo: "schedule",
      iniciadaEm: "x",
      atualizadaEm: "x",
      alvo: 15,
      falta: 3,
      unidades: [],
      demosCriadas: [],
      buscas: [],
      paresTentados: [],
      requisicoesBusca: 0,
      chamadasIA: 0,
      falhas: [],
    });
    expect(execucaoMorta(ultima, null)).toBe(true);
    expect(resumoCabecalho(painel({ ultima }))).toBe("ligada · estoque 12/15 · 3 aguardando aprovação · última falhou");
    const ativa = { tipo: "execucao" as const, execucaoId: "ex1", expiraEm: "y" };
    expect(execucaoMorta(ultima, ativa)).toBe(false);
    expect(resumoCabecalho(painel({ ultima, ativa }))).toBe("ligada · estoque 12/15 · 3 aguardando aprovação · rodando");
  });
});
