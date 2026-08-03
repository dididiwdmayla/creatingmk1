// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BarraNavegador } from "../BarraNavegador";
import { medirSecoes } from "../medir";

/**
 * Contrato do componente e do adaptador de DOM, no DOM de verdade (jsdom).
 * A MATEMÁTICA está coberta em foco/fundo/srgb.test.ts; aqui o que se
 * prova é a fiação: que a cor sai da subárvore certa, que ela vai parar no
 * `content` da meta tag QUE JÁ EXISTE (nunca numa segunda) e que sair da
 * página devolve a cor do servidor.
 *
 * jsdom não faz layout — `getBoundingClientRect` devolve zeros —, então as
 * caixas são plantadas à mão. É o mesmo motivo pelo qual a prova de que
 * isto funciona numa página real mora no laço de captura
 * (`qa-visual.mjs --so=barra`), não aqui.
 */

const FUNDO = "#1a1411";
const ALT = "#f5f0e8";
const ALTURA = 700;

function caixa(el: HTMLElement, topo: number, base: number) {
  el.getBoundingClientRect = () =>
    ({ top: topo, bottom: base, left: 0, right: 1100, width: 1100, height: base - topo }) as DOMRect;
}

/** Duas seções empilhadas: a de cima sem fundo próprio, a de baixo em ALT. */
function montarPagina(topoDaSegunda: number) {
  document.head.innerHTML = `<meta name="theme-color" content="${FUNDO}">`;
  document.body.innerHTML = `
    <div data-d-secao="hero"><section></section></div>
    <div data-d-secao="equipe"><section style="background-color: ${ALT}"></section></div>
  `;
  const [um, dois] = [...document.querySelectorAll<HTMLElement>("[data-d-secao]")];
  caixa(um, topoDaSegunda - 5000, topoDaSegunda);
  caixa(um.firstElementChild as HTMLElement, topoDaSegunda - 5000, topoDaSegunda);
  caixa(dois, topoDaSegunda, topoDaSegunda + 5000);
  caixa(dois.firstElementChild as HTMLElement, topoDaSegunda, topoDaSegunda + 5000);
}

function meta(): HTMLMetaElement {
  return document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!;
}

beforeEach(() => {
  Object.defineProperty(window, "innerHeight", { value: ALTURA, configurable: true });
});

describe("medirSecoes", () => {
  it("acha a faixa no <section>, não no wrapper transparente", () => {
    montarPagina(0);
    const [hero, equipe] = medirSecoes();
    expect(hero.faixas).toEqual([]);
    expect(equipe.faixas).toEqual([
      { topoRel: 0, baseRel: 5000, cor: { r: 0xf5, g: 0xf0, b: 0xe8 } },
    ]);
  });
});

describe("BarraNavegador", () => {
  let container: HTMLElement;
  let root: Root | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });
  afterEach(() => {
    act(() => root?.unmount());
    root = undefined;
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  function montar() {
    act(() => {
      root = createRoot(container);
      root.render(<BarraNavegador corInicial={FUNDO} />);
    });
  }

  it("assume a cor da seção em foco e NÃO cria uma segunda meta tag", () => {
    montarPagina(-100); // a seção ALT dominando a tela
    montar();
    expect(meta().content.toLowerCase()).toBe(ALT);
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
  });

  it("com a fronteira no meio da tela, a cor está ENTRE as duas", () => {
    montarPagina(ALTURA / 2);
    montar();
    const cor = meta().content.toLowerCase();
    expect(cor).not.toBe(FUNDO);
    expect(cor).not.toBe(ALT);
  });

  it("devolve a cor do servidor ao desmontar", () => {
    montarPagina(-100);
    montar();
    expect(meta().content.toLowerCase()).toBe(ALT);
    act(() => root!.unmount());
    root = undefined;
    expect(meta().content).toBe(FUNDO);
  });

  it("sem meta tag na página, não faz nada (e não cria uma)", () => {
    // O caso de uma rota que não declare `themeColor`: o componente é
    // inerte em vez de inventar uma tag que o servidor não emitiu.
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    montar();
    expect(document.querySelector('meta[name="theme-color"]')).toBeNull();
  });

  it("não renderiza nada no DOM da página", () => {
    montarPagina(-100);
    montar();
    expect(container.innerHTML).toBe("");
  });
});
