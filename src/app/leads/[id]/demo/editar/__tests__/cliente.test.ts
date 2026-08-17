import { describe, expect, it } from "vitest";

import { CAMPOS_IDENTIDADE_AVULSA } from "@/lib/demos/avulsas/identidade";
import { montarDemoData } from "@/lib/demos/montar";
import { montarPatch } from "@/lib/demos/patch";
import { getSkin } from "@/lib/demos/registry";
import type { Lead } from "@/lib/leads/types";

import { clienteDaDemo, type RegistroDemo } from "../cliente";

const skin = getSkin("barbearia-editorial")!;

const lead: Lead = {
  placeId: "place-1",
  nome: "Barbearia do Zé",
  endereco: "Av. Brasil, 2785, Maringá, PR",
  telefone: "(44) 3222-1111",
  status: "novo",
  enriquecido: false,
  criadoEm: "2026-07-01T00:00:00.000Z",
  atualizadoEm: "2026-07-01T00:00:00.000Z",
};

const registroLead = {
  id: lead.placeId,
  nome: lead.nome,
  idiomaPadrao: "pt-BR",
  moeda: "BRL",
  lead,
} as RegistroDemo;

const registroAvulsa: RegistroDemo = {
  id: "uuid-1",
  nome: "Barbearia Avulsa",
  idiomaPadrao: "pt-BR",
  moeda: "BRL",
};

/**
 * O adaptador é o ÚNICO lugar onde as duas famílias de demo divergem
 * dentro do editor. O que precisa estar certo aqui é o par
 * `base`/`montar`: se os dois não usarem a mesma montagem, o diff mínimo
 * grava patch pra dizer o que a base já diz — ou, pior, perde um campo
 * vazio e deixa o texto do template voltar no save seguinte.
 */
describe("clienteDaDemo('lead')", () => {
  const cliente = clienteDaDemo("lead");

  it("a base inclui a camada dadosDoLead", () => {
    const base = cliente.base(registroLead, skin);
    expect(base.nome).toBe("Barbearia do Zé");
    expect(base.telefone).toBe("(44) 3222-1111");
  });

  it("montar aplica o patch salvo por cima do lead", () => {
    const dados = cliente.montar(registroLead, skin, { slogan: "Editado." });
    expect(dados.slogan).toBe("Editado.");
    expect(dados.nome).toBe("Barbearia do Zé");
  });

  it("é a MESMA montagem da rota pública", () => {
    expect(cliente.montar(registroLead, skin, { slogan: "X" })).toEqual(
      montarDemoData(skin.demoDataExemplo, lead, { slogan: "X" }, skin.id),
    );
  });

  it("aponta para a ficha e para /demo/{id}", () => {
    expect(cliente.voltarPara("place-1")).toBe("/leads/place-1");
    expect(cliente.caminhoPublico("place-1")).toBe("/demo/place-1");
  });

  it("oferece sugestão de texto por IA", () => {
    expect(cliente.gerarSugestao).toBeDefined();
  });

  it("não oferece edição de país (ele vem do endereço do lead)", () => {
    expect(cliente.salvarPais).toBeUndefined();
  });
});

describe("clienteDaDemo('avulsa')", () => {
  const cliente = clienteDaDemo("avulsa");

  it("a base já vem com a identidade zerada", () => {
    const base = cliente.base(registroAvulsa, skin);
    for (const campo of CAMPOS_IDENTIDADE_AVULSA) {
      expect(base[campo], campo).toBe("");
    }
  });

  it("montar não deixa o endereço do template aparecer", () => {
    const dados = cliente.montar(registroAvulsa, skin, { nome: "Zé" });
    expect(dados.nome).toBe("Zé");
    expect(dados.endereco).toBe("");
  });

  it("base e montar concordam — salvar sem editar nada não gera patch de identidade", () => {
    const base = cliente.base(registroAvulsa, skin);
    const efetivo = cliente.montar(registroAvulsa, skin, { nome: "Zé", telefone: "(44) 1111" });

    const patch = montarPatch(base, efetivo, skin);
    expect(patch.telefone).toBe("(44) 1111");
    for (const campo of CAMPOS_IDENTIDADE_AVULSA) {
      if (campo === "telefone") continue;
      expect(patch[campo], campo).toBeUndefined();
    }
    // E o resultado relido continua sem o texto do template.
    expect(cliente.montar(registroAvulsa, skin, patch).endereco).toBe("");
  });

  it("nunca usa dado de lead, mesmo se um viesse junto no registro", () => {
    const comLead = { ...registroAvulsa, lead } as RegistroDemo;
    expect(cliente.montar(comLead, skin, {}).telefone).toBe("");
  });

  it("aponta para /demos e para /demo/avulsa/{id}", () => {
    expect(cliente.voltarPara("uuid-1")).toBe("/demos");
    expect(cliente.caminhoPublico("uuid-1")).toBe("/demo/avulsa/uuid-1");
  });

  it("NÃO oferece sugestão de texto por IA (sem lead não há contexto pro prompt)", () => {
    expect(cliente.gerarSugestao).toBeUndefined();
  });

  it("oferece tradução e edição de país", () => {
    expect(cliente.traduzir).toBeDefined();
    expect(cliente.salvarPais).toBeDefined();
  });
});
