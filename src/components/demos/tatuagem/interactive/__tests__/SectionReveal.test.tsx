import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Bug real verificado em navegador (Playwright, viewport mobile 390×812):
 * a seção Portfólio nunca aparecia com uma lista de itens realista (20+),
 * mesmo depois de rolar a página inteira. Causa: o wrapper de entrada
 * envolvia a SEÇÃO INTEIRA com `viewport.amount: 0.2` — exige 20% da área
 * TOTAL do elemento na viewport para revelar. Portfólio é uma lista de
 * tamanho livre (até 30 itens — ver validate.ts) que no masonry de 1
 * coluna do celular fica muito mais alta que a viewport; passado ~5x a
 * altura da viewport, 20% da área nunca cabe numa tela cheia, e a seção
 * (com as imagens dentro) fica presa em opacity:0 pra sempre. Com 8 itens
 * (exemplo do template) o bug fica bem na borda e passa despercebido — só
 * aparece com um portfólio maior, típico de um lead real.
 *
 * `amount: "some"` (qualquer interseção) corrige: não escala com a altura
 * do elemento, então nunca fica inatingível.
 */
interface ViewportCapturado {
  once?: boolean;
  amount?: unknown;
}

let capturedViewport: ViewportCapturado | undefined;

vi.mock("motion/react", () => ({
  useReducedMotion: () => false,
  motion: {
    div: ({
      children,
      viewport,
    }: {
      children?: ReactNode;
      viewport?: ViewportCapturado;
      initial?: unknown;
      whileInView?: unknown;
      transition?: unknown;
    }) => {
      capturedViewport = viewport;
      return <div>{children}</div>;
    },
  },
}));

describe("SectionReveal (tatuagem) — reveal por scroll não trava em seções altas", () => {
  it("usa amount 'some' (não uma fração fixa) no viewport de whileInView", async () => {
    const { SectionReveal } = await import("../SectionReveal");

    renderToStaticMarkup(
      <SectionReveal animacao="marcante" tipo="padrao">
        <p>conteúdo</p>
      </SectionReveal>,
    );

    const viewport = capturedViewport;
    expect(viewport?.once).toBe(true);
    // Uma fração fixa (ex.: 0.2) exigiria 20% da área TOTAL da seção
    // visível de uma vez — inatingível para seções muito altas (portfólio
    // com lista longa). "some" dispara com qualquer interseção.
    expect(viewport?.amount).toBe("some");
  });
});
