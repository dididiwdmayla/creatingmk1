import type { EfeitoIntensidade } from "../types";

const CONTAGEM_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 34, 2: 60, 3: 92 };
const OPACIDADE_MAX_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.35, 2: 0.55, 3: 0.8 };
/** Decaimento nunca some por completo — o ponto mais velho (centro) continua visível, só bem desbotado. */
const OPACIDADE_MIN = 0.06;
const ANGULO_DOURADO_GRAUS = 137.5;
/** % da menor dimensão da viewport — deixa margem das bordas pro ponto mais externo. */
const RAIO_MAX_PERCENT = 46;

export interface PontoFilotaxia {
  xPercent: number;
  yPercent: number;
  opacidade: number;
  raioPx: number;
  atrasoSegundos: number;
}

/**
 * Pontos nascendo do centro para fora pelo ângulo dourado (137.5° por
 * índice, raio ∝ √índice) — a mesma disposição de sementes de
 * girassol/pinha (filotaxia), sem depender de nenhuma ilustração externa,
 * só matemática. `i` é a ordem de nascimento: 0 nasce no centro, índices
 * maiores nascem depois, mais afastados.
 *
 * "Idade" de cada ponto é o tempo decorrido desde que nasceu, relativo ao
 * mais novo (i = n-1, na borda, idade 0) — por isso o decaimento de
 * opacidade CRESCE em direção ao centro (crescimento mais antigo, mais
 * desbotado com o tempo) e não à borda (crescimento mais recente, mais
 * vívido): o mesmo sentido de "decaimento por idade" de um anel de
 * crescimento real.
 */
export function pontosFilotaxia(intensidade: Exclude<EfeitoIntensidade, 0>): PontoFilotaxia[] {
  const n = CONTAGEM_POR_INTENSIDADE[intensidade];
  const opacidadeMax = OPACIDADE_MAX_POR_INTENSIDADE[intensidade];
  const escalaRaio = RAIO_MAX_PERCENT / Math.sqrt(n);
  return Array.from({ length: n }, (_, i) => {
    const anguloRad = (i * ANGULO_DOURADO_GRAUS * Math.PI) / 180;
    const raio = escalaRaio * Math.sqrt(i);
    const idade = n <= 1 ? 0 : 1 - i / (n - 1);
    return {
      xPercent: 50 + raio * Math.cos(anguloRad),
      yPercent: 50 + raio * Math.sin(anguloRad),
      opacidade: OPACIDADE_MIN + (opacidadeMax - OPACIDADE_MIN) * (1 - idade),
      raioPx: i % 5 === 0 ? 3 : 2,
      atrasoSegundos: -((i * 1.7) % 8),
    };
  });
}
