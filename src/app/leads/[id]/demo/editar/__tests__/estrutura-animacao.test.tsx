import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { montarDemoData } from "@/lib/demos/montar";
import { DEFAULT_SKIN } from "@/lib/demos/registry";
import type { DemoData } from "@/lib/demos/types";

import { PainelEstrutura } from "../paineis";

/**
 * Aba Estrutura: o controle de ANIMAÇÃO por seção (`DemoSecao.animacao`)
 * aparece ao lado de ordenar/ocultar e vale também para as seções FIXAS
 * (que não reordenam nem ocultam, mas animam). O estado do botão é o que
 * importa aqui — o handler em si só grava `animacao: false | undefined`.
 */
function markup(dados: DemoData) {
  return renderToStaticMarkup(
    <PainelEstrutura dados={dados} skin={DEFAULT_SKIN} atualizar={() => {}} />,
  );
}

/** Trecho do HTML em volta do nome da seção, onde o botão dela mora. */
function pedaco(html: string, nomeSecao: string): string {
  const i = html.indexOf(nomeSecao);
  expect(i, `seção "${nomeSecao}" não apareceu no painel`).toBeGreaterThan(-1);
  return html.slice(Math.max(0, i - 400), i + 900);
}

const BASE = montarDemoData(DEFAULT_SKIN.demoDataExemplo);
const FIXA = DEFAULT_SKIN.secoes.find((s) => s.fixa)!;
const REORDENAVEL = DEFAULT_SKIN.secoes.find((s) => !s.fixa)!;

describe("PainelEstrutura — animação por seção", () => {
  it("nasce ligada em toda seção (nenhuma demo publicada muda de comportamento)", () => {
    const html = markup(BASE);
    for (const nome of [FIXA.nome, REORDENAVEL.nome]) {
      const trecho = pedaco(html, nome);
      expect(trecho).toContain("Animação ligada");
      expect(trecho).toContain('aria-pressed="true"');
    }
  });

  it("a seção com animacao=false mostra o botão desligado — e só ela", () => {
    const dados: DemoData = {
      ...BASE,
      secoes: {
        ...BASE.secoes,
        [REORDENAVEL.id]: { ...BASE.secoes[REORDENAVEL.id], animacao: false },
      },
    };
    const html = markup(dados);
    expect(pedaco(html, REORDENAVEL.nome)).toContain("Animação desligada");
    expect(pedaco(html, FIXA.nome)).toContain("Animação ligada");
  });

  it("seção FIXA também tem o controle (não reordena nem oculta, mas anima)", () => {
    const dados: DemoData = {
      ...BASE,
      secoes: { ...BASE.secoes, [FIXA.id]: { ...BASE.secoes[FIXA.id], animacao: false } },
    };
    const html = markup(dados);
    // A linha da seção fixa vai do nome dela até o início da lista
    // arrastável (<ul>), que é onde as não-fixas começam.
    const linha = html.slice(html.indexOf(FIXA.nome), html.indexOf("<ul"));
    expect(linha).toContain("Animação desligada");
    // Continua sem os controles que não fazem sentido numa seção fixa.
    expect(linha).not.toContain("Ocultar");
    expect(linha).not.toContain("⠿");
  });

  it("com a animação desligada, o seletor de Entrada some (não teria efeito)", () => {
    const comEntrada = DEFAULT_SKIN.secoes.find((s) => !s.fixa && s.entradaOptions)!;
    const ligada = pedaco(markup(BASE), comEntrada.nome);
    expect(ligada).toContain("Entrada");

    const dados: DemoData = {
      ...BASE,
      secoes: {
        ...BASE.secoes,
        [comEntrada.id]: { ...BASE.secoes[comEntrada.id], animacao: false },
      },
    };
    expect(pedaco(markup(dados), comEntrada.nome)).not.toContain("Entrada");
  });
});
