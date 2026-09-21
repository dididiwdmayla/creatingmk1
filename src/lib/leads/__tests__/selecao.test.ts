import { describe, expect, it } from "vitest";

import { FakeFirestore } from "@/lib/testing/fake-firestore";

import { listarOpcoesDeLead, opcaoDoLead } from "../selecao";
import type { Lead } from "../types";

/**
 * A LINHA DO SELETOR DE LEAD — o que faz o operador reconhecer um lead sem
 * ver o id dele (ver `lib/leads/selecao.ts` e "Seletor de lead" no
 * ARCHITECTURE.md).
 */

const BASE = {
  status: "novo" as const,
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
  enriquecido: false,
};

function lead(extra: Partial<Lead> & { placeId: string; nome: string }): Lead {
  return { ...BASE, ...extra } as Lead;
}

describe("opcaoDoLead", () => {
  it("leva nome, nicho, cidade e se tem demo — e NADA do resto do doc", () => {
    const opcao = opcaoDoLead(
      lead({
        placeId: "ChIJa",
        nome: "Barbearia do Zé",
        endereco: "R. da Praia, 100 - Centro, Porto Alegre - RS, 90010-150, Brasil",
        busca: { nicho: "barbearia", regiao: "Porto Alegre RS", em: BASE.criadoEm },
        demo: { skinId: "barbearia-editorial", themeId: "norte", criadoEm: BASE.criadoEm },
        telefone: "(51) 99999-0000",
      } as Partial<Lead> & { placeId: string; nome: string }),
    );

    expect(opcao).toEqual({
      leadId: "ChIJa",
      nome: "Barbearia do Zé",
      nicho: "barbearia",
      cidade: "Porto Alegre - RS",
      temDemo: true,
    });
    // Enxuta de propósito: o doc de um lead carrega demo inteira, capturas
    // e detalhes do Places, e a tela só precisa escolher um nome.
    expect(Object.keys(opcao)).toHaveLength(5);
  });

  it("dois leads de MESMO NOME em cidades diferentes ficam distinguíveis", () => {
    const maringa = opcaoDoLead(
      lead({
        placeId: "ChIJa",
        nome: "Barbearia do Zé",
        endereco: "Av. Brasil, 1 - Centro, Maringá - PR, 87013-000, Brasil",
      }),
    );
    const portoAlegre = opcaoDoLead(
      lead({
        placeId: "ChIJb",
        nome: "Barbearia do Zé",
        endereco: "R. da Praia, 2 - Centro, Porto Alegre - RS, 90010-150, Brasil",
      }),
    );

    expect(maringa.nome).toBe(portoAlegre.nome);
    expect(maringa.cidade).not.toBe(portoAlegre.cidade);
  });

  it("sem endereço, a cidade cai na região da busca — nunca fica sem nada", () => {
    const opcao = opcaoDoLead(
      lead({
        placeId: "ChIJc",
        nome: "Pet Center",
        busca: { nicho: "petshop", regiao: "Curitiba PR", em: BASE.criadoEm },
      }),
    );

    expect(opcao.cidade).toBe("Curitiba PR");
    expect(opcao.temDemo).toBe(false);
  });

  it("sem endereço e sem busca, os campos ficam vazios (nunca undefined)", () => {
    const opcao = opcaoDoLead(lead({ placeId: "ChIJd", nome: "Sem nada" }));

    expect(opcao.nicho).toBe("");
    expect(opcao.cidade).toBe("");
  });
});

describe("listarOpcoesDeLead", () => {
  it("ordena por nome, como quem procura", async () => {
    const db = new FakeFirestore();
    db.seed("leads/c", { ...lead({ placeId: "c", nome: "Zoo Pet" }) });
    db.seed("leads/a", { ...lead({ placeId: "a", nome: "Ateliê" }) });
    db.seed("leads/b", { ...lead({ placeId: "b", nome: "moinhos barber" }) });

    const opcoes = await listarOpcoesDeLead(db);

    expect(opcoes.map((o) => o.nome)).toEqual(["Ateliê", "moinhos barber", "Zoo Pet"]);
  });

  /**
   * O lead fixo de teste fica fora porque `listLeads` o exclui na ORIGEM, e
   * afrouxar aquilo por causa deste seletor o vazaria para /leads, /demos,
   * /hoje, /mundo e para a penetração de site por nicho. Quem precisa
   * oferecê-lo passa como opção EXTRA na tela.
   */
  it("NÃO traz o lead fixo de teste", async () => {
    const db = new FakeFirestore();
    db.seed("leads/ChIJa", { ...lead({ placeId: "ChIJa", nome: "Ink House" }) });
    db.seed("leads/radar-lead-teste", {
      ...lead({ placeId: "radar-lead-teste", nome: "Barbearia Dom Aurélio" }),
      leadDeTeste: true,
    });

    const opcoes = await listarOpcoesDeLead(db);

    expect(opcoes.map((o) => o.leadId)).toEqual(["ChIJa"]);
  });
});
