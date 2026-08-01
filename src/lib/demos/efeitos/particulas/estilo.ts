import type { EfeitoIntensidade } from "../types";

/**
 * Estilo do efeito "partículas", separado do componente pra ser testável
 * sem DOM (ver __tests__/estilo.test.ts) — mesma convenção de
 * `../gradiente/estilo.ts`. A contagem de pontos e a opacidade (aplicada
 * no CONTAINER, multiplicando a opacidade fixa de cada `@keyframes`
 * individual) escalam com a intensidade; `reducedMotion` desliga a
 * animação por completo (estático), não só pausa.
 */

const CONTAGEM_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 8, 2: 14, 3: 20 };
const OPACIDADE_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.6, 2: 1, 3: 1.4 };

export interface PontoParticula {
  left: number;
  duracaoSegundos: number;
  atrasoSegundos: number;
  grande: boolean;
  /**
   * Posição vertical (% da viewport) usada só em `prefers-reduced-motion`
   * (ver Particulas.tsx): sem @keyframes rodando, a partícula fica parada
   * na posição CSS estática — `bottom: -10px` (o ponto de partida da
   * subida animada) fica sempre fora da viewport, então o fallback
   * estático precisa de uma posição própria dentro dela.
   */
  topEstatico: number;
}

/** Posições/tempos determinísticos por índice — nada de Math.random (mesmo HTML no server e no client). */
export function pontosParticulas(intensidade: Exclude<EfeitoIntensidade, 0>): PontoParticula[] {
  return Array.from({ length: CONTAGEM_POR_INTENSIDADE[intensidade] }, (_, i) => ({
    left: (i * 37 + 11) % 100,
    duracaoSegundos: 14 + ((i * 5) % 9),
    atrasoSegundos: -((i * 3.7) % 14),
    grande: i % 3 === 0,
    topEstatico: (i * 29 + 7) % 100,
  }));
}

export function opacidadeContainer(intensidade: Exclude<EfeitoIntensidade, 0>): number {
  return OPACIDADE_POR_INTENSIDADE[intensidade];
}

export interface EstiloPonto {
  animationName: string;
  animationPlayState: "running" | "paused";
}

/** reducedMotion = estático: sem @keyframes ligado (não só pausado). */
export function estiloPonto(reducedMotion: boolean, ativo: boolean): EstiloPonto {
  return {
    animationName: reducedMotion ? "none" : "d-efeito-particulas-flutua",
    animationPlayState: ativo ? "running" : "paused",
  };
}
