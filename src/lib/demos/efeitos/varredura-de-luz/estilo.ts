import type { EfeitoIntensidade } from "../types";

const DURACAO_CICLO_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 9, 2: 7, 3: 5.5 };
const LARGURA_PERCENT_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 14, 2: 20, 3: 28 };
const OPACIDADE_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.35, 2: 0.55, 3: 0.8 };

export interface EstiloVarredura {
  larguraPercent: number;
  duracaoSegundos: number;
  opacidade: number;
  animationName: string;
  animationPlayState: "running" | "paused";
}

/**
 * Feixe diagonal que atravessa a viewport (logo o título, sempre na parte
 * de cima) PERIODICAMENTE: a maior parte do ciclo é pausa — a passada em
 * si ocupa só os primeiros ~14% da duração do `@keyframes` (ver
 * VarreduraDeLuz.tsx), o resto é o feixe parado fora da tela até a
 * próxima volta. `reducedMotion` desliga o keyframe por completo
 * (estático), não só pausa.
 */
export function estiloVarredura(
  intensidade: Exclude<EfeitoIntensidade, 0>,
  reducedMotion: boolean,
  ativo: boolean,
): EstiloVarredura {
  return {
    larguraPercent: LARGURA_PERCENT_POR_INTENSIDADE[intensidade],
    duracaoSegundos: DURACAO_CICLO_POR_INTENSIDADE[intensidade],
    opacidade: OPACIDADE_POR_INTENSIDADE[intensidade],
    animationName: reducedMotion ? "none" : "d-efeito-varredura-sweep",
    animationPlayState: ativo ? "running" : "paused",
  };
}
