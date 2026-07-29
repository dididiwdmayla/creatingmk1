import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CustomCursor } from "../CustomCursor";

/**
 * Fiel ao material bruto (`if (anim && pointer:fine) { ... }`): o cursor
 * customizado só existe quando o nível de animação do tema não é
 * "nenhuma" — mesmo `animacoes` que guardava o bloco no original. Aqui
 * testamos só a decisão de render (sem `window`, sem jsdom — o efeito que
 * liga o listener de mousemove não roda em renderToStaticMarkup).
 */
describe("CustomCursor (imobiliária) — gateado por Theme.animacao", () => {
  it("não renderiza nada quando animacao é 'nenhuma'", () => {
    const html = renderToStaticMarkup(<CustomCursor animacao="nenhuma" />);
    expect(html).toBe("");
  });

  it("renderiza o ponto do cursor quando animacao é 'sutil' ou 'marcante'", () => {
    expect(renderToStaticMarkup(<CustomCursor animacao="sutil" />)).toContain("aria-hidden");
    expect(renderToStaticMarkup(<CustomCursor animacao="marcante" />)).toContain("aria-hidden");
  });
});
