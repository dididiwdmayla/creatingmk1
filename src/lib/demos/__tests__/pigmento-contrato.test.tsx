import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import type { Lead } from "@/lib/leads/types";
import { montarDemoDataAvulsa, patchIdentidadeAvulsa } from "../avulsas/identidade";
import { montarDemoData } from "../montar";
import { getSkin, getTheme } from "../registry";
import type { DemoData, PigmentoComposicao, PigmentoTokens } from "../types";
import { exemploDaSkin } from "../variantes";

import { PIGMENTO_COMPOSICAO_CSS, violacoesDeVariantes } from "@/components/demos/tatuagem2/composicao";
import { TATUAGEM2_VARIANTES } from "@/components/demos/tatuagem2/variantes";

import { PIGMENTO_PRESETS_ANTIGOS } from "./fixtures/pigmento-presets-antigos";

/**
 * Contrato da `tatuagem-pigmento-vivo` no HTML DO SERVIDOR, com JavaScript
 * desligado (docs/plano-tatuagem-pigmento-vivo.md §9, camada 2 e 3) —
 * complementa `pigmento-h1.test.tsx` (o `<h1>`) e `pigmento-canal-
 * identidade.test.tsx` (canal de agendamento e identidade vazia): aqui é
 * onde a drasticidade, a separação da irmã, o SSR sempre visível e o
 * teste de mutação vivem.
 */
const skin = getSkin("tatuagem-pigmento-vivo")!;
const Componente = await skin.componente();
const alvos = skin.variantes!.map((v) => v.id);
const lead = { nome: "Estúdio Contrato Real", placeId: "qa", status: "novo" } as Lead;

const documento = (id: string, data: DemoData) =>
  new JSDOM(
    renderToStaticMarkup(createElement(Componente, { data, theme: getTheme(skin, id) })),
  ).window.document;

const documentoVazio = (id: string) => {
  const data = montarDemoDataAvulsa(exemploDaSkin(skin, id), patchIdentidadeAvulsa({ nome: "Estúdio Sem Dado" }), skin.id);
  return new JSDOM(
    renderToStaticMarkup(createElement(Componente, { data, theme: getTheme(skin, id) })),
  ).window.document;
};

describe.each(alvos)("tatuagem-pigmento-vivo §9 camada 2 — contrato de seções e slots: %s", (id) => {
  it("emite os onze data-d-secao do contrato, sem duplicata", () => {
    const data = montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id);
    const doc = documento(id, data);
    const marcadores = [...doc.querySelectorAll("[data-d-secao]")].map((el) => el.getAttribute("data-d-secao"));
    expect(new Set(marcadores).size, "sem duplicata").toBe(marcadores.length);
    expect([...marcadores].sort()).toEqual(skin.secoes.map((s) => s.id).sort());
  });

  it("os oito slots de portfólio e o slot do nome renderizam (mesmo conjunto de data-demo-slot do contrato)", () => {
    const data = montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id);
    const doc = documento(id, data);
    const slots = new Set([...doc.querySelectorAll("[data-demo-slot]")].map((el) => el.getAttribute("data-demo-slot")));
    for (let i = 1; i <= 8; i++) {
      expect(slots.has(`imagens.portfolio-${i}`), `imagens.portfolio-${i}`).toBe(true);
    }
    expect(slots.has("nome")).toBe(true);
  });

  it("o wrapper .pv carrega os data-pv-* da composição declarada da variante", () => {
    const data = montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id);
    const doc = documento(id, data);
    const theme = getTheme(skin, id);
    const composicao = theme.pigmento!;
    const wrapper = doc.querySelector(".pv")!;
    expect(wrapper.getAttribute("data-pv-variante")).toBe(id);
    for (const knob of Object.keys(composicao) as (keyof PigmentoTokens)[]) {
      if (knob === "manchas") continue;
      expect(wrapper.getAttribute(`data-pv-${knob}`), knob).toBe(composicao[knob]);
    }
  });

  it("a <style> servida tem uma regra para cada valor de composição declarado (knob sem CSS reprova)", () => {
    const theme = getTheme(skin, id);
    const composicao = theme.pigmento!;
    for (const knob of Object.keys(composicao) as (keyof PigmentoTokens)[]) {
      if (knob === "manchas") continue;
      const valor = composicao[knob];
      expect(PIGMENTO_COMPOSICAO_CSS, `data-pv-${knob}="${valor}"`).toContain(`data-pv-${knob}="${valor}"`);
    }
  });
});

describe("tatuagem-pigmento-vivo §9 camada 2 — drasticidade como invariante", () => {
  const KNOBS_DE_SILHUETA = ["abertura", "portfolio", "investimento", "processo"] as const;
  const composicoes = alvos.map((id) => ({ id, composicao: getTheme(skin, id).pigmento! }));

  it.each(KNOBS_DE_SILHUETA)("os quatro valores de %s são distintos entre as variantes", (knob) => {
    const valores = composicoes.map((v) => v.composicao[knob]);
    expect(new Set(valores).size, valores.join(", ")).toBe(4);
  });

  it("ao menos quatro knobs de seção têm quatro valores distintos", () => {
    const todosOsKnobs = Object.keys(composicoes[0].composicao).filter((k) => k !== "manchas") as (keyof PigmentoComposicao)[];
    const comQuatroValores = todosOsKnobs.filter(
      (knob) => new Set(composicoes.map((v) => v.composicao[knob])).size === 4,
    );
    expect(comQuatroValores.length).toBeGreaterThanOrEqual(4);
  });
});

describe("tatuagem-pigmento-vivo §9 camada 2 — separação da irmã (tatuagem-editorial)", () => {
  // Valores literais de `TatuagemComposicao` (src/lib/demos/types.ts,
  // interface em torno da linha 410) — mapa de seção análoga do §4 do
  // plano. `estilos`, `faq` e `contato` não têm análogo na irmã.
  const VALORES_DA_IRMA: Partial<Record<keyof PigmentoComposicao, readonly string[]>> = {
    abertura: ["monolito", "cisao", "ficha", "cartaz"],
    portfolio: ["mosaico", "mural", "tira", "lista"],
    investimento: ["lista", "tabela", "cartoes", "prosa"],
    processo: ["linhas", "colunas", "escada", "numerado"],
    manifesto: ["alternado", "bloco", "marca", "sussurro"],
    artistas: ["retrato", "indice", "faixa", "dossie"],
    depoimentos: ["cartoes", "tira", "empilhado", "citacao"],
    agendar: ["centralizado", "colunas", "tarja", "cartaz"],
  };

  it.each(alvos)("%s: nenhum knob de PigmentoComposicao usa um valor de TatuagemComposicao na seção análoga", (id) => {
    const composicao = getTheme(skin, id).pigmento!;
    for (const [knob, valoresProibidos] of Object.entries(VALORES_DA_IRMA)) {
      const valor = composicao[knob as keyof PigmentoComposicao];
      expect(valoresProibidos, `${knob}=${valor}`).not.toContain(valor);
    }
  });
});

describe.each(alvos)("tatuagem-pigmento-vivo §9 camada 2 — SSR sempre visível: %s", (id) => {
  it("hero e wrappers de seção não saem com opacity:0 nem hidden inline (parallax decorativo em translateY não conta — não esconde conteúdo)", () => {
    const data = montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id);
    const doc = documento(id, data);
    for (const el of doc.querySelectorAll('[data-d-secao] , [data-d-secao] *')) {
      expect(el.hasAttribute("hidden"), el.outerHTML.slice(0, 80)).toBe(false);
      const estilo = el.getAttribute("style") ?? "";
      expect(estilo, el.outerHTML.slice(0, 80)).not.toMatch(/opacity:\s*0(?![.\d])/);
      expect(estilo, el.outerHTML.slice(0, 80)).not.toMatch(/display:\s*none/);
    }
  });

  it("o manifesto sai aceso: toda palavra nasce data-lit=true, nunca em --d-unlit", () => {
    const data = montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id);
    const doc = documento(id, data);
    const palavras = [...doc.querySelectorAll('[data-d-secao="manifesto"] [data-w]')];
    expect(palavras.length).toBeGreaterThan(0);
    for (const p of palavras) {
      expect(p.getAttribute("data-lit")).toBe("true");
      expect(p.getAttribute("style") ?? "").not.toMatch(/--d-unlit/);
    }
  });

  it("com intro:true, o overlay da splash não sai no HTML do servidor", () => {
    const data = montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id);
    const theme = { ...getTheme(skin, id), intro: true };
    const html = renderToStaticMarkup(createElement(Componente, { data, theme }));
    expect(html).not.toContain("z-[10000]");
  });

  it("o nome fantasma decorativo (se existir) é aria-hidden e nunca é <h1>", () => {
    const data = montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id);
    const doc = documento(id, data);
    const fantasma = doc.querySelector(".pv-hero-fantasma");
    if (fantasma) {
      expect(fantasma.tagName).not.toBe("H1");
      expect(fantasma.getAttribute("aria-hidden")).toBe("true");
      expect(fantasma.closest("h1")).toBeNull();
    }
  });
});

describe.each(alvos)("tatuagem-pigmento-vivo §9 camada 2 — lead vazio, sem literal de template: %s", (id) => {
  it("sem 'Rua das Aquarelas', sem 'desde 2018', sem 'fictício', sem #agendar circular, sem ★ fora de depoimentos", () => {
    const doc = documentoVazio(id);
    const html = doc.documentElement.innerHTML;
    expect(html).not.toContain("Rua das Aquarelas");
    expect(html).not.toContain("desde 2018");
    expect(html.toLowerCase()).not.toContain("fictício");

    const hrefsDoAgendar = [
      ...(doc.querySelector('[data-d-secao="agendar"]')?.querySelectorAll("a[href]") ?? []),
    ].map((a) => a.getAttribute("href"));
    expect(hrefsDoAgendar).not.toContain("#agendar");

    const estrelasForaDeDepoimentos = [...doc.querySelectorAll("body *")].filter(
      (el) => el.children.length === 0 && (el.textContent ?? "").includes("★") && !el.closest('[data-d-secao="depoimentos"]'),
    );
    expect(estrelasForaDeDepoimentos.map((el) => el.outerHTML)).toEqual([]);
  });
});

describe("tatuagem-pigmento-vivo §9 camada 3 — teste de mutação (violacoesDeVariantes)", () => {
  it("zero violações nas quatro variantes reais", () => {
    expect(violacoesDeVariantes(TATUAGEM2_VARIANTES)).toEqual([]);
  });

  it("mutação 1 — boreal regride ao preset de ANTES desta migração (sem `theme.pigmento`): reprova, nomeando boreal", () => {
    const mutadas = TATUAGEM2_VARIANTES.map((v) =>
      v.id === "boreal" ? { ...v, theme: PIGMENTO_PRESETS_ANTIGOS.boreal } : v,
    );
    const violacoes = violacoesDeVariantes(mutadas);
    expect(violacoes.length).toBeGreaterThan(0);
    expect(violacoes.some((msg) => msg.includes('"boreal"'))).toBe(true);
  });

  it('mutação 2 — controle: boreal com a composição da aquarela e paleta própria ("preset de cor" puro): também reprova', () => {
    const aquarela = TATUAGEM2_VARIANTES.find((v) => v.id === "aquarela")!;
    const boreal = TATUAGEM2_VARIANTES.find((v) => v.id === "boreal")!;
    const mutadas = TATUAGEM2_VARIANTES.map((v) =>
      v.id === "boreal"
        ? {
            ...v,
            theme: {
              ...boreal.theme,
              pigmento: { ...aquarela.theme.pigmento!, manchas: boreal.theme.pigmento!.manchas },
            },
          }
        : v,
    );
    const violacoes = violacoesDeVariantes(mutadas);
    expect(violacoes.length).toBeGreaterThan(0);
    expect(violacoes.some((msg) => msg.includes('"boreal"'))).toBe(true);
  });
});
