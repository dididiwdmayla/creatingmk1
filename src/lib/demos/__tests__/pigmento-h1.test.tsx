import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { montarDemoData } from "../montar";
import { getSkin, getTheme } from "../registry";
import { exemploDaSkin } from "../variantes";

/**
 * Item "d" da sessão de fundação (docs/plano-tatuagem-pigmento-vivo.md
 * §7/§17 D3): o `<h1>` é SEMPRE `data.nome`; `secoes.hero.titulo`, quando
 * preenchido e diferente do nome, vira linha de apoio — nunca troca o
 * `<h1>`. Teste de regressão do defeito antigo (`s.hero?.titulo ?? data.nome`
 * com `SplashTitle` que devolve `null` para texto vazio: um título salvo
 * como string vazia apagava o `<h1>` INTEIRO, pior que as skins irmãs, onde
 * o `<h1>` só ficava vazio).
 *
 * Verificado no HTML DO SERVIDOR (`renderToStaticMarkup`, sem executar
 * script nenhum) — não no DOM do navegador, que já rodaria a hidratação e
 * esconderia o defeito.
 */
const skin = getSkin("tatuagem-pigmento-vivo")!;
const Componente = await skin.componente();
// Nome curto (≤ 20 caracteres — HERO_TITULO_LIMIAR de quebrarTitulo em
// montar.ts): fica numa linha só. O caso longo, quebrado em duas linhas,
// tem regressão própria abaixo para garantir o espaço no textContent.
const lead = { nome: "Estúdio Croma", placeId: "qa", status: "novo" } as Lead;
const alvos = skin.variantes!.map((v) => v.id);

const normalizar = (texto: string) => texto.replace(/\s+/g, " ").trim();

const documento = (id: string, titulo: string | undefined) => {
  const data = montarDemoData(
    exemploDaSkin(skin, id),
    lead,
    titulo === undefined ? undefined : { secoes: { hero: { titulo } } },
    skin.id,
  );
  return new JSDOM(
    renderToStaticMarkup(createElement(Componente, { data, theme: getTheme(skin, id) })),
  ).window.document;
};

describe.each(alvos)("tatuagem-pigmento-vivo §7 — o <h1> e o título já salvo: %s", (id) => {
  const hero = (doc: Document) => doc.querySelector('[data-d-secao="hero"]')!;

  it("nome presente → nunca <h1> vazio, com título salvo, sem título, ou com string vazia", () => {
    for (const titulo of [undefined, "Seu corpo, nossa arte", "", "   "]) {
      const doc = documento(id, titulo);
      const h1s = doc.querySelectorAll("h1");
      expect(h1s, `título=${JSON.stringify(titulo)}`).toHaveLength(1);
      expect(normalizar(h1s[0].textContent!), `título=${JSON.stringify(titulo)}`).toBe(lead.nome);
    }
  });

  it("título vazio (o defeito do ?? antigo) → <h1> continua com o nome, nunca desaparece", () => {
    const doc = documento(id, "");
    const h1 = hero(doc).querySelector("h1");
    expect(h1).not.toBeNull();
    expect(normalizar(h1!.textContent!)).toBe(lead.nome);
  });

  it("título salvo, diferente do nome, aparece como linha de apoio DEPOIS do <h1>, na mesma âncora", () => {
    const TITULO = "Seu corpo, nossa arte";
    const doc = documento(id, TITULO);
    const h1 = hero(doc).querySelector("h1")!;
    expect(h1.textContent).not.toContain(TITULO);
    const apoio = hero(doc).querySelector('[data-demo-slot="secoes.hero.titulo"]');
    expect(apoio).not.toBeNull();
    expect(normalizar(apoio!.textContent!)).toBe(TITULO);
    expect(h1.compareDocumentPosition(apoio!) & 4 /* FOLLOWING */).toBeTruthy();
    for (const el of [apoio!, ...apoio!.querySelectorAll("*")]) {
      expect(el.hasAttribute("hidden")).toBe(false);
      expect(el.getAttribute("aria-hidden")).not.toBe("true");
      const estilo = el.getAttribute("style") ?? "";
      expect(estilo).not.toMatch(/display:\s*none|opacity:\s*0(?![.\d])/);
    }
  });

  it("controle: título igual ao nome (sem caixa, sem espaços nas pontas) não desenha linha de apoio", () => {
    const doc = documento(id, `  ${lead.nome.toUpperCase()}  `);
    expect(doc.querySelector('[data-demo-slot="secoes.hero.titulo"]')).toBeNull();
  });

  it("o caso normal de lead (título = quebrarTitulo(nome), gravado por dadosDoLead) também não repete o nome", () => {
    const doc = documento(id, undefined);
    expect(doc.querySelector('[data-demo-slot="secoes.hero.titulo"]')).toBeNull();
  });
});

it("nome de duas palavras quebrado em duas linhas mantém o espaço no textContent do <h1>", () => {
  const nome = "Laboratório Ultravioleta";
  const leadLongo = { ...lead, nome } as Lead;

  for (const id of alvos) {
    const data = montarDemoData(exemploDaSkin(skin, id), leadLongo, undefined, skin.id);
    const doc = new JSDOM(
      renderToStaticMarkup(createElement(Componente, { data, theme: getTheme(skin, id) })),
    ).window.document;

    const h1 = doc.querySelector('[data-d-secao="hero"] h1');
    expect(h1, id).not.toBeNull();
    expect(h1!.querySelector("br"), id).toBeNull();
    expect(normalizar(h1!.textContent!), id).toBe(nome);
  }
});
