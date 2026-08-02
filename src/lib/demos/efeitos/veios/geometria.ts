import type { EfeitoIntensidade } from "../types";

const CONTAGEM_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 4, 2: 6, 3: 8 };
const OPACIDADE_BASE_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.16, 2: 0.26, 3: 0.38 };
const OPACIDADE_PULSO_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.45, 2: 0.7, 3: 1 };

export interface VeioTraco {
  /** Path SVG (viewBox 0 0 100 100) — uma curva quadrática só, sem ramificação. */
  d: string;
  duracaoSegundos: number;
  atrasoSegundos: number;
}

/**
 * Traços orgânicos determinísticos (sem `Math.random` — mesmo HTML no
 * server e no client, como `particulas/estilo.ts#pontosParticulas`): cada
 * traço é uma curva quadrática saindo de um ponto disperso pela tela numa
 * direção própria (ângulo por índice, não relacionado ao ângulo dourado de
 * `filotaxia`). O pulso que viaja por cima (ver `Veios.tsx`) usa o MESMO
 * `d`, só com `stroke-dasharray`/`stroke-dashoffset` diferentes.
 */
export function veiosTracos(intensidade: Exclude<EfeitoIntensidade, 0>): VeioTraco[] {
  const n = CONTAGEM_POR_INTENSIDADE[intensidade];
  return Array.from({ length: n }, (_, i) => {
    const anguloGraus = (i * 47 + 23) % 360;
    const angulo = (anguloGraus * Math.PI) / 180;
    const origemX = (i * 31 + 9) % 100;
    const origemY = (i * 59 + 17) % 100;
    const meioX = origemX + Math.cos(angulo) * 38;
    const meioY = origemY + Math.sin(angulo) * 38;
    const fimX = origemX + Math.cos(angulo) * 72;
    const fimY = origemY + Math.sin(angulo) * 72;
    return {
      d: `M ${origemX.toFixed(1)} ${origemY.toFixed(1)} Q ${meioX.toFixed(1)} ${meioY.toFixed(1)} ${fimX.toFixed(1)} ${fimY.toFixed(1)}`,
      duracaoSegundos: 5 + (i % 3) * 1.5,
      atrasoSegundos: -((i * 2.3) % 6),
    };
  });
}

export function opacidadeBase(intensidade: Exclude<EfeitoIntensidade, 0>): number {
  return OPACIDADE_BASE_POR_INTENSIDADE[intensidade];
}

export function opacidadePulso(intensidade: Exclude<EfeitoIntensidade, 0>): number {
  return OPACIDADE_PULSO_POR_INTENSIDADE[intensidade];
}
