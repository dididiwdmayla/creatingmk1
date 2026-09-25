import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SectionReveal } from "../SectionReveal";

/**
 * Bug real verificado em navegador (Playwright, viewport mobile 390×812):
 * a seção Portfólio nunca aparecia com uma lista de itens realista (20+),
 * mesmo depois de rolar a página inteira. Causa: a versão `motion` do
 * wrapper de entrada envolvia a SEÇÃO INTEIRA com `viewport.amount: 0.2` —
 * exige 20% da área TOTAL do elemento na viewport para revelar. Portfólio é
 * uma lista de tamanho livre (até 30 itens — ver validate.ts) que no
 * masonry de 1 coluna do celular fica muito mais alta que a viewport;
 * passado ~5x a altura da viewport, 20% da área nunca cabe numa tela
 * cheia, e a seção (com as imagens dentro) ficava presa em opacity:0 pra
 * sempre.
 *
 * A reescrita do item 4 da sessão de fundação (docs/plano-tatuagem-
 * pigmento-vivo.md) troca `motion`/`whileInView` por um
 * `IntersectionObserver` imperativo com `threshold: 0` — dispara com
 * QUALQUER interseção, não escala com a altura do elemento, e nunca fica
 * inatingível. Mais importante para o documento SERVIDO: o `opacity: 0` só
 * é escrito num `useEffect` (cliente, depois da hidratação) — o SSR nunca
 * esconde o conteúdo, ao contrário da versão anterior (`motion.div` com
 * `initial={{opacity:0}}`, visível no próprio HTML do servidor).
 */
describe("SectionReveal (tatuagem2) — documento servido sempre visível", () => {
  it("o HTML do servidor não tem opacity:0 nem transform algum — a entrada só é armada no cliente", () => {
    const html = renderToStaticMarkup(
      <SectionReveal animacao="marcante" tipo="padrao">
        <p>conteúdo</p>
      </SectionReveal>,
    );
    expect(html).toContain("conteúdo");
    expect(html).not.toMatch(/style="[^"]*opacity/);
    expect(html).not.toMatch(/style="[^"]*transform/);
  });

  it("anima 'nenhuma' não monta wrapper nenhum (sem custo, sem elemento extra)", () => {
    const html = renderToStaticMarkup(
      <SectionReveal animacao="nenhuma" tipo="padrao">
        <p>conteúdo</p>
      </SectionReveal>,
    );
    expect(html).toBe("<p>conteúdo</p>");
  });

  it("sem filhos não renderiza nada", () => {
    const html = renderToStaticMarkup(
      <SectionReveal animacao="marcante" tipo="padrao">
        {null}
      </SectionReveal>,
    );
    expect(html).toBe("");
  });
});
