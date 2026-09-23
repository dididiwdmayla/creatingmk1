import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { montarDemoData } from "../montar";
import { getSkin, getTheme } from "../registry";
import type { DemoData } from "../types";
import { exemploDaSkin } from "../variantes";

/**
 * Contrato da `multimarcas-vortice` no HTML DO SERVIDOR, com JavaScript
 * desligado — irmã de `lancheria-contrato.test.tsx`. `renderToStaticMarkup`
 * + JSDOM sem executar script: o preloader, as revelações e a contagem de
 * preço nascem na hidratação, e nada disso pode esconder o documento
 * servido (docs/plano-multimarcas.md §1, "O `<h1>` existe, e tem três
 * defeitos", defeito 3; item 7 do §9).
 *
 * A etapa 4 (item 24) completa este arquivo com a prova do §6.1 e o §7.
 */
const skin = getSkin("multimarcas-vortice")!;
const lead = { nome: "Garagem Contrato Real", placeId: "qa", status: "novo" } as Lead;
const alvos = skin.variantes!.map((v) => v.id);

const documento = (id: string, data: DemoData, idioma?: string) =>
  new JSDOM(
    renderToStaticMarkup(
      createElement(skin.componente, { data, theme: getTheme(skin, id), idioma }),
    ),
  ).window.document;

describe.each(alvos)("multimarcas SSR sem JavaScript: %s", (id) => {
  const base = montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id);

  it("o preloader não sai no HTML do servidor, mesmo com a intro ligada", () => {
    const theme = { ...getTheme(skin, id), intro: true };
    const html = renderToStaticMarkup(createElement(skin.componente, { data: base, theme }));
    // O preloader é o único `fixed inset-0` de fundo opaco da skin.
    expect(html).not.toMatch(/class="[^"]*fixed inset-0 z-\[9990\]/);
    expect(html).not.toContain("GIRI");
  });

  it("nada no documento servido nasce transparente ou deslocado para fora da caixa", () => {
    const html = renderToStaticMarkup(
      createElement(skin.componente, { data: base, theme: { ...getTheme(skin, id), intro: true } }),
    );
    // Só o `style` INLINE conta: os `@keyframes` da folha (o anel do
    // WhatsApp esmaece até 0) não escondem nada no documento servido.
    const inline = [...html.matchAll(/ style="([^"]*)"/g)].map((m) => m[1]);
    expect(inline.filter((s) => /opacity:\s*0(?![.\d])/.test(s))).toEqual([]);
    expect(inline.filter((s) => s.includes("translateY(115%)"))).toEqual([]);
  });

  it("o preço de cada carro sai já formatado, não o zero de partida do contador", () => {
    const doc = documento(id, base);
    const cards = [...doc.querySelectorAll("[data-car]")];
    expect(cards).toHaveLength(base.servicos.length);
    const textos = cards.map((c) => c.textContent ?? "");
    for (const [i, servico] of base.servicos.entries()) {
      const milhar = servico.precoValor!.toLocaleString("pt-BR");
      expect(textos[i], `${servico.nome} sem o preço ${milhar}`).toContain(milhar);
    }
  });
});
