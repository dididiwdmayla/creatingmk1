import type { EfeitoIntensidade } from "../types";

/**
 * Estilo do overlay do efeito "gradiente", separado do componente pra ser
 * testável sem DOM (ver __tests__/estilo.test.ts) — mesma convenção do
 * resto do repo (lógica pura extraída, componente fica fino). `filter`
 * nunca anima (contrato dos efeitos): só opacidade escala com a
 * intensidade; a animação em si (transform, via @keyframes
 * d-efeito-gradiente-drift) só liga sem `reducedMotion`, e só corre
 * (`animationPlayState`) quando `ativo`.
 */

export const BLUR_PX = 80;

/**
 * Teto de 6% (era 0.06/0.10/0.15). O efeito é renderizado POR CIMA do
 * conteúdo (ver ARCHITECTURE.md, "Cobertura de viewport"), então a
 * opacidade é a única coisa entre a mancha e a legibilidade do texto.
 */
const OPACIDADE_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.025, 2: 0.04, 3: 0.06 };

export interface EstiloGradiente {
  filter: string;
  opacity: number;
  animationName: string;
  animationPlayState: "running" | "paused";
}

export function estiloGradiente(
  intensidade: Exclude<EfeitoIntensidade, 0>,
  reducedMotion: boolean,
  ativo: boolean,
): EstiloGradiente {
  return {
    filter: `blur(${BLUR_PX}px)`,
    opacity: OPACIDADE_POR_INTENSIDADE[intensidade],
    // reducedMotion = estático: nenhum @keyframes ligado, não só pausado.
    animationName: reducedMotion ? "none" : "d-efeito-gradiente-drift",
    animationPlayState: ativo ? "running" : "paused",
  };
}
