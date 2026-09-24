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
// Carregado UMA VEZ (topo do módulo) — mesmo motivo de lancheria-contrato.
// test.tsx: o componente é sob demanda no registro (ver
// SkinDefinition.componente em ../types.ts), e este arquivo só testa a
// `barbearia-editorial`.
const Componente = await skin.componente();
const lead = { nome: "Barbearia Contrato Real", placeId: "qa", status: "novo" } as Lead;
const alvos = skin.variantes?.map(v => v.id) ?? skin.themePresets.map(t => t.id);
const normalizar = (s: string) => s.replace(/\s+/g, " ").trim();

describe.each(alvos)("barbearia SSR: %s", (id) => {
  const base = montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id);
  it("tem um único h1 com o nome inteiro dentro da âncora hero, sem executar JS", () => {
    const html = renderToStaticMarkup(createElement(Componente, { data: base, theme: getTheme(skin, id) }));
    const doc = new JSDOM(html).window.document;
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(normalizar(doc.querySelector('[data-d-secao="hero"] h1')!.textContent!)).toBe(lead.nome);
    const ids = [...doc.querySelectorAll('[data-d-secao]')].map(e => e.getAttribute('data-d-secao'));
    expect(ids.toSorted()).toEqual(skin.secoes.map(s => s.id).toSorted());
    expect(base.endereco).toBeUndefined();
    expect(doc.querySelector('[data-demo-slot="endereco"]')).toBeNull();
    expect(doc.body.textContent).not.toContain('Av. Principal');
    for (const campo of ['telefone', 'whatsapp', 'horarios', 'instagram', 'cidade']) {
      expect(doc.querySelector(`[data-demo-slot="${campo}"]`), campo).toBeNull();
    }
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
    const doc = new JSDOM(renderToStaticMarkup(createElement(Componente, { data: remontado, theme: getTheme(skin, id) }))).window.document;
    expect(doc.querySelector('[data-demo-slot="imagens.hero"]')!.getAttribute('alt')).toBe('Foto enviada');
    expect(doc.querySelector('[data-demo-slot="imagens.servicos"]')!.getAttribute('alt')).toBe('');
  });
});

it.each([false, true])("mesmo contrato de slots no HTML servido nas quatro variantes (identidade preenchida: %s)", (preenchida) => {
  const contratos = alvos.map(id => {
    const data = montarDemoData(exemploDaSkin(skin, id), lead, preenchida ? {
      endereco: 'Rua do Cliente, 42', cidade: 'Cidade do Cliente', telefone: '44999990000',
      whatsapp: '5544999990000', horarios: 'Seg–Sex: 9h–18h', instagram: '@cliente',
    } : undefined, skin.id);
    const doc = new JSDOM(renderToStaticMarkup(createElement(Componente, {
      data, theme: getTheme(skin, id),
    }))).window.document;
    // O multiconjunto captura também um slot duplicado/perdido em um arranjo.
    return [...doc.querySelectorAll('[data-demo-slot]')]
      .map(el => el.getAttribute('data-demo-slot')).sort();
  });
  for (const contrato of contratos) expect(contrato).toEqual(contratos[0]);
});

it("valida alts por slot declarado, incluindo vazio decorativo", () => {
  expect(validateLeadDemoInput({ skinId: skin.id, themeId: skin.themeDefault.id,
    dados: { imagensAlt: { hero: "", servicos: "Bancada" } } }).dados.imagensAlt).toEqual({ hero: "", servicos: "Bancada" });
  expect(() => validateLeadDemoInput({ skinId: skin.id, themeId: skin.themeDefault.id,
    dados: { imagensAlt: { desconhecido: "Foto" } } })).toThrow();
});

it("oliva resolve para vinho na leitura, montagem e escrita", async () => {
  const { getVariante } = await import('../variantes');
  expect(getTheme(skin, 'oliva')).toBe(getTheme(skin, 'vinho'));
  expect(getVariante(skin, 'oliva')?.id).toBe('vinho');
  expect(exemploDaSkin(skin, 'oliva')).toBe(exemploDaSkin(skin, 'vinho'));
  expect(validateLeadDemoInput({skinId:skin.id,themeId:'oliva',dados:{}}).themeId).toBe('vinho');
  expect(skin.themePresets.map(t=>t.id)).not.toContain('oliva');
  expect(getTheme(getSkin('petshop-focinho-feliz')!, 'oliva').id).not.toBe('vinho');
});

it("variantes preservam campos internos de conteúdo e alts, não só IDs de seção", () => {
  const shape = (d: typeof skin.demoDataExemplo) => Object.fromEntries(Object.entries(d.secoes).map(([id,s]) =>
    [id, Object.keys(s).filter(k=>!['oculta','alinhamento','animacao','animacaoEntrada'].includes(k)).sort()]));
  for(const v of skin.variantes ?? []) {
    expect(shape(v.exemplo)).toEqual(shape(skin.demoDataExemplo));
    expect(v.exemplo.imagensAlt).toEqual(skin.demoDataExemplo.imagensAlt);
    const base=montarDemoData(v.exemplo,lead,undefined,skin.id);
    const editado=montarDemoData(v.exemplo,lead,{ordemSecoes:['contato','servicos'],secoes:{ritual:{oculta:true}},imagens:{hero:'/foto-enviada.webp'}},skin.id);
    const doc=new JSDOM(renderToStaticMarkup(createElement(Componente,{data:editado,theme:v.theme}))).window.document;
    expect(doc.querySelector('[data-d-secao]')?.getAttribute('data-d-secao')).toBe('hero');
    expect(doc.querySelector('[data-d-secao="ritual"]')).toBeNull();
    expect(doc.querySelector('[data-demo-slot="imagens.hero"]')?.getAttribute('src')).toBe('/foto-enviada.webp');
    expect(montarPatch(base,base,skin).imagens).toBeUndefined();
    expect(montarPatch(base,base,skin).ordemSecoes).toBeUndefined();
  }
});
