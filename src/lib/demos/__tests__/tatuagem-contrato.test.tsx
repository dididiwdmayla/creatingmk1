import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { aplicarPatch, montarDemoData } from "../montar";
import { montarPatch } from "../patch";
import { getSkin, getTheme } from "../registry";
import { exemploDaSkin } from "../variantes";

/**
 * Contrato da `tatuagem-editorial` no HTML DO SERVIDOR, com JavaScript
 * desligado — irmã de `barbearia-contrato.test.tsx`, pelo mesmo motivo: a
 * trava genérica (`variantes.test.tsx`) prova que as variantes emitem as
 * MESMAS seções, e isso não diz nada sobre o que cada uma emite DENTRO
 * delas. Aqui a régua é o que a captura de prospecção enquadra e o que o
 * editor precisa achar.
 *
 * `renderToStaticMarkup` + JSDOM sem executar script: a intro, o typewriter
 * e a máscara do vídeo nascem na hidratação, e nada disso pode ser
 * pré-requisito para o nome do negócio estar no documento servido.
 */
const skin = getSkin("tatuagem-editorial")!;
const lead = { nome: "Estúdio Contrato Real", placeId: "qa", status: "novo" } as Lead;
const alvos = skin.variantes?.map((v) => v.id) ?? skin.themePresets.map((t) => t.id);
const normalizar = (texto: string) => texto.replace(/\s+/g, " ").trim();

const documento = (id: string, data: Parameters<typeof aplicarPatch>[0]) =>
  new JSDOM(
    renderToStaticMarkup(
      createElement(skin.componente, { data, theme: getTheme(skin, id) }),
    ),
  ).window.document;

describe.each(alvos)("tatuagem SSR: %s", (id) => {
  const base = montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id);

  it("tem UM <h1>, com o nome inteiro, dentro da âncora hero", () => {
    const doc = documento(id, base);
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    // O nome vem quebrado em duas linhas por `quebrarTitulo`; o que importa
    // é que o print de identidade saia com ele INTEIRO, não com o slogan.
    expect(normalizar(doc.querySelector('[data-d-secao="hero"] h1')!.textContent!)).toBe(
      lead.nome,
    );
  });

  it("emite as seções do contrato, sem duplicata", () => {
    const doc = documento(id, base);
    const ids = [...doc.querySelectorAll("[data-d-secao]")].map((el) =>
      el.getAttribute("data-d-secao"),
    );
    expect(ids.toSorted()).toEqual(skin.secoes.map((s) => s.id).toSorted());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marca todo slot de imagem e todo slot de alt declarado", () => {
    const doc = documento(id, base);
    for (const slot of Object.keys(skin.demoDataExemplo.imagens)) {
      expect(doc.querySelector(`[data-demo-slot="imagens.${slot}"]`), slot).not.toBeNull();
    }
  });

  it("lead sem endereço não vaza o endereço de exemplo nem emite o slot", () => {
    const doc = documento(id, base);
    expect(base.endereco).toBeUndefined();
    expect(doc.querySelector('[data-demo-slot="endereco"]')).toBeNull();
    expect(doc.body.textContent).not.toContain("Rua das Palmeiras");
    for (const campo of ["telefone", "whatsapp", "horarios", "instagram", "cidade"]) {
      expect(doc.querySelector(`[data-demo-slot="${campo}"]`), campo).toBeNull();
    }
  });

  it("cor crua só aparece declarando token, nunca pintando direto", () => {
    // A Regra 1 ("nenhuma cor hardcoded no componente") só vale se for
    // medida. O véu do hero, o filtro da foto e a sombra do título eram
    // três literais — e eram justamente os que quebravam a paleta clara.
    //
    // A régua não é "nenhum hex no HTML": a paleta do tema CHEGA como hex,
    // num bloco de custom properties no wrapper, e é assim que tem que ser.
    // O que não pode é cor crua no VALOR de uma propriedade CSS comum (ou
    // num atributo de pintura de SVG) — aí ela não veio do tema.
    const doc = documento(id, base);
    const COR = /rgba?\(|#[0-9a-fA-F]{3,8}\b|\bblack\b|\bwhite\b/;
    for (const el of doc.querySelectorAll("[style]")) {
      for (const decl of el.getAttribute("style")!.split(";")) {
        const [prop, ...resto] = decl.split(":");
        if (!prop.trim() || prop.trim().startsWith("--")) continue;
        expect(resto.join(":"), `${el.tagName} { ${decl} }`).not.toMatch(COR);
      }
    }
    for (const el of doc.querySelectorAll("[fill], [stroke], [color]")) {
      for (const attr of ["fill", "stroke", "color"]) {
        const valor = el.getAttribute(attr);
        if (valor) expect(valor, `<${el.tagName} ${attr}>`).not.toMatch(COR);
      }
    }
  });

  it("alt editado e alt vazio fazem round-trip sem apagar os demais slots", () => {
    const data = aplicarPatch(base, { imagensAlt: { hero: "Foto enviada", sobre: "" } });
    const patch = montarPatch(base, data, skin);
    expect(patch.imagensAlt).toEqual({ hero: "Foto enviada", sobre: "" });
    const remontado = montarDemoData(exemploDaSkin(skin, id), lead, patch, skin.id);
    expect(remontado.imagensAlt).toEqual(data.imagensAlt);
    const doc = documento(id, remontado);
    expect(doc.querySelector('[data-demo-slot="imagens.hero"]')!.getAttribute("alt")).toBe(
      "Foto enviada",
    );
    // String vazia é alt DECORATIVO, não alt faltando — tem que chegar ao DOM.
    expect(doc.querySelector('[data-demo-slot="imagens.sobre"]')!.getAttribute("alt")).toBe("");
  });

  it("a faixa rolante é clicável no editor: cada item tem seu slot, uma vez só", () => {
    const doc = documento(id, base);
    const itens = base.secoes.marquee?.itens ?? [];
    expect(itens.length).toBeGreaterThan(0);
    for (let i = 0; i < itens.length; i++) {
      expect(
        doc.querySelectorAll(`[data-demo-slot="secoes.marquee.itens.${i}.titulo"]`),
        `item ${i}`,
      ).toHaveLength(1);
    }
  });
});
