import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { aplicarPatch, dadosDoLead, montarDemoData } from "../montar";
import { migrarPrecos } from "../precos";
import { getSkin } from "../registry";
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
    // self-heal: preco legado ("R$ 80") migra pra precoValor na leitura
    // (ver lib/demos/precos.ts) — mesmo padrão de outros defaults antigos.
    expect(out.servicos).toEqual(migrarPrecos(exemplo.servicos));
  });

  it("sem lead nem patch devolve o exemplo do template (com o preço migrado e imagensModo default)", () => {
    expect(montarDemoData(exemplo)).toEqual({
      ...exemplo,
      servicos: migrarPrecos(exemplo.servicos),
      imagensModo: "foto",
      // Sem skinId, mas o placeholder segue a convenção /demos/<pasta>/<slot>.svg
      // — o default "foto" ainda resolve pra foto/<slot>.webp na mesma pasta.
      imagens: { hero: "/demos/x/foto/hero.webp", equipe: "/demos/x/foto/equipe.webp" },
    });
  });

  describe("imagensModo: base de `imagens` sem upload do lead", () => {
    it('default "foto" resolve cada slot pra foto/<slot>.webp na mesma pasta do SVG', () => {
      const out = montarDemoData(exemplo);
      expect(out.imagensModo).toBe("foto");
      expect(out.imagens).toEqual({
        hero: "/demos/x/foto/hero.webp",
        equipe: "/demos/x/foto/equipe.webp",
      });
    });

    it('modo "grafico" salvo no patch mantém o SVG do exemplo', () => {
      const out = montarDemoData(exemplo, undefined, { imagensModo: "grafico" });
      expect(out.imagensModo).toBe("grafico");
      expect(out.imagens).toEqual(exemplo.imagens);
    });

    it("upload do lead (override em patch.imagens) vence em qualquer modo", () => {
      const foto = montarDemoData(exemplo, undefined, {
        imagensModo: "foto",
        imagens: { hero: "https://storage.example/demos/lead/hero-123.jpg" },
      });
      expect(foto.imagens.hero).toBe("https://storage.example/demos/lead/hero-123.jpg");
      // slot não tocado continua seguindo a base do modo.
      expect(foto.imagens.equipe).toBe("/demos/x/foto/equipe.webp");

      const grafico = montarDemoData(exemplo, undefined, {
        imagensModo: "grafico",
        imagens: { hero: "https://storage.example/demos/lead/hero-123.jpg" },
      });
      expect(grafico.imagens.hero).toBe("https://storage.example/demos/lead/hero-123.jpg");
      expect(grafico.imagens.equipe).toBe("/demos/x/equipe.svg");
    });
  });

  describe("varredura de demos salvas: defaults históricos de identidade ignorados na leitura", () => {
    it('demo salva com o antigo "BARBEARIA & SUL" no hero cai pro nome real do lead, não pro texto congelado', () => {
      const skin = getSkin("barbearia2-sul")!;
      const lead = makeLead({ nome: "Barbearia do Zé", endereco: undefined });
      const patchSalvo = {
        // Persistido por uma demo salva ANTES de secoes.hero.titulo virar
        // "ausente fica ausente" — valor idêntico ao antigo exemplo.ts.
        secoes: { hero: { titulo: "BARBEARIA\n& SUL" } },
        cidade: "Sua Cidade — UF",
        instagram: "@suabarbearia",
      };

      const data = montarDemoData(skin.demoDataExemplo, lead, patchSalvo, skin.id);

      // O título antigo não sobrevive: cai pro nome REAL do lead (quebrado
      // em título), nunca fica preso no texto de exemplo congelado.
      expect(data.secoes.hero?.titulo).toBe("Barbearia do Zé");
      expect(data.secoes.hero?.titulo).not.toBe("BARBEARIA\n& SUL");
      // cidade/instagram: o lead não tem nenhum dos dois — ausente fica
      // ausente, não volta ao default antigo persistido.
      expect(data.cidade).toBeUndefined();
      expect(data.instagram).toBeUndefined();
    });

    it("edição real do usuário (diferente do default histórico) continua valendo", () => {
      const skin = getSkin("barbearia2-sul")!;
      const lead = makeLead();
      const patchSalvo = {
        secoes: { hero: { titulo: "NOVA\nIDENTIDADE" } },
        cidade: "Curitiba — PR",
      };

      const data = montarDemoData(skin.demoDataExemplo, lead, patchSalvo, skin.id);

      expect(data.secoes.hero?.titulo).toBe("NOVA\nIDENTIDADE");
      expect(data.cidade).toBe("Curitiba — PR");
    });

    it("sem skinId (fixture avulsa, sem skin real) não filtra nada, mesmo com valor igual a um default histórico de outra skin", () => {
      const lead = makeLead();
      const data = montarDemoData(exemplo, lead, { cidade: "Sua Cidade — UF" });
      expect(data.cidade).toBe("Sua Cidade — UF");
    });
  });
});
