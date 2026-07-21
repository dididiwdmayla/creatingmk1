import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * `Reveal` é o wrapper por ELEMENTO (fiel ao `data-reveal`/`data-delay` do
 * material bruto — ver Reveal.tsx). Mesmo cuidado de viewport que
 * SectionReveal: "some" em vez de uma fração fixa, porque blocos como o
 * card de imóvel podem ser mais altos que a viewport. Também confere que
 * o delay em milissegundos (fiel ao original) chega em SEGUNDOS no
 * `transition` do motion, e que `animacao="nenhuma"` não monta wrapper
 * nenhum (sem custo, sem elemento extra no DOM).
 */
interface Capturado {
  viewport?: { once?: boolean; amount?: unknown };
  transition?: { delay?: number };
}

let captured: Capturado = {};

vi.mock("motion/react", () => ({
  useReducedMotion: () => false,
  motion: {
    div: ({
      children,
      viewport,
      transition,
    }: {
      children?: ReactNode;
      viewport?: Capturado["viewport"];
      transition?: Capturado["transition"];
      initial?: unknown;
      whileInView?: unknown;
    }) => {
      captured = { viewport, transition };
      return <div>{children}</div>;
    },
  },
}));

describe("Reveal (imobiliaria)", () => {
  it("usa amount 'some' no viewport de whileInView", async () => {
    const { Reveal } = await import("../Reveal");
    renderToStaticMarkup(
      <Reveal animacao="marcante">
        <p>conteúdo</p>
      </Reveal>,
    );
    expect(captured.viewport?.once).toBe(true);
    expect(captured.viewport?.amount).toBe("some");
  });

  it("converte o delay de milissegundos (fiel ao data-delay original) para segundos", async () => {
    const { Reveal } = await import("../Reveal");
    renderToStaticMarkup(
      <Reveal animacao="sutil" delay={240}>
        <p>conteúdo</p>
      </Reveal>,
    );
    expect(captured.transition?.delay).toBeCloseTo(0.24);
  });

  it("animacao 'nenhuma' não monta wrapper de motion nenhum", async () => {
    const { Reveal } = await import("../Reveal");
    const html = renderToStaticMarkup(
      <Reveal animacao="nenhuma" className="minha-classe">
        <p>conteúdo</p>
      </Reveal>,
    );
    expect(html).toBe('<div class="minha-classe"><p>conteúdo</p></div>');
  });
});
