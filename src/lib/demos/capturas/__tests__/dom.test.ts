// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { forcarRevelacaoDasSecoes, revelacaoPendente } from "../dom.mjs";

/**
 * A REGRESSÃO da revelação presa: uma captura de âncora do MEIO da página
 * não pode conter região vazia — nem dentro do recorte (pedaço apagado na
 * foto que vai pro lead) nem acima/abaixo dele (a página vizinha em branco,
 * que é o que a prévia de enquadramento de /interno/capturas e a moldura
 * mostram em volta da seção).
 *
 * O defeito nasceu de `prepararPagina` rolar sem `behavior: "instant"`:
 * `imobiliaria` e `multimarcas` declaram `html { scroll-behavior: smooth }`,
 * cada passo do laço reiniciava a animação do anterior, a varredura mal saía
 * do topo e tudo abaixo das primeiras telas ficava no estado inicial do
 * `whileInView` — medido nas duas skins, em `opacity: 0; translateY(56px)`.
 *
 * O que se cobra AQUI é o portão e a imposição do estado final, que é a
 * parte que roda no DOM e portanto dá pra montar em jsdom. A varredura em si
 * (scroll real, IntersectionObserver, animação) é verificada pelo laço de
 * captura, que é onde ela existe.
 */

/** `motion` pinta o estado inicial de `whileInView` INLINE — é assim. */
function presa(alvo: HTMLElement, { comTransform = true } = {}) {
  alvo.style.opacity = "0";
  if (comTransform) alvo.style.transform = "translateY(56px)";
}

function montarPagina() {
  document.body.innerHTML = `
    <div data-d-secao="hero"><div id="hero-a"><p>topo</p></div></div>
    <div data-d-secao="servicos"><div id="servicos-a"><p>meio</p></div></div>
    <div data-d-secao="depoimentos"><div id="dep-a"><p>fim</p></div></div>
    <div data-d-led-estilo="barra"><span id="led-bar"></span></div>
  `;
}

const porId = (id: string) => document.getElementById(id) as HTMLElement;

beforeEach(montarPagina);

describe("forcarRevelacaoDasSecoes", () => {
  it("devolve ao estado final tudo que ficou preso no inicial das seções", async () => {
    presa(porId("hero-a"));
    presa(porId("servicos-a"));
    presa(porId("dep-a"), { comTransform: false });

    const r = await forcarRevelacaoDasSecoes({}, window);

    expect(r.forcados).toBe(3);
    expect(r.restantes).toBe(0);
    for (const id of ["hero-a", "servicos-a", "dep-a"]) {
      expect(porId(id).style.opacity).toBe("");
      expect(porId(id).style.transform).toBe("");
    }
  });

  it("não mexe em opacidade de DESENHO — inline sem transform e longe do zero", async () => {
    // O degradê sobre o card de imóvel (`opacity: 0.9` no style) não é
    // revelação nenhuma: forçá-lo mudaria o visual da demo na foto.
    const decor = porId("servicos-a");
    decor.style.opacity = "0.9";

    const r = await forcarRevelacaoDasSecoes({}, window);

    expect(r.forcados).toBe(0);
    expect(decor.style.opacity).toBe("0.9");
  });

  it("não desmonta carrossel, parallax nem barra de progresso (transform SEM opacidade)", async () => {
    const trilho = porId("servicos-a");
    trilho.style.transform = "translateX(-680px)";
    const barra = porId("dep-a");
    barra.style.transform = "scaleX(0.4)";

    await forcarRevelacaoDasSecoes({}, window);

    expect(trilho.style.transform).toBe("translateX(-680px)");
    expect(barra.style.transform).toBe("scaleX(0.4)");
  });

  it("deixa a camada decorativa em paz — a opacidade do LED é escrita por design", async () => {
    const led = porId("led-bar");
    presa(led);

    const r = await forcarRevelacaoDasSecoes({}, window);

    expect(r.forcados).toBe(0);
    expect(led.style.opacity).toBe("0");
  });

  it("é idempotente: rodar de novo não acha mais nada pra forçar", async () => {
    presa(porId("servicos-a"));

    expect((await forcarRevelacaoDasSecoes({}, window)).forcados).toBe(1);
    expect((await forcarRevelacaoDasSecoes({}, window)).forcados).toBe(0);
  });
});

describe("revelacaoPendente — o portão do recorte", () => {
  it("uma âncora do meio não pode ter região vazia acima nem abaixo do recorte", async () => {
    presa(porId("hero-a")); // acima da âncora
    presa(porId("servicos-a")); // dentro dela
    presa(porId("dep-a")); // abaixo

    const antes = revelacaoPendente("servicos", window);
    expect(antes.total).toBe(3);
    expect(antes.exemplos.length).toBeGreaterThan(0);

    await forcarRevelacaoDasSecoes({}, window);

    const depois = revelacaoPendente("servicos", window);
    expect(depois).toMatchObject({ total: 0, acima: 0, dentro: 0, abaixo: 0 });
  });

  it("aponta ONDE está o buraco, não só quantos são", () => {
    // jsdom devolve caixa zerada para todo elemento, então a repartição por
    // posição não tem como ser medida aqui — o que se cobra é que cada
    // pendência entre numa das três contas e que a soma feche com o total.
    presa(porId("hero-a"));
    presa(porId("dep-a"));

    const r = revelacaoPendente("servicos", window);

    expect(r.acima + r.dentro + r.abaixo).toBe(r.total);
    expect(r.total).toBe(2);
  });

  it("seção inexistente ainda conta as pendências, em vez de devolver zero calado", () => {
    presa(porId("hero-a"));

    const r = revelacaoPendente("secao-que-nao-existe", window);

    expect(r.total).toBe(1);
  });
});
