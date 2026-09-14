import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { validateLeadDemoInput } from "../validate";
import { getSkin, getTheme } from "../registry";
import { montarDemoData, aplicarPatch } from "../montar";
import { montarPatch } from "../patch";
import { exemploDaSkin } from "../variantes";
import type { Lead } from "@/lib/leads/types";

const skin = getSkin("barbearia-editorial")!;
const lead = { nome: "Barbearia Contrato Real", placeId: "qa", status: "novo" } as Lead;
const alvos = skin.variantes?.map(v => v.id) ?? skin.themePresets.map(t => t.id);
const normalizar = (s: string) => s.replace(/\s+/g, " ").trim();

describe.each(alvos)("barbearia SSR: %s", (id) => {
  const base = montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id);
  it("tem um único h1 com o nome inteiro dentro da âncora hero, sem executar JS", () => {
    const html = renderToStaticMarkup(createElement(skin.componente, { data: base, theme: getTheme(skin, id) }));
    const doc = new JSDOM(html).window.document;
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(normalizar(doc.querySelector('[data-d-secao="hero"] h1')!.textContent!)).toBe(lead.nome);
    const ids = [...doc.querySelectorAll('[data-d-secao]')].map(e => e.getAttribute('data-d-secao'));
    expect(ids.toSorted()).toEqual(skin.secoes.map(s => s.id).toSorted());
    expect(base.endereco).toBeUndefined();
    expect(doc.querySelector('[data-demo-slot="endereco"]')).toBeNull();
    expect(doc.body.textContent).not.toContain('Av. Principal');
    for (const slot of Object.keys(skin.demoDataExemplo.imagens)) {
      expect(doc.querySelector(`[data-demo-slot="imagens.${slot}"]`), slot).not.toBeNull();
    }
  });
  it("alt editado e alt vazio fazem round-trip sem apagar os demais slots", () => {
    const data = aplicarPatch(base, { imagensAlt: { hero: "Foto enviada", servicos: "" } });
    const patch = montarPatch(base, data, skin);
    expect(patch.imagensAlt).toEqual({ hero: "Foto enviada", servicos: "" });
    const remontado = montarDemoData(exemploDaSkin(skin, id), lead, patch, skin.id);
    expect(remontado.imagensAlt).toEqual(data.imagensAlt);
    const doc = new JSDOM(renderToStaticMarkup(createElement(skin.componente, { data: remontado, theme: getTheme(skin, id) }))).window.document;
    expect(doc.querySelector('[data-demo-slot="imagens.hero"]')!.getAttribute('alt')).toBe('Foto enviada');
    expect(doc.querySelector('[data-demo-slot="imagens.servicos"]')!.getAttribute('alt')).toBe('');
  });
});

it("valida alts por slot declarado, incluindo vazio decorativo", () => {
  expect(validateLeadDemoInput({ skinId: skin.id, themeId: skin.themeDefault.id,
    dados: { imagensAlt: { hero: "", servicos: "Bancada" } } }).dados.imagensAlt).toEqual({ hero: "", servicos: "Bancada" });
  expect(() => validateLeadDemoInput({ skinId: skin.id, themeId: skin.themeDefault.id,
    dados: { imagensAlt: { desconhecido: "Foto" } } })).toThrow();
});
