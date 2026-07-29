import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FaqAccordion } from "../FaqAccordion";

/**
 * Fiel ao material bruto (`state = { open: 0 }`): o primeiro item do FAQ
 * já nasce aberto — só ele expõe a resposta e `aria-expanded="true"` na
 * primeira renderização; os demais nascem fechados.
 */
describe("FaqAccordion (tatuagem2) — primeiro item aberto por padrão", () => {
  const itens = [
    { titulo: "Dói?", texto: "Resposta um." },
    { titulo: "Quanto custa?", texto: "Resposta dois." },
    { titulo: "Como cicatriza?", texto: "Resposta três." },
  ];

  it("marca só o primeiro item como aberto", () => {
    const html = renderToStaticMarkup(
      <FaqAccordion itens={itens} slotBase="secoes.faq.itens" accentCycle={["#D6336C", "#2B4EFF", "#FF6B35"]} />,
    );
    const abertos = html.match(/aria-expanded="true"/g) ?? [];
    expect(abertos.length).toBe(1);
    expect(html.indexOf('aria-expanded="true"')).toBeLessThan(html.indexOf("Quanto custa?"));
  });

  it("sem itens não quebra (aberto = -1)", () => {
    const html = renderToStaticMarkup(
      <FaqAccordion itens={[]} slotBase="secoes.faq.itens" accentCycle={["#D6336C"]} />,
    );
    expect(html).not.toContain("aria-expanded=\"true\"");
  });
});
