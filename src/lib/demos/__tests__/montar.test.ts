import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { aplicarPatch, dadosDoLead, montarDemoData } from "../montar";
import type { DemoData } from "../types";

const exemplo: DemoData = {
  nome: "Barbearia Exemplo",
  slogan: "Ofício e navalha.",
  endereco: "Rua Modelo, 100 — Centro",
  telefone: "(44) 0000-0000",
  whatsapp: "+55 44 0000-0000",
  horarios: "Seg a sáb, 9h às 19h",
  servicos: [{ nome: "CORTE", preco: "R$ 80", descricao: "Tesoura e navalha." }],
  depoimentos: [{ autor: "Cliente", texto: "Excelente.", nota: 5 }],
  secoes: {
    hero: { titulo: "TÍTULO", texto: "Descrição.", cta: "AGENDAR" },
    filosofia: {
      rotulo: "FILOSOFIA",
      titulo: "TRÊS PILARES",
      itens: [{ titulo: "OFÍCIO", texto: "Artesãos." }],
    },
  },
  imagens: { hero: "/demos/x/hero.svg", equipe: "/demos/x/equipe.svg" },
};

function makeLead(extra: Partial<Lead> = {}): Lead {
  return {
    placeId: "abc",
    nome: "Barbearia do Zé",
    endereco: "Av. Brasil, 2785, Maringá, PR",
    status: "novo",
    telefone: "(44) 3222-1111",
    telefoneIntl: "+55 44 3222-1111",
    enriquecido: false,
    criadoEm: "2026-07-01T00:00:00.000Z",
    atualizadoEm: "2026-07-01T00:00:00.000Z",
    ...extra,
  };
}

describe("dadosDoLead", () => {
  it("extrai nome, endereço, telefones, cidade e o título hero já persistidos", () => {
    expect(dadosDoLead(makeLead())).toEqual({
      nome: "Barbearia do Zé",
      endereco: "Av. Brasil, 2785, Maringá, PR",
      telefone: "(44) 3222-1111",
      whatsapp: "+55 44 3222-1111",
      cidade: "Maringá",
      secoes: { hero: { titulo: "Barbearia do Zé" } },
    });
  });

  it("prefere o telefone do enriquecimento ao da busca qualificada", () => {
    const lead = makeLead({
      enriquecido: true,
      detalhes: {
        telefone: "(44) 9999-8888",
        telefoneIntl: "+55 44 9999-8888",
        enriquecidoEm: "2026-07-02T00:00:00.000Z",
      },
    });
    expect(dadosDoLead(lead)).toMatchObject({
      telefone: "(44) 9999-8888",
      whatsapp: "+55 44 9999-8888",
    });
  });

  it("prefere o site do enriquecimento ao siteUrl da busca qualificada, extraindo o instagram", () => {
    const lead = makeLead({
      siteUrl: "https://www.instagram.com/site-antigo",
      enriquecido: true,
      detalhes: {
        site: "https://www.instagram.com/barbearia.doze/",
        enriquecidoEm: "2026-07-02T00:00:00.000Z",
      },
    });
    expect(dadosDoLead(lead)).toMatchObject({ instagram: "barbearia.doze" });
  });

  it("resume os horários estruturados do lead (SKU detailsProHours)", () => {
    const lead = makeLead({
      horarios: {
        faixas: [
          { diaAbre: 1, horaAbre: 9, minAbre: 0, diaFecha: 1, horaFecha: 18, minFecha: 0 },
        ],
        utcOffsetMinutes: -180,
        obtidoEm: "2026-07-01T00:00:00.000Z",
      },
    });
    expect(dadosDoLead(lead)).toMatchObject({
      horarios: "SEG 9h-18h · TER-DOM fechado",
    });
  });

  it("quebra nomes longos em duas linhas no título hero", () => {
    const lead = makeLead({ nome: "Barbearia e Salão de Beleza Estilo Moderno" });
    expect(dadosDoLead(lead).secoes?.hero?.titulo).toBe(
      "Barbearia e Salão de\nBeleza Estilo Moderno",
    );
  });

  it("omite slots que o lead não tem (não apaga o default do template)", () => {
    const lead = makeLead({ endereco: undefined, telefone: undefined, telefoneIntl: undefined });
    expect(dadosDoLead(lead)).toEqual({
      nome: "Barbearia do Zé",
      secoes: { hero: { titulo: "Barbearia do Zé" } },
    });
  });
});

describe("aplicarPatch", () => {
  it("sem patch devolve a base intacta", () => {
    expect(aplicarPatch(exemplo, undefined)).toEqual(exemplo);
  });

  it("campos de topo sobrescrevem só o que foi definido", () => {
    const out = aplicarPatch(exemplo, { slogan: "Novo slogan." });
    expect(out.slogan).toBe("Novo slogan.");
    expect(out.nome).toBe("Barbearia Exemplo");
    expect(out.horarios).toBe(exemplo.horarios);
  });

  it("secoes mesclam por chave e por campo; itens substitui a lista inteira", () => {
    const out = aplicarPatch(exemplo, {
      secoes: {
        hero: { titulo: "OUTRO TÍTULO" },
        filosofia: { itens: [{ titulo: "TEMPO", texto: "Sob agendamento." }] },
      },
    });
    expect(out.secoes.hero).toEqual({
      titulo: "OUTRO TÍTULO",
      texto: "Descrição.",
      cta: "AGENDAR",
    });
    expect(out.secoes.filosofia.itens).toEqual([
      { titulo: "TEMPO", texto: "Sob agendamento." },
    ]);
    expect(out.secoes.filosofia.rotulo).toBe("FILOSOFIA");
  });

  it("imagens mesclam por slot", () => {
    const out = aplicarPatch(exemplo, { imagens: { hero: "/demos/x/outra.svg" } });
    expect(out.imagens).toEqual({
      hero: "/demos/x/outra.svg",
      equipe: "/demos/x/equipe.svg",
    });
  });

  it("videos: ausente na base fica ausente; patch cria e mescla por slot", () => {
    expect(aplicarPatch(exemplo, undefined).videos).toBeUndefined();

    const criado = aplicarPatch(exemplo, {
      videos: { titulo: "https://storage.googleapis.com/b/demos/x/video-titulo-1.mp4" },
    });
    expect(criado.videos).toEqual({
      titulo: "https://storage.googleapis.com/b/demos/x/video-titulo-1.mp4",
    });

    const mesclado = aplicarPatch(criado, {
      videos: { rodape: "https://storage.googleapis.com/b/demos/x/video-rodape-1.mp4" },
    });
    expect(mesclado.videos).toEqual({
      titulo: "https://storage.googleapis.com/b/demos/x/video-titulo-1.mp4",
      rodape: "https://storage.googleapis.com/b/demos/x/video-rodape-1.mp4",
    });
  });

  it("servicos e depoimentos substituem a lista inteira quando presentes", () => {
    const out = aplicarPatch(exemplo, {
      servicos: [{ nome: "BARBA", preco: "R$ 60" }],
    });
    expect(out.servicos).toEqual([{ nome: "BARBA", preco: "R$ 60" }]);
    expect(out.depoimentos).toEqual(exemplo.depoimentos);
  });
});

describe("montarDemoData", () => {
  it("camadas: exemplo ← dados do lead ← edições da ficha", () => {
    const out = montarDemoData(exemplo, makeLead(), {
      nome: "Zé Barbeiro Premium",
      horarios: "Ter a sáb, 10h às 20h",
    });
    // edição da ficha vence o nome real do lead
    expect(out.nome).toBe("Zé Barbeiro Premium");
    // dado do lead vence o exemplo
    expect(out.endereco).toBe("Av. Brasil, 2785, Maringá, PR");
    // edição vence o exemplo
    expect(out.horarios).toBe("Ter a sáb, 10h às 20h");
    // exemplo permanece onde ninguém mexeu
    expect(out.slogan).toBe("Ofício e navalha.");
    expect(out.servicos).toEqual(exemplo.servicos);
  });

  it("sem lead nem patch devolve o exemplo do template", () => {
    expect(montarDemoData(exemplo)).toEqual(exemplo);
  });
});
