import { faixasPintadas, PROFUNDIDADE_MAXIMA, type SuperficieMedida } from "./fundo";
import type { FaixaCor } from "./foco";
import { lerCor } from "./srgb";

/**
 * A leitura no DOM que alimenta ./foco.ts — a regra e a matemática moram
 * lá e em ./fundo.ts, puras e testadas; aqui só se lê.
 *
 * O custo está separado em dois níveis de propósito, porque as duas
 * perguntas mudam em ritmos completamente diferentes:
 *
 *   - **que faixas de cor cada seção pinta, e onde dentro dela** muda
 *     quando o layout muda (fonte carregou, imagem chegou, girou o
 *     aparelho) — varre a subárvore até `PROFUNDIDADE_MAXIMA` chamando
 *     `getComputedStyle`, e é feita no mount e no resize, nunca por
 *     quadro;
 *   - **onde a seção está** muda a cada pixel de rolagem — é só um
 *     `getBoundingClientRect` por seção, o mesmo orçamento que
 *     `medirCobertura` (a camada decorativa) já gasta por quadro.
 *
 * O que liga os dois é guardar as faixas em coordenadas RELATIVAS ao topo
 * da seção: por quadro basta somar o `top` atual dela. Medir a posição
 * absoluta de cada faixa por quadro custaria um `getBoundingClientRect`
 * por faixa, não por seção.
 */

/** Uma seção marcada + as faixas que ela pinta, em offsets a partir do topo dela. */
export interface SecaoMedida {
  el: HTMLElement;
  faixas: { topoRel: number; baseRel: number; cor: FaixaCor["cor"] }[];
}

/**
 * Superfícies de uma seção: o elemento marcado e a subárvore dele até
 * `PROFUNDIDADE_MAXIMA`, com posição relativa ao topo da seção, largura e
 * cor de fundo computada.
 *
 * A varredura para de descer numa seção ANINHADA (outro `data-d-secao`):
 * aquela subárvore é da outra seção e será medida por ela. Sem esse
 * corte, uma skin que aninhasse seções contaria as faixas duas vezes.
 */
function superficies(secao: HTMLElement, topoDaSecao: number): SuperficieMedida[] {
  const lista: SuperficieMedida[] = [];
  let nivel: HTMLElement[] = [secao];
  for (let profundidade = 0; profundidade <= PROFUNDIDADE_MAXIMA && nivel.length; profundidade++) {
    const proximo: HTMLElement[] = [];
    for (const el of nivel) {
      const r = el.getBoundingClientRect();
      lista.push({
        profundidade,
        topo: r.top - topoDaSecao,
        base: r.bottom - topoDaSecao,
        largura: r.width,
        cor: lerCor(getComputedStyle(el).backgroundColor),
      });
      for (const filho of el.children) {
        if (!(filho instanceof HTMLElement)) continue;
        if (filho !== secao && filho.hasAttribute("data-d-secao")) continue;
        proximo.push(filho);
      }
    }
    nivel = proximo;
  }
  return lista;
}

/**
 * Todas as seções marcadas do documento, cada uma já com as faixas que
 * pinta. Chamada no mount e no resize — ver o comentário do módulo.
 */
export function medirSecoes(doc: Document = document): SecaoMedida[] {
  const medidas: SecaoMedida[] = [];
  for (const el of doc.querySelectorAll<HTMLElement>("[data-d-secao]")) {
    const r = el.getBoundingClientRect();
    const faixas = faixasPintadas(superficies(el, r.top), r.width).map((f) => ({
      topoRel: f.topo,
      baseRel: f.base,
      cor: f.cor,
    }));
    medidas.push({ el, faixas });
  }
  return medidas;
}

/** Onde cada faixa medida está AGORA, em px relativos à viewport. */
export function faixasAtuais(secoes: readonly SecaoMedida[]): FaixaCor[] {
  const faixas: FaixaCor[] = [];
  for (const { el, faixas: doSecao } of secoes) {
    if (doSecao.length === 0) continue;
    const topo = el.getBoundingClientRect().top;
    for (const f of doSecao) {
      faixas.push({ topo: topo + f.topoRel, base: topo + f.baseRel, cor: f.cor });
    }
  }
  return faixas;
}
