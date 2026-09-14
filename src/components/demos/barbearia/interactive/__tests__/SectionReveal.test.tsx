import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SectionReveal } from "../SectionReveal";

describe("SectionReveal: melhoria progressiva", () => {
  it.each(["padrao", "fade", "esquerda", "direita"] as const)("%s não esconde o conteúdo no servidor", (tipo) => {
    const html = renderToStaticMarkup(<SectionReveal animacao="marcante" tipo={tipo}><p>Conteúdo extenso</p></SectionReveal>);
    expect(html).toBe("<div><p>Conteúdo extenso</p></div>");
  });
});
