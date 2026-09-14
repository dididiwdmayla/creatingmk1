import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { montarDemoData } from "../montar";
import { getTheme, SKINS } from "../registry";
import { aplicarTema } from "../tema";
import type { DemoData, SkinDefinition, SkinVariante } from "../types";
import { exemploDaSkin, getVariante, ordemSecoesDoArranjo, varianteEfetiva } from "../variantes";

/**
 * A TRAVA DO EIXO DE VARIANTE.
 *
 * Uma variante pode mover, redimensionar e retexturizar seção. NÃO pode
 * renomear, remover nem inventar seção, e não pode mudar o conjunto de
 * slots. Sem um teste, isso é convenção — e convenção não sobrevive à
 * sétima skin. Este arquivo é o que quebra quando alguém tenta.
 *
 * O item central (`data-d-secao`) roda contra o **HTML DO SERVIDOR, com
 * JavaScript desligado**: `renderToStaticMarkup` devolve a string de SSR e
 * nenhum efeito de cliente chega a executar. É deliberado — um marcador
 * carimbado no DOM depois da hidratação passaria num teste de navegador e
 * seria inútil para as duas coisas que consomem a âncora: a captura de
 * prospecção (que mede o HTML servido) e o SSR da rota pública.
 */

const COM_VARIANTES = SKINS.filter(
  (skin): skin is SkinDefinition & { variantes: readonly SkinVariante[] } =>
    (skin.variantes?.length ?? 0) > 0,
);

/**
 * Render de SSR de uma variante no ARRANJO NEUTRO — ordem default do
 * contrato, nada oculto. É a comparação certa: o arranjo é uma escolha da
 * variante (e do operador, por cima), enquanto o CONJUNTO de seções é o
 * contrato, e é isso que tem que bater entre as quatro. Comparar com o
 * arranjo aplicado só provaria que cada variante obedece a si mesma.
 */
function htmlNeutro(skin: SkinDefinition, variante: SkinVariante): string {
  const neutro: DemoData = { ...variante.exemplo, ordemSecoes: undefined,
    secoes: Object.fromEntries(
      Object.entries(variante.exemplo.secoes).map(([id, s]) => [id, { ...s, oculta: false }]),
    ) };
  const data = montarDemoData(neutro, undefined, undefined, skin.id);
  const theme = aplicarTema(getTheme(skin, variante.id), undefined, skin.heroEscalaLimites);
  // Fora o conteúdo de <style>: uma skin pode NOMEAR seções no CSS (a
  // lancheria-2 ordena e oculta por `[data-d-secao="…"]{order:N}`), e isso
  // não é marcação. Sem tirar, o teste contaria a regra como se fosse a
  // caixa — e foi exatamente o que ele pegou quando o CSS entrou.
  return renderToStaticMarkup(createElement(skin.componente, { data, theme })).replace(
    /<style\b[^>]*>[\s\S]*?<\/style>/g,
    "",
  );
}

const secoesNoHtml = (html: string): string[] =>
  [...html.matchAll(/data-d-secao="([^"]*)"/g)].map((m) => m[1]);

describe.each(COM_VARIANTES.map((s) => [s.id, s] as const))("variantes de %s", (_id, skin) => {
  const contrato = skin.secoes.map((s) => s.id);
  const naoFixas = new Set(skin.secoes.filter((s) => !s.fixa).map((s) => s.id));
  const variantes = skin.variantes;

  it("tem ao menos duas variantes, com ids únicos, e cada uma É o seu preset", () => {
    expect(variantes.length).toBeGreaterThanOrEqual(2);
    const ids = variantes.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    // A variante ocupa o lugar do preset: mesma lista, mesma ordem, e o id
    // da variante é o id do Theme (é o que LeadDemo.themeId persiste).
    expect(skin.themePresets).toEqual(variantes.map((v) => v.theme));
    expect(skin.themeDefault).toBe(variantes[0].theme);
    for (const v of variantes) {
      expect(v.theme.id, `variante "${v.id}": theme.id diferente do id`).toBe(v.id);
      expect(getTheme(skin, v.id)).toBe(v.theme);
      expect(getVariante(skin, v.id)).toBe(v);
      expect(varianteEfetiva(skin, v.id)).toBe(v);
    }
    // Id desconhecido cai na primeira, como getTheme — não derruba a rota.
    expect(varianteEfetiva(skin, "nao-existe")).toBe(variantes[0]);
    expect(exemploDaSkin(skin, "nao-existe")).toBe(variantes[0].exemplo);
  });

  it("há ao menos uma variante de fundo CLARO e uma de fundo ESCURO", () => {
    const fundos = variantes.map((v) => v.fundo);
    expect(fundos, `fundos: ${fundos.join(", ")}`).toContain("claro");
    expect(fundos, `fundos: ${fundos.join(", ")}`).toContain("escuro");
    // E o fundo declarado tem que bater com a paleta — senão a garantia é
    // só uma etiqueta. Luminância relativa do fundo, mesmo critério de tema.ts.
    for (const v of variantes) {
      const hex = v.theme.paleta.fundo.replace("#", "");
      const canal = (i: number) => parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255;
      const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      const luz = 0.2126 * lin(canal(0)) + 0.7152 * lin(canal(1)) + 0.0722 * lin(canal(2));
      expect(luz > 0.3 ? "claro" : "escuro", `variante "${v.id}" (fundo ${v.theme.paleta.fundo})`)
        .toBe(v.fundo);
    }
  });

  it.each(variantes.map((v) => [v.id, v] as const))(
    "arranjo de %s é uma PERMUTAÇÃO do contrato — não renomeia, não remove, não inventa",
    (id, v) => {
      expect([...v.arranjo.ordem].sort(), `arranjo de "${id}"`).toEqual([...contrato].sort());
      expect(v.arranjo.ordem.length, `arranjo de "${id}" tem id repetido`).toBe(
        new Set(v.arranjo.ordem).size,
      );
      // Ocultar seção fixa não existe (ver secaoVisivel em ./estrutura.ts):
      // uma variante que "escondesse" o hero estaria removendo seção.
      for (const oculta of v.arranjo.ocultas ?? []) {
        expect(naoFixas.has(oculta), `variante "${id}" oculta a seção fixa "${oculta}"`).toBe(true);
      }
      // O arranjo chegou ao exemplo na forma que o editor persiste.
      expect(v.exemplo.ordemSecoes).toEqual(ordemSecoesDoArranjo(skin.secoes, v.arranjo.ordem));
      for (const secaoId of contrato) {
        expect(v.exemplo.secoes[secaoId], `variante "${id}" sem a seção "${secaoId}"`).toBeDefined();
        expect(v.exemplo.secoes[secaoId].oculta ?? false).toBe(
          (v.arranjo.ocultas ?? []).includes(secaoId),
        );
      }
    },
  );

  it("as variantes compartilham o mesmo contrato de SLOTS", () => {
    const [primeira, ...resto] = variantes;
    const chaves = (d: DemoData) => Object.keys(d.secoes).sort();
    for (const v of resto) {
      expect(chaves(v.exemplo), `seções de "${v.id}" divergem de "${primeira.id}"`).toEqual(
        chaves(primeira.exemplo),
      );
      // Slots de imagem: mesmas chaves E mesmo default. O diff do editor
      // (montarPatch) compara cada slot contra o SVG do exemplo da skin —
      // se uma variante apontasse outro arquivo, trocar de variante
      // gravaria a imagem no patch como se fosse upload do operador.
      expect(v.exemplo.imagens, `imagens de "${v.id}" divergem de "${primeira.id}"`).toEqual(
        primeira.exemplo.imagens,
      );
    }
    // E o contrato declarado é o que o exemplo tem — nada a mais, nada a menos.
    expect(chaves(primeira.exemplo)).toEqual([...contrato].sort());
  });

  it("no HTML DO SERVIDOR (sem JavaScript), as variantes emitem os MESMOS data-d-secao", () => {
    const porVariante = variantes.map((v) => ({ id: v.id, secoes: secoesNoHtml(htmlNeutro(skin, v)) }));

    for (const { id, secoes } of porVariante) {
      // Sem duplicata: duas caixas com o mesmo nome tornam a âncora de
      // captura ambígua (ela enquadra a primeira e ninguém percebe).
      expect(new Set(secoes).size, `variante "${id}" repete um data-d-secao: ${secoes.join(", ")}`)
        .toBe(secoes.length);
      expect([...secoes].sort(), `variante "${id}" no HTML do servidor`).toEqual(
        [...contrato].sort(),
      );
    }

    // E entre si, na MESMA ordem: mesmo contrato, mesmo esqueleto.
    const [primeira, ...resto] = porVariante;
    for (const outra of resto) {
      expect(outra.secoes, `"${outra.id}" divergiu de "${primeira.id}"`).toEqual(primeira.secoes);
    }
  });

  /**
   * O nome das seções bater não basta. Uma variante pode esvaziar a
   * abertura por dentro — foi exatamente a divergência que a comparação das
   * quatro lancherias achou (`hero: 'nenhum'` não renderizava a faixa) — e
   * o conjunto de `data-d-secao` continuaria idêntico, porque o marcador
   * está no wrapper. Sem esta verificação a trava passaria por cima do
   * caso que ela existe para pegar.
   *
   * O critério é o título da página: um `<h1>`, um só, dentro da abertura.
   * Vale para qualquer skin — é o que a captura de identidade enquadra e o
   * que um documento sem h1 não tem.
   */
  it("cada variante renderiza UM <h1>, dentro da abertura", () => {
    for (const v of variantes) {
      const html = htmlNeutro(skin, v);
      const h1s = html.match(/<h1[\s>]/g) ?? [];
      expect(h1s.length, `variante "${v.id}" tem ${h1s.length} <h1>`).toBe(1);

      const abertura = html.indexOf('data-d-secao="hero"');
      const proxima = contrato
        .filter((id) => id !== "hero")
        .map((id) => html.indexOf(`data-d-secao="${id}"`))
        .filter((i) => i > abertura)
        .sort((a, b) => a - b)[0];
      expect(
        html.slice(abertura, proxima).includes("<h1"),
        `variante "${v.id}": o <h1> não está na abertura`,
      ).toBe(true);
    }
  });
});

describe("registro", () => {
  it("existe ao menos uma skin com variantes (senão a trava não prova nada)", () => {
    expect(COM_VARIANTES.map((s) => s.id)).toContain("lancheria-2");
  });

  it("skin SEM variantes segue resolvendo pelo demoDataExemplo de sempre", () => {
    const semVariantes = SKINS.find((s) => !s.variantes)!;
    expect(getVariante(semVariantes, "qualquer")).toBeUndefined();
    expect(varianteEfetiva(semVariantes, "qualquer")).toBeUndefined();
    expect(exemploDaSkin(semVariantes, "qualquer")).toBe(semVariantes.demoDataExemplo);
  });
});
