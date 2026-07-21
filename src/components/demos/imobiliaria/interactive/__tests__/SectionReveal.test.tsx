import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Mesmo bug corrigido nas demais skins (ver SectionReveal.test.tsx de
 * barbearia/tatuagem): `viewport.amount` fixo (ex.: 0.2) exige essa fração
 * da área TOTAL da seção visível de uma vez — inatingível quando a seção
 * (lista de tamanho livre, como imóveis/bairros) fica muito mais alta que
 * a viewport. "some" corrige.
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

describe("SectionReveal (imobiliaria) — reveal por scroll não trava em seções altas", () => {
  it("usa amount 'some' (não uma fração fixa) no viewport de whileInView", async () => {
    const { SectionReveal } = await import("../SectionReveal");

    renderToStaticMarkup(
      <SectionReveal animacao="marcante" tipo="padrao">
        <p>conteúdo</p>
      </SectionReveal>,
    );

    const viewport = capturedViewport;
    expect(viewport?.once).toBe(true);
    expect(viewport?.amount).toBe("some");
  });
});
