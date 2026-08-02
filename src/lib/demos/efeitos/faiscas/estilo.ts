import type { EfeitoIntensidade } from "../types";
import { pontosParticulas } from "../particulas/estilo";

/**
 * Reaproveita o gerador determinístico de posições do motor de partículas
 * (`../particulas/estilo.ts#pontosParticulas`) como base — mesmas
 * posições/índices, só reinterpretados como faísca: vida bem mais curta
 * (fração da duração original de "subir a viewport inteira") e uma deriva
 * horizontal (queda por gravidade, ver `Faiscas.tsx`) em vez da subida
 * reta e lenta em loop das partículas normais.
 */
const CONTAGEM_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 6, 2: 11, 3: 16 };
const OPACIDADE_CONTAINER_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.6, 2: 0.85, 3: 1 };

export interface Faisca {
  left: number;
  top: number;
  derivaXPx: number;
  duracaoSegundos: number;
  atrasoSegundos: number;
  grande: boolean;
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
    grande: p.grande,
  }));
}

export function opacidadeContainer(intensidade: Exclude<EfeitoIntensidade, 0>): number {
  return OPACIDADE_CONTAINER_POR_INTENSIDADE[intensidade];
}
