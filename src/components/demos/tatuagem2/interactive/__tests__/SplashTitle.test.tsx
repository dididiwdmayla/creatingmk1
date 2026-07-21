import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SplashTitle } from "../SplashTitle";

/**
 * A última palavra do título ganha itálico + cor de acento, mas a
 * pontuação final ("." "?") fica FORA do itálico — fiel ao material
 * bruto ("nossa <em>tela</em>."). Também cobre título em duas linhas
 * (hero, com \n literal) e o caso degenerado de uma única palavra.
 */
describe("SplashTitle (tatuagem2) — última palavra em itálico, pontuação fora", () => {
  it("separa a pontuação final da palavra destacada", () => {
    const html = renderToStaticMarkup(
      <SplashTitle texto="Pronto pra marcar história?" accentCycle={["#D6336C"]} />,
    );
    expect(html).toContain("<em");
    expect(html).toContain(">história</em>");
    // A "?" deve estar fora do <em>, não dentro.
    expect(html).not.toContain("história?</em>");
    expect(html).toMatch(/<\/em>\?/);
  });

  it("preserva quebra de linha literal e italiciza só a última linha", () => {
    const html = renderToStaticMarkup(
      <SplashTitle texto={"Sua história,\nnossa tinta."} as="h1" accentCycle={["#2B4EFF"]} />,
    );
    expect(html).toContain("Sua história,");
    expect(html).toContain("<br");
    expect(html).toContain(">tinta</em>");
    expect(html).not.toContain("<em>Sua");
  });

  it("não quebra com uma única palavra", () => {
    const html = renderToStaticMarkup(<SplashTitle texto="Croma." accentCycle={["#FF6B35"]} />);
    expect(html).toContain(">Croma</em>");
  });

  it("não renderiza nada sem texto", () => {
    const html = renderToStaticMarkup(<SplashTitle texto={undefined} accentCycle={["#000000"]} />);
    expect(html).toBe("");
  });
});
