import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { montarDemoData, quebrarTitulo } from "@/lib/demos/montar";
import { SKINS } from "@/lib/demos/registry";
import type { Lead } from "@/lib/leads/types";

import { PainelConteudo } from "../paineis";

/**
 * Aba Conteúdo: o TÍTULO HERO tem de ter campo.
 *
 * Toda skin renderiza o título hero a partir de `secoes.hero.titulo`
 * (`s.hero?.titulo ?? data.nome`, marcado com
 * `data-demo-slot="secoes.hero.titulo"`) e `dadosDoLead` sempre o preenche
 * com o nome do lead quebrado em duas linhas. Nenhum `demoDataExemplo`
 * declara esse campo — de propósito, pra não congelar copy de exemplo no
 * lugar do nome real de um lead novo —, e o painel só monta campos de
 * seção presentes no exemplo. O resultado era um título que nenhum campo
 * do editor alcançava: a pessoa editava "Nome do negócio" e nada mudava,
 * porque `secoes.hero.titulo` vence o `??`.
 */
const LEAD = {
  id: "lead-1",
  nome: "Óssea Studio de Tatuagem",
  endereco: "Rua Exemplo, 100 — Porto Alegre",
} as unknown as Lead;

function markup(skinIndex: number) {
  const skin = SKINS[skinIndex];
  const dados = montarDemoData(skin.demoDataExemplo, LEAD, undefined, skin.id);
  return {
    skin,
    dados,
    html: renderToStaticMarkup(
      <PainelConteudo
        dados={dados}
        skin={skin}
        abertos={{ "secao-hero": true }}
        setAberto={() => {}}
        atualizar={() => {}}
      />,
    ),
  };
}

describe("PainelConteudo — campo do título hero", () => {
  it.each(SKINS.map((s, i) => [s.id, i] as const))(
    "%s monta o campo campo-secoes.hero.titulo (o slot que o preview foca)",
    (_id, i) => {
      const { html } = markup(i);
      expect(html).toContain('id="campo-secoes.hero.titulo"');
    },
  );

  it.each(SKINS.map((s, i) => [s.id, i] as const))(
    "%s mostra no campo o título efetivo do lead, não o nome cru",
    (_id, i) => {
      const { dados, html } = markup(i);
      // O que a skin renderiza é exatamente o que o campo edita.
      expect(dados.secoes.hero?.titulo).toBe(quebrarTitulo(LEAD.nome));
      const campo = html.slice(html.indexOf('id="campo-secoes.hero.titulo"'), -1);
      expect(campo.slice(0, 200)).toContain(quebrarTitulo(LEAD.nome));
    },
  );

  it("o campo é textarea: o título hero aceita quebra de linha manual", () => {
    const { html } = markup(0);
    const antes = html.slice(0, html.indexOf('id="campo-secoes.hero.titulo"'));
    expect(antes.slice(-40)).toContain("<textarea");
  });
});
