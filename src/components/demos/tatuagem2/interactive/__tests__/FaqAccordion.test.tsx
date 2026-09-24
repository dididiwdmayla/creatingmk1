import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FaqAccordion } from "../FaqAccordion";

/**
 * `<details>/<summary>` nativo (item 4 da sessão de fundação de
 * docs/plano-tatuagem-pigmento-vivo.md): fiel ao material bruto
 * (`state = { open: 0 }`), o primeiro item nasce aberto (`open`) — e, ao
 * contrário da versão em `useState`, os OUTROS continuam alcançáveis sem
 * JavaScript (o navegador abre/fecha `<details>` sozinho).
 */
describe("FaqAccordion (tatuagem2) — primeiro item aberto por padrão, sem JavaScript", () => {
  const itens = [
    { titulo: "Dói?", texto: "Resposta um." },
    { titulo: "Quanto custa?", texto: "Resposta dois." },
    { titulo: "Como cicatriza?", texto: "Resposta três." },
  ];

  it("marca só o primeiro <details> como aberto", () => {
    const html = renderToStaticMarkup(
      <FaqAccordion itens={itens} slotBase="secoes.faq.itens" accentCycle={["#D6336C", "#2B4EFF", "#FF6B35"]} />,
    );
    const detalhes = [...html.matchAll(/<details([^>]*)>/g)];
    expect(detalhes).toHaveLength(3);
    expect(detalhes.map((m) => m[1].includes(" open"))).toEqual([true, false, false]);
  });

  it("a resposta de TODO item sai no HTML, mesmo fechada — <details> não precisa de JavaScript para abrir", () => {
    const html = renderToStaticMarkup(
      <FaqAccordion itens={itens} slotBase="secoes.faq.itens" accentCycle={["#D6336C", "#2B4EFF", "#FF6B35"]} />,
    );
    for (const item of itens) expect(html).toContain(item.texto);
  });

  it("sem itens não quebra", () => {
    const html = renderToStaticMarkup(
      <FaqAccordion itens={[]} slotBase="secoes.faq.itens" accentCycle={["#D6336C"]} />,
    );
    expect(html).not.toContain("<details");
  });
});
