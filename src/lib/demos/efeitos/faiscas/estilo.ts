import type { EfeitoIntensidade } from "../types";
import { pontosParticulas } from "../particulas/estilo";

/**
 * Reaproveita o gerador determinístico de posições do motor de partículas
 * (`../particulas/estilo.ts#pontosParticulas`) como base — mesmas
 * posições/índices, só reinterpretados como faísca: vida bem mais curta
 * (fração da duração original de "subir a viewport inteira") e uma deriva
 * horizontal (queda por gravidade, ver `Faiscas.tsx`) em vez da subida
 * reta e lenta em loop das partículas normais.
 *
 * **Sobre o teto de 6%**: o limite desta revisão vale para FORMA
 * GEOMÉTRICA — superfície que cobre área e disputa contraste com o texto
 * (a mancha do gradiente, a fita do veio, o arco do geométrico). Uma
 * faísca é fonte de luz PONTUAL: 16 brasas de ~10px numa viewport de
 * 1100×700 cobrem cerca de 0,16% da tela, e a 6% de opacidade elas
 * simplesmente deixam de existir — o efeito inteiro viraria um `nenhum`
 * mais caro. O que a captura reprovou aqui não foi o brilho e sim a
 * FORMA: `background` de cor chapada num `rounded-full`, ou seja, um
 * disquinho recortado com borda. Então a correção é a borda (agora
 * gradiente radial até transparente, com núcleo e halo de tamanhos
 * variados), e o brilho cai bem abaixo do que era sem ir ao chão.
 */
const CONTAGEM_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 6, 2: 11, 3: 16 };
const OPACIDADE_CONTAINER_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.3, 2: 0.45, 3: 0.6 };

export interface Faisca {
  left: number;
  top: number;
  derivaXPx: number;
  duracaoSegundos: number;
  atrasoSegundos: number;
  /** Diâmetro total da brasa em px (núcleo + halo). */
  tamanhoPx: number;
  /** Onde o alfa começa a cair (%) — núcleo pequeno, queda longa. */
  nucleoPercent: number;
}

export function faiscas(intensidade: Exclude<EfeitoIntensidade, 0>): Faisca[] {
  const base = pontosParticulas(intensidade).slice(0, CONTAGEM_POR_INTENSIDADE[intensidade]);
  return base.map((p, i) => ({
    left: p.left,
    top: p.topEstatico,
    derivaXPx: i % 2 === 0 ? 10 + (i % 4) * 4 : -(10 + (i % 4) * 4),
    // vida curta: uma fração pequena da duração original de "particulas" (14-23s).
    duracaoSegundos: 0.6 + (p.duracaoSegundos % 5) * 0.15,
    atrasoSegundos: p.atrasoSegundos % 4,
    // Tamanho contínuo por índice (era um booleano `grande`: 2px ou 3px,
    // dois carimbos repetidos pela tela inteira).
    tamanhoPx: (p.grande ? 9 : 6) + (i % 5),
    nucleoPercent: 10 + ((i * 13) % 5) * 4,
  }));
}

export function opacidadeContainer(intensidade: Exclude<EfeitoIntensidade, 0>): number {
  return OPACIDADE_CONTAINER_POR_INTENSIDADE[intensidade];
}
