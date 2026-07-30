import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ManifestoReveal } from "../ManifestoReveal";

/**
 * Fiel ao material bruto: o manifesto quebra em UMA `<span data-mw>` por
 * palavra (o scroll depois acende cada uma via opacity, ver a própria
 * implementação) — cada palavra nasce apagada (opacity 0.14) até o
 * `useEffect` (que não roda em SSR) calcular o progresso real do scroll.
 */
describe("ManifestoReveal (imobiliária) — uma span por palavra", () => {
  it("quebra o texto em spans data-mw, uma por palavra", () => {
    const html = renderToStaticMarkup(
      <ManifestoReveal texto="Uma casa é um lugar" slot="secoes.imoveis.texto" />,
    );
    const spans = html.match(/data-mw/g) ?? [];
    expect(spans.length).toBe(5);
  });

  it("carrega o slot do editor no parágrafo", () => {
    const html = renderToStaticMarkup(
      <ManifestoReveal texto="Uma casa" slot="secoes.imoveis.texto" />,
    );
    expect(html).toContain('data-demo-slot="secoes.imoveis.texto"');
  });
});
