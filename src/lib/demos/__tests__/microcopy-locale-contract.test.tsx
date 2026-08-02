import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { microcopiaDemo, type DemoMicrocopia } from "../microcopy";
import { montarDemoData } from "../montar";
import { getTheme, SKINS } from "../registry";
import { aplicarTema } from "../tema";
import type { DemoData } from "../types";

/**
 * Contrato: nenhuma skin do registro pode ter microcópia de CHROME (a
 * mesma categoria varrida manualmente antes de converter — indicadores de
 * scroll, rodapé, "X de 5 estrelas", rótulos de contato/ação) cravada no
 * componente por fora de `microcopiaDemo` (`../microcopy.ts`). O teste NÃO
 * lista os literais na mão (isso re-implementaria a varredura manual e
 * ficaria desatualizado a cada chave nova do dicionário) — ele deriva, do
 * PRÓPRIO dicionário, toda chave cuja tradução pt→de-CH/fr-CH realmente
 * muda, e confirma que o valor em PT-BR nunca aparece no HTML de uma demo
 * renderizada nesses idiomas. Roda contra TODA skin do registro: uma skin
 * nova entra na cobertura sem precisar tocar neste arquivo.
 *
 * Uma palavra do dicionário (ex.: "Galeria") pode LEGITIMAMENTE coincidir
 * com CONTEÚDO de exemplo em pt-BR não relacionado (ex.: o título de uma
 * seção que o operador escreveu) — isso não é o bug que este teste caça
 * (conteúdo é traduzido pela IA, um sistema à parte). Por isso a
 * verificação ignora, POR SKIN, qualquer chave cujo literal pt-BR também
 * apareça em algum texto de `demoDataExemplo` — só sobra o que só pode ter
 * vindo do CÓDIGO da skin.
 */

const PT = microcopiaDemo("pt-BR");
const DE = microcopiaDemo("de-CH");
const FR = microcopiaDemo("fr-CH");

type ChaveTexto = keyof typeof PT;

/** Toda string (não vazia) em qualquer profundidade de um valor de DemoData. */
function todasAsStrings(valor: unknown, acc: string[] = []): string[] {
  if (typeof valor === "string") {
    if (valor.trim()) acc.push(valor);
  } else if (Array.isArray(valor)) {
    for (const item of valor) todasAsStrings(item, acc);
  } else if (valor && typeof valor === "object") {
    for (const v of Object.values(valor)) todasAsStrings(v, acc);
  }
  return acc;
}

/** Chaves de string cuja tradução pt→idioma realmente muda (comparar uma chave igual nos dois não prova nada). */
function chavesTraduzidasDiferente(alvo: DemoMicrocopia): ChaveTexto[] {
  return (Object.keys(PT) as ChaveTexto[]).filter((chave) => {
    const valorPt = PT[chave];
    const valorAlvo = alvo[chave];
    return typeof valorPt === "string" && typeof valorAlvo === "string" && valorPt !== valorAlvo;
  });
}

/** Remove `<style>…</style>` (CSS + comentários JSX compilados ali dentro) — nunca é texto visível ao usuário. */
function semBlocosDeEstilo(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
}

function escapeRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Ocorrência do literal como PALAVRA (fronteira `\b`) — evita falso
 * positivo de substring dentro de outra palavra sem relação nenhuma (ex.:
 * "ROLE" apareceria dentro de "CHEVROLET" numa checagem ingênua de
 * `includes`).
 */
function contemComoPalavra(html: string, literal: string): boolean {
  const escapado = escapeRegex(literal.trim());
  return new RegExp(`\\b${escapado}\\b`, "u").test(html);
}

function renderComIdioma(skin: (typeof SKINS)[number], idioma: string) {
  const data = montarDemoData(skin.demoDataExemplo);
  const theme = aplicarTema(getTheme(skin, undefined), undefined, skin.heroEscalaLimites);
  const Skin = skin.componente;
  const html = semBlocosDeEstilo(
    renderToStaticMarkup(<Skin data={data} theme={theme} idioma={idioma} />),
  );
  return { html, data };
}

function checarSemVazamento(
  skinId: string,
  html: string,
  data: DemoData,
  chaves: ChaveTexto[],
  destino: string,
) {
  const conteudoDaSkin = todasAsStrings(data);
  for (const chave of chaves) {
    const literalPt = PT[chave] as string;
    // Coincide com conteúdo real do exemplo (título/rótulo escrito pelo
    // operador em pt-BR) — não é o vazamento de chrome que este teste
    // caça, é conteúdo traduzível por outro sistema (a IA da Forja).
    if (conteudoDaSkin.some((texto) => texto.includes(literalPt))) continue;
    expect(
      contemComoPalavra(html, literalPt),
      `${skinId} (${destino}): chave "${chave}" — literal pt-BR "${literalPt}" vazou fora do sistema de locale`,
    ).toBe(false);
  }
}

describe("microcópia de chrome: nenhum literal pt-BR vaza fora do sistema de locale — TODA skin do registro", () => {
  const chavesDe = chavesTraduzidasDiferente(DE);
  const chavesFr = chavesTraduzidasDiferente(FR);

  // Sanity check do próprio teste: se isso disparar, o dicionário mudou de
  // forma que o teste parou de testar nada (ex.: todas as raízes voltaram
  // a ter o mesmo valor) — precisa de atenção manual, não é "passou".
  it("o dicionário tem pelo menos uma chave cuja tradução pt→de-CH e pt→fr-CH difere (senão os testes abaixo não provam nada)", () => {
    expect(chavesDe.length).toBeGreaterThan(0);
    expect(chavesFr.length).toBeGreaterThan(0);
  });

  for (const skin of SKINS) {
    it(`${skin.id}: HTML em de-CH não contém nenhum literal de chrome em pt-BR (fora de conteúdo legítimo)`, () => {
      const { html, data } = renderComIdioma(skin, "de-CH");
      checarSemVazamento(skin.id, html, data, chavesDe, "de-CH");
    });

    it(`${skin.id}: HTML em fr-CH não contém nenhum literal de chrome em pt-BR (fora de conteúdo legítimo)`, () => {
      const { html, data } = renderComIdioma(skin, "fr-CH");
      checarSemVazamento(skin.id, html, data, chavesFr, "fr-CH");
    });

    it(`${skin.id}: aria-label "X de 5 estrelas" nunca vaza em pt-BR no render de-CH/fr-CH`, () => {
      // avaliacaoEstrelas é função, não string — fora da varredura genérica
      // acima; testada à parte com uma nota fixa.
      const rotuloPt = PT.avaliacaoEstrelas(5);
      const { html: htmlDe } = renderComIdioma(skin, "de-CH");
      const { html: htmlFr } = renderComIdioma(skin, "fr-CH");
      expect(htmlDe).not.toContain(rotuloPt);
      expect(htmlFr).not.toContain(rotuloPt);
    });

    it(`${skin.id}: pt-BR (default) continua renderizando sem quebrar — comportamento inalterado`, () => {
      const { html } = renderComIdioma(skin, "pt-BR");
      expect(html).toBeTruthy();
    });
  }
});
