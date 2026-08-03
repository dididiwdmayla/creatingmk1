import type { Rgb } from "./srgb";

/**
 * QUAIS FAIXAS DE COR A PÁGINA PINTA — a regra, pura e sem DOM (a leitura
 * mora em ./medir.ts, testada aqui em __tests__/fundo.test.ts).
 *
 * O problema: a barra do navegador tem que assumir a cor do que está em
 * foco, e a camada que decide isso é irmã da skin — não sabe onde uma
 * seção começa, muito menos se ela usa `--d-bg` ou `--d-bg-alt`. As 8
 * skins já marcam cada seção com `data-d-secao` (ver
 * `lib/demos/animacao/SecaoMarcada.tsx`), então o "onde procurar" está
 * resolvido; falta o "de que cor, em que altura".
 *
 * **Por que a cor é LIDA do DOM e não declarada por cada skin.** A
 * alternativa era um mapa `seção → token de fundo` por skin: 8 mapas
 * escritos à mão, um por Skin.tsx, que silenciosamente ficam errados no
 * dia em que alguém trocar `bg-[var(--d-bg)]` por `bg-[var(--d-bg-alt)]`
 * numa seção — e o erro não aparece em teste nenhum, só na moldura de um
 * celular. É a mesma duplicação por skin que a migração do `LedEdges`
 * desfez (ver ARCHITECTURE.md). Lendo a cor computada, a fonte da verdade
 * passa a ser o próprio markup: não existe divergência possível. A skin
 * de multimarcas TINHA esse mapa (o `data-themec` inline, com
 * `avaliacao → destaque`) e ele foi removido nesta feature — a leitura
 * automática reproduz as três cores dele PIXEL A PIXEL, o que é
 * justamente a evidência de que a regra abaixo enxerga o que a skin
 * pinta (`qa-visual.mjs --so=barra`, erro 0 nas sete seções).
 *
 * **A unidade não é a seção, é a FAIXA.** A primeira versão respondia
 * "qual a cor DESTA seção", uma cor por seção marcada, e o laço mostrou
 * que isso é grosso demais: o rodapé da skin de imobiliária é um
 * `<footer>` creme de 1510px com um bloco VERDE-ESCURO de 901px dentro —
 * mais alto que a tela inteira de um celular. Com uma cor por seção a
 * barra ficava creme durante toda a travessia do bloco verde, que é
 * exatamente o contrário do que a feature promete. Aqui uma seção produz
 * quantas faixas pintar: cada superfície full-bleed vira uma faixa, e as
 * de dentro RECOBREM as de fora na parte em que se sobrepõem — que é o
 * que o navegador faz na tela.
 *
 * **O que conta como superfície full-bleed**: largura igual à da seção,
 * com folga só de subpixel. Não é um limiar de calibração, é uma
 * condição geométrica — e ela existe porque a versão anterior usava
 * percentagens frouxas ("≥90% da largura, ≥50% da altura") e o laço
 * reprovou duas vezes na mesma skin: um painel arredondado de 358px numa
 * seção de 390 (91,8%) punha o LARANJA do destaque na barra de uma seção
 * creme, e um círculo decorativo de 560×560 transbordando o hero (144% da
 * largura) punha o lilás do `--d-bg-alt`. O teto de largura é o que barra
 * o segundo: fundo de verdade tem a largura da caixa, decoração que vaza
 * é mais larga.
 *
 * O que sobra sem faixa nenhuma — uma seção transparente, ou o pedaço de
 * seção acima/abaixo de um bloco colorido — não vira cor: quem chama usa
 * o plano da página, que é o que de fato aparece ali.
 */

/** Uma superfície candidata a faixa, já medida. */
export interface SuperficieMedida {
  /** 0 = o próprio elemento marcado; 1 = filho direto; e assim por diante. */
  profundidade: number;
  /** Topo e base em px, na mesma origem para todas (ver ./medir.ts). */
  topo: number;
  base: number;
  largura: number;
  /** Cor de fundo computada, opaca — `undefined` = não pinta (ver ./srgb.ts). */
  cor?: Rgb;
}

/** Uma faixa efetivamente pintada, já resolvida a sobreposição. */
export interface FaixaPintada {
  topo: number;
  base: number;
  cor: Rgb;
}

/**
 * Largura mínima e máxima de uma superfície, como fração da largura da
 * seção. O piso exclui card e painel; o teto exclui decoração que
 * transborda a caixa (o círculo de 144% do hero da skin de petshop).
 */
const LARGURA_MINIMA = 0.99;
const LARGURA_MAXIMA = 1.01;

/**
 * Até que profundidade procurar. Fundo de seção vive no `<section>`
 * (profundidade 0 ou 1 — as skins às vezes envolvem em `SectionReveal`)
 * ou num wrapper imediato dele; um bloco colorido dentro da seção fica um
 * ou dois níveis abaixo. 4 cobre folgado as 8 skins e mantém a varredura
 * barata: ela roda no mount e no resize, nunca por quadro de rolagem.
 */
export const PROFUNDIDADE_MAXIMA = 4;

/**
 * As faixas que a seção realmente pinta, sem sobreposição e na ordem em
 * que aparecem. Superfície mais profunda recobre a mais rasa — é o que o
 * navegador faz, e é o que faz o bloco verde do rodapé vencer o creme do
 * `<footer>` que o contém.
 */
export function faixasPintadas(
  superficies: readonly SuperficieMedida[],
  larguraSecao: number,
): FaixaPintada[] {
  if (larguraSecao <= 0) return [];
  const validas = superficies
    .filter(
      (s): s is SuperficieMedida & { cor: Rgb } =>
        !!s.cor &&
        s.base > s.topo &&
        s.largura >= larguraSecao * LARGURA_MINIMA &&
        s.largura <= larguraSecao * LARGURA_MAXIMA,
    )
    // Da mais rasa para a mais profunda: a próxima pinta por cima. Empate
    // de profundidade mantém a ordem do documento (`sort` é estável), que
    // entre irmãos é justamente a ordem de pintura.
    .sort((a, b) => a.profundidade - b.profundidade);

  let faixas: FaixaPintada[] = [];
  for (const nova of validas) {
    const recortadas: FaixaPintada[] = [];
    for (const f of faixas) {
      // O que da faixa anterior sobra fora do intervalo da nova.
      if (f.topo < nova.topo) recortadas.push({ ...f, base: Math.min(f.base, nova.topo) });
      if (f.base > nova.base) recortadas.push({ ...f, topo: Math.max(f.topo, nova.base) });
    }
    recortadas.push({ topo: nova.topo, base: nova.base, cor: nova.cor });
    faixas = recortadas.filter((f) => f.base > f.topo);
  }
  return faixas.sort((a, b) => a.topo - b.topo);
}
