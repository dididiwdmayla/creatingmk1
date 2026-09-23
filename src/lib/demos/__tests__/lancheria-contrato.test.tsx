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
 * Contrato da `lancheria-chapa-burger` no HTML DO SERVIDOR, com JavaScript
 * desligado — irmã de `tatuagem-contrato.test.tsx`/`barbearia-contrato.
 * test.tsx`, pelo mesmo motivo: a trava genérica (`variantes.test.tsx`)
 * prova que as quatro variantes emitem as MESMAS seções, e isso não diz
 * nada sobre o que cada uma emite DENTRO delas. Aqui a régua é o que a
 * captura de prospecção enquadra e o que o editor precisa achar.
 *
 * `renderToStaticMarkup` + JSDOM sem executar script: a splash, a lente do
 * cardápio e o CategoryNav nascem na hidratação, e nada disso pode ser
 * pré-requisito para o nome do negócio estar no documento servido.
 */
const skin = getSkin("lancheria-chapa-burger")!;
const lead = { nome: "Lanchonete Contrato Real", placeId: "qa", status: "novo" } as Lead;
const alvos = skin.variantes!.map((v) => v.id);
const normalizar = (texto: string) => texto.replace(/\s+/g, " ").trim();

/** Os três flutuantes: únicos slots que ficam AUSENTES do DOM (não CSS-
 *  escondidos) quando a composição não os quer — ver `floatsVisiveis` em
 *  ../../components/demos/lancheria/composicao.ts. */
const FLUTUANTES = new Set(["flutuante-bacon", "flutuante-queijo", "flutuante-bebida"]);

const documento = (id: string, data: Parameters<typeof aplicarPatch>[0]) =>
  new JSDOM(
    renderToStaticMarkup(createElement(skin.componente, { data, theme: getTheme(skin, id) })),
  ).window.document;

describe.each(alvos)("lancheria SSR: %s", (id) => {
  const base = montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id);

  it("tem UM <h1>, com o nome inteiro, dentro da âncora hero", () => {
    const doc = documento(id, base);
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(normalizar(doc.querySelector('[data-d-secao="hero"] h1')!.textContent!)).toBe(
      lead.nome,
    );
  });

  it("emite as cinco seções do contrato, sem duplicata", () => {
    const doc = documento(id, base);
    const ids = [...doc.querySelectorAll("[data-d-secao]")].map((el) =>
      el.getAttribute("data-d-secao"),
    );
    expect(ids.toSorted()).toEqual(skin.secoes.map((s) => s.id).toSorted());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("marca em DOM todo slot de imagem — ausente só quando a composição não desenha (flutuantes)", () => {
    const doc = documento(id, base);
    const variante = skin.variantes!.find((v) => v.id === id)!;
    const ocultas = new Set(Object.keys(variante.imagensOcultas ?? {}));
    for (const slot of Object.keys(skin.demoDataExemplo.imagens)) {
      const presente = doc.querySelector(`[data-demo-slot="imagens.${slot}"]`) !== null;
      if (FLUTUANTES.has(slot) && ocultas.has(slot)) {
        // Flutuante que a composição não quer: o `<DecorativeFloat>` nem
        // monta (ver floatDe() em Skin.tsx) — ausente de propósito.
        expect(presente, `${slot} em ${id}: flutuante oculto não deveria estar no DOM`).toBe(
          false,
        );
      } else {
        // Todo o resto sempre tem marcador — inclusive `bebida-N` na
        // `sala`, que a composição esconde por CSS (caixa zero), não por
        // JSX: o marcador continua no documento servido (ver
        // scripts/qa-chapa.mjs, que mede a caixa no navegador).
        expect(presente, `${slot} em ${id}: slot ausente do documento servido`).toBe(true);
      }
    }
  });

  it("lead sem endereço não vaza o endereço de exemplo nem emite o slot", () => {
    const doc = documento(id, base);
    expect(base.endereco).toBeUndefined();
    expect(doc.querySelector('[data-demo-slot="endereco"]')).toBeNull();
    // A migração tirou o endereço fictício de LANCHERIA_EXEMPLO (item 18);
    // isto é o que prova que ele não voltou a vazar por outra porta.
    expect(doc.body.textContent).not.toContain("Av. Principal");
    for (const campo of ["telefone", "whatsapp", "horarios", "instagram", "cidade"]) {
      expect(doc.querySelector(`[data-demo-slot="${campo}"]`), campo).toBeNull();
    }
  });

  it("cor crua só aparece declarando token, nunca pintando direto", () => {
    // A régua não é "nenhum hex no HTML": a paleta do tema CHEGA como hex,
    // num bloco de custom properties no wrapper, e é assim que tem que
    // ser. O que não pode é cor crua no VALOR de uma propriedade CSS comum
    // (ou num atributo de pintura de SVG) — aí ela não veio do tema.
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
    const data = aplicarPatch(base, { imagensAlt: { hero: "Foto enviada", "prato-vazio": "" } });
    const patch = montarPatch(base, data, skin);
    expect(patch.imagensAlt).toEqual({ hero: "Foto enviada", "prato-vazio": "" });
    const remontado = montarDemoData(exemploDaSkin(skin, id), lead, patch, skin.id);
    expect(remontado.imagensAlt).toEqual(data.imagensAlt);
    const doc = documento(id, remontado);
    expect(doc.querySelector('[data-demo-slot="imagens.hero"]')!.getAttribute("alt")).toBe(
      "Foto enviada",
    );
    // String vazia é alt DECORATIVO, não alt faltando — tem que chegar ao DOM.
    expect(doc.querySelector('[data-demo-slot="imagens.prato-vazio"]')!.getAttribute("alt")).toBe(
      "",
    );
  });
});

/**
 * §7 do plano — "Identidade no topo sem bloco oco": a ficha do Balcão e o
 * bloco "onde estamos hoje" da Praça dependem de campos que zero linhas de
 * dado é o caso NORMAL (harness, avulsa, lead recém-criado). Com um lead
 * sem endereço e sem horários — o mesmo `lead` das quatro suítes acima,
 * que já não tem nenhum dos dois — nenhum container vazio pode sobrar.
 */
describe.each(["balcao", "praca"] as const)("§7 — identidade sem bloco oco: %s", (id) => {
  const data = montarDemoData(exemploDaSkin(skin, id), lead, undefined, skin.id);

  it("zero linhas de dado: nenhum cromo de cartão renderiza (.ch-ficha/.ch-dados ausentes)", () => {
    const doc = documento(id, data);
    expect(doc.querySelector(".ch-ficha")).toBeNull();
    expect(doc.querySelector(".ch-dados")).toBeNull();
  });

  it("mesmo sem dado nenhum, o <h1> e ao menos uma linha de texto não vazia sobrevivem", () => {
    const doc = documento(id, data);
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(normalizar(doc.querySelector('[data-d-secao="hero"] h1')!.textContent!)).toBe(
      lead.nome,
    );
    const texto = doc.querySelector('[data-demo-slot="secoes.hero.texto"]');
    expect(texto?.textContent?.trim()).toBeTruthy();
  });
});

it("praca: o título do bloco 'onde estamos hoje' renderiza SEMPRE, mesmo sem dado nenhum", () => {
  // Único dos dois em que a escada de dados mora na seção `contato`
  // (a ficha do balcao está no hero) — o título dela é slot de CONTEÚDO,
  // não cromo do cartão, e continua de pé quando o sub-bloco de linhas
  // desaparece (ver §7 do plano).
  const data = montarDemoData(exemploDaSkin(skin, "praca"), lead, undefined, skin.id);
  const doc = documento("praca", data);
  const titulo = doc.querySelector('[data-demo-slot="secoes.contato.titulo"]');
  expect(titulo?.textContent?.trim()).toBeTruthy();
});
