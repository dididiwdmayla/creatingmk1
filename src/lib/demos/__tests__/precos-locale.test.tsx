import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { formatarPrecoServico, simboloMoeda } from "../precos";
import { montarDemoData } from "../montar";
import { getTheme, SKINS } from "../registry";
import { aplicarTema } from "../tema";

/**
 * Preços das 8 skins, ponta a ponta, nos três locais pedidos: pt-BR (BRL),
 * de-CH e fr-CH (CHF — mesma moeda, dois idiomas oficiais da Suíça,
 * confirmando que a MOEDA vem do país e o FORMATO/separadores vêm do
 * idioma, nunca de um símbolo cravado no componente). Sem IA em nenhuma
 * parte: `Intl.NumberFormat` + o mapa determinístico país→moeda
 * (`@/lib/moeda`).
 *
 * Asserção POSITIVA (contém o preço formatado esperado), não negativa
 * ("não contém R$") — algumas skins (lancheria) têm outros preços fora do
 * contrato `DemoServico` (bebidas/acompanhamentos, texto livre em
 * `DemoItem.subtitulo`, fora do escopo desta separação), então varrer a
 * página inteira por "R$" daria falso positivo. O que importa é que CADA
 * `servico.precoValor` apareça formatado corretamente no HTML.
 */
const LOCALES = [
  { idioma: "pt-BR", moeda: "BRL" },
  { idioma: "de-CH", moeda: "CHF" },
  { idioma: "fr-CH", moeda: "CHF" },
] as const;

/**
 * `renderToStaticMarkup` escapa aspas simples em texto (ex.: "499'000" via
 * `Intl.NumberFormat("de-CH", …)`, que usa apóstrofo como separador de
 * milhar) como entidade `&#x27;` — decodificação mínima só pra comparar
 * com a string "crua" que `formatarPrecoServico` devolve; o navegador
 * decodifica a entidade normalmente, então não é um bug de verdade.
 */
function semEntidadesHtml(html: string): string {
  return html.replace(/&#x27;/g, "'").replace(/&#39;/g, "'");
}

function renderComLocale(skin: (typeof SKINS)[number], idioma: string, moeda: string) {
  const data = montarDemoData(skin.demoDataExemplo);
  const theme = aplicarTema(getTheme(skin, undefined), undefined, skin.heroEscalaLimites);
  const Skin = skin.componente;
  const html = semEntidadesHtml(
    renderToStaticMarkup(<Skin data={data} theme={theme} idioma={idioma} moeda={moeda} />),
  );
  return { html, data };
}

/**
 * A multimarcas anima o preço (`StatCounter`/`CarCard.tsx`): o HTML
 * server-rendered mostra o contador no valor INICIAL (zero), não o preço
 * final formatado — a string completa só existe depois da animação no
 * cliente. Testada à parte, só pelo símbolo/código da moeda (o badge fixo
 * que ANTES tinha "R$" cravado — a violação de verdade).
 */
const SKINS_COM_PRECO_ANIMADO = new Set(["multimarcas-vortice"]);

describe("preços: precoValor formatado pelo locale/moeda da demo, nunca hardcoded — TODA skin do registro", () => {
  for (const skin of SKINS) {
    if (!SKINS_COM_PRECO_ANIMADO.has(skin.id)) {
      for (const { idioma, moeda } of LOCALES) {
        it(`${skin.id}: cada serviço com precoValor aparece formatado em ${idioma}/${moeda}`, () => {
          const { html, data } = renderComLocale(skin, idioma, moeda);
          const comValor = data.servicos.filter((s) => s.precoValor !== undefined);
          expect(
            comValor.length,
            `${skin.id}: nenhum serviço com precoValor após a migração`,
          ).toBeGreaterThan(0);

          for (const servico of comValor) {
            const esperado = formatarPrecoServico(servico, idioma, moeda);
            expect(html, `"${servico.nome}" (${esperado}) não apareceu no HTML`).toContain(esperado);
          }
        });
      }
    } else {
      it(`${skin.id}: badge de moeda usa CHF em de-CH/fr-CH (nunca "R$" fixo)`, () => {
        const deCH = renderComLocale(skin, "de-CH", "CHF");
        const frCH = renderComLocale(skin, "fr-CH", "CHF");
        expect(deCH.html).toContain(simboloMoeda("de-CH", "CHF"));
        expect(frCH.html).toContain(simboloMoeda("fr-CH", "CHF"));

        const comValor = deCH.data.servicos.filter((s) => s.precoValor !== undefined);
        expect(comValor.length).toBeGreaterThan(0);
      });

      it(`${skin.id}: pt-BR/BRL segue mostrando "R$" (comportamento default inalterado)`, () => {
        const { html } = renderComLocale(skin, "pt-BR", "BRL");
        expect(html).toContain(simboloMoeda("pt-BR", "BRL"));
      });
    }
  }
});
