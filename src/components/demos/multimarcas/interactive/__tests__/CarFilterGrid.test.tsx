import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { MULTIMARCAS_EXEMPLO } from "../../exemplo";
import { CarFilterGrid, type ModoFiltro } from "../CarFilterGrid";

const doc = (modoFiltro: ModoFiltro, idioma = "pt-BR", moeda = "BRL") =>
  new JSDOM(
    renderToStaticMarkup(
      createElement(CarFilterGrid, {
        servicos: MULTIMARCAS_EXEMPLO.servicos,
        imagens: MULTIMARCAS_EXEMPLO.imagens,
        idioma,
        moeda,
        modoFiltro,
      }),
    ),
  ).window.document;

describe("CarFilterGrid — modos de filtro no HTML do servidor", () => {
  it("faixa: pílulas com as faixas do estoque e âncoras #faixa-N no topo", () => {
    const d = doc("faixa");
    const rotulos = [...d.querySelectorAll('[role="group"] button')].map((b) => b.textContent!.replace(/\s/g, " "));
    expect(rotulos).toEqual(["Todos", "Até R$ 60.000", "R$ 60.000 a R$ 80.000", "R$ 80.000 a R$ 100.000", "Acima de R$ 100.000"]);
    for (let i = 1; i <= 4; i++) expect(d.getElementById(`faixa-${i}`)).not.toBeNull();
  });

  it("faixa em outro locale: rótulo e separador do locale, sem 'R$' nem português", () => {
    const d = doc("faixa", "de-CH", "CHF");
    const texto = d.querySelector('[role="group"]')!.textContent!;
    expect(texto).not.toContain("R$");
    expect(texto).not.toContain("Até");
    expect(texto).toContain("CHF");
  });

  it("sem JavaScript o estoque aparece inteiro, em qualquer modo", () => {
    for (const modo of ["categoria", "faixa", "nenhum"] as const) {
      expect(doc(modo).querySelectorAll("[data-car]")).toHaveLength(MULTIMARCAS_EXEMPLO.servicos.length);
    }
  });

  it("nenhum: sem pílula de filtro; categoria: as categorias de sempre", () => {
    expect(doc("nenhum").querySelector('[role="group"]')).toBeNull();
    expect(doc("categoria").querySelector('[role="group"]')!.textContent).toContain("Picape");
  });
});
