import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { PIGMENTO_COMPOSICAO_CSS } from "@/components/demos/tatuagem2/composicao";
import { getSkin, getTheme } from "../registry";
import { exemploDaSkin } from "../variantes";

const skin = getSkin("tatuagem-pigmento-vivo")!;
const Componente = await skin.componente();
const variantes = skin.variantes!.map((variante) => variante.id);

describe.each(variantes)("Pigmento Vivo — essência em %s", (id) => {
  it("serve a tríade, o manifesto aceso e o ponto rastreador", () => {
    const doc = new JSDOM(
      renderToStaticMarkup(
        createElement(Componente, {
          data: exemploDaSkin(skin, id),
          theme: getTheme(skin, id),
        }),
      ),
    ).window.document;

    const wrapper = doc.querySelector(".pv") as HTMLElement;
    for (const token of ["--pv-mancha-1", "--pv-mancha-2", "--pv-mancha-3"]) {
      expect(wrapper.style.getPropertyValue(token), token).not.toBe("");
    }

    const palavras = [...doc.querySelectorAll(".pv-manifesto-texto [data-w]")];
    expect(palavras.length).toBeGreaterThan(5);
    expect(palavras.every((palavra) => palavra.getAttribute("data-lit") === "true")).toBe(true);
    expect(doc.querySelector(".pv-nav-ponto")).not.toBeNull();
    expect(doc.querySelector(".pv-rastreador")).not.toBeNull();
  });
});

it("declara as quatro respostas visuais do rastreador e do acendimento", () => {
  expect(PIGMENTO_COMPOSICAO_CSS).toContain("--pv-manifesto-escala");
  expect(PIGMENTO_COMPOSICAO_CSS).toContain('data-pv-manifesto="grifo"');
  expect(PIGMENTO_COMPOSICAO_CSS).toContain('data-pv-variante="meia-noite"');
  expect(PIGMENTO_COMPOSICAO_CSS).toContain('data-pv-manifesto="carta"');
  expect(PIGMENTO_COMPOSICAO_CSS).toContain("--d-pigment");
});
