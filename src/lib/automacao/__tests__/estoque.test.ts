import { describe, expect, it } from "vitest";

import type { FilaEnvioDoc } from "@/lib/fila/estado";
import type { Lead } from "@/lib/leads/types";
import { FakeFirestore } from "@/lib/testing/fake-firestore";
import { calcularEstoque, classificarEstoque, somarEstoque } from "../estoque";

/**
 * Sem corte do legado (`""`): este arquivo testa OUTRAS regras, e os leads
 * dele são de março — antes do corte padrão. O corte tem testes próprios
 * (`fila-legado.route.test.ts`).
 */
const SEM_CORTE = "";

const AGORA = new Date("2026-09-20T06:30:00Z");

/** Um lead PRONTO: passa em todos os filtros estruturais da fila. */
function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    placeId: id,
    nome: `Lead ${id}`,
    status: "novo",
    enriquecido: false,
    telefoneIntl: "+55 44 99154-3803",
    busca: { nicho: "barbearia", regiao: "Maringá", em: "2026-09-01T00:00:00.000Z" },
    demo: { skinId: "barbearia-editorial", themeId: "creme", dados: {}, criadoEm: "x", atualizadoEm: "x" },
    horarios: { faixas: [], utcOffsetMinutes: -180, obtidoEm: "2026-09-01T00:00:00.000Z" },
    capturas: {
      estado: "pronto",
      execucaoId: "e1",
      pedidoEm: "2026-09-01T00:00:00.000Z",
      imagens: [{ ancora: "hero", tela: "celular", ordem: 1, url: "u", largura: 1, altura: 1 }],
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
    criadoEm: "x",
    atualizadoEm: "x",
    origem: "automacao",
    ...(aprovacao && { aprovacao }),
  };
}

const capturaGerando = (estado: "enfileirado" | "rodando"): Lead["capturas"] => ({
  estado,
  execucaoId: "e2",
  pedidoEm: "2026-09-20T06:00:00.000Z",
});

describe("classificarEstoque — um balde por lead", () => {
  it("lead que passa nos filtros estruturais é PRONTO", () => {
    expect(classificarEstoque(lead("a"), undefined, AGORA, SEM_CORTE)).toBe("pronto");
  });

  it("demo automática PENDENTE conta como aguardando aprovação (captura pronta ou não pedida)", () => {
    expect(classificarEstoque(lead("a", { demo: demoAuto("pendente") }), undefined, AGORA, SEM_CORTE)).toBe(
      "aguardandoAprovacao",
    );
    // aprovação ausente numa demo automática vale pendente
    expect(classificarEstoque(lead("b", { demo: demoAuto() }), undefined, AGORA, SEM_CORTE)).toBe(
      "aguardandoAprovacao",
    );
    expect(
      classificarEstoque(
        lead("c", { demo: demoAuto("pendente"), capturas: undefined }),
        undefined,
        AGORA,
        SEM_CORTE,
      ),
    ).toBe("aguardandoAprovacao");
  });

  it("captura enfileirada ou gerando conta como a caminho — manual ou automática, uma vez só", () => {
    expect(classificarEstoque(lead("a", { capturas: capturaGerando("enfileirado") }), undefined, AGORA, SEM_CORTE)).toBe(
      "capturaEmAndamento",
    );
    expect(
      classificarEstoque(
        lead("b", { demo: demoAuto("pendente"), capturas: capturaGerando("rodando") }),
        undefined,
        AGORA,
        SEM_CORTE,
      ),
    ).toBe("capturaEmAndamento");
  });

  it("automática APROVADA com captura pronta é pronta; REPROVADA não é estoque", () => {
    expect(classificarEstoque(lead("a", { demo: demoAuto("aprovada") }), undefined, AGORA, SEM_CORTE)).toBe("pronto");
    expect(classificarEstoque(lead("b", { demo: demoAuto("reprovada") }), undefined, AGORA, SEM_CORTE)).toBeUndefined();
  });

  it("fica FORA: sem demo, contactado, descartado, captura que falhou, lead de teste", () => {
    const fora = [
      lead("a", { demo: undefined, capturas: undefined }),
      lead("b", { status: "contactado" }),
      lead("c", { seloContato: { userId: "u", em: "2026-09-02T00:00:00.000Z" } }),
      lead("d", { descartado: true }),
      lead("e", { capturas: { estado: "falhou", execucaoId: "x", pedidoEm: "x", erro: "boom" } }),
      lead("f", { leadDeTeste: true }),
    ];
    for (const l of fora) expect(classificarEstoque(l, undefined, AGORA, SEM_CORTE)).toBeUndefined();
  });

  it("lead EM REVISÃO (claim silenciosa) não é pronto (o mesmo critério do pool)", () => {
    const emRevisao: FilaEnvioDoc = {
      leadId: "a",
      estado: "reservado",
      claimId: "c",
      reservadoEm: "2026-09-20T01:00:00.000Z",
      expiraEm: "2026-09-20T01:05:00.000Z",
      dispositivo: "android",
      tentativas: 0,
      ultimoErro: null,
      enviadoEm: null,
    };
    expect(classificarEstoque(lead("a"), emRevisao, AGORA, SEM_CORTE)).toBeUndefined();
  });
});

describe("calcularEstoque", () => {
  it("estoque = prontos + pendentes de aprovação + capturas em andamento", async () => {
    const db = new FakeFirestore();
    const semear = (l: Lead) => db.seed(`leads/${l.placeId}`, l as unknown as Record<string, unknown>);
    semear(lead("p1"));
    semear(lead("p2"));
    semear(lead("pend", { demo: demoAuto("pendente") }));
    semear(lead("cap1", { capturas: capturaGerando("enfileirado") }));
    semear(lead("cap2", { capturas: capturaGerando("rodando") }));
    semear(lead("fora", { demo: undefined, capturas: undefined }));
    semear(lead("teste", { leadDeTeste: true }));

    expect(await calcularEstoque(db, AGORA)).toEqual({
      prontos: 2,
      aguardandoAprovacao: 1,
      capturasEmAndamento: 2,
      total: 5,
    });
  });

  it("somarEstoque ignora os de fora", () => {
    expect(somarEstoque([undefined, "pronto", undefined])).toEqual({
      prontos: 1,
      aguardandoAprovacao: 0,
      capturasEmAndamento: 0,
      total: 1,
    });
  });
});
