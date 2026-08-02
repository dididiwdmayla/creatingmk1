import type { EfeitoIntensidade } from "../types";

const CONTAGEM_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 34, 2: 60, 3: 92 };
/** Teto de 6% para forma geométrica (era 0.35/0.55/0.80). */
const OPACIDADE_MAX_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.026, 2: 0.042, 3: 0.06 };
/** Decaimento nunca some por completo — o ponto mais velho (centro) continua visível, só bem desbotado. */
const OPACIDADE_MIN = 0.006;
const ANGULO_DOURADO_GRAUS = 137.5;
/**
 * Raio em `vmin`, não em `%`: com percentagem, `left`/`top` medem eixos
 * DIFERENTES (largura e altura da viewport), e a espiral — que só existe
 * como espiral se os dois raios forem iguais — virava uma elipse achatada
 * em qualquer tela que não fosse quadrada. Em vmin os dois eixos usam a
 * mesma unidade e o padrão de filotaxia se mantém.
 */
const RAIO_MAX_VMIN = 44;

export interface PontoFilotaxia {
  /** Deslocamento a partir do CENTRO da viewport, em vmin (ver RAIO_MAX_VMIN). */
  xVmin: number;
  yVmin: number;
  opacidade: number;
  raioPx: number;
  /** Suavidade da borda do ponto: onde o alfa do radial começa a cair (%). */
  nucleoPercent: number;
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
 *
 * Raio e suavidade de borda variam CONTINUAMENTE com o índice (antes eram
 * dois tamanhos fixos, 2px ou 3px, alternados por `i % 5`): o campo de
 * pontos passa a ter granulação, não dois carimbos repetidos.
 */
export function pontosFilotaxia(intensidade: Exclude<EfeitoIntensidade, 0>): PontoFilotaxia[] {
  const n = CONTAGEM_POR_INTENSIDADE[intensidade];
  const opacidadeMax = OPACIDADE_MAX_POR_INTENSIDADE[intensidade];
  const escalaRaio = RAIO_MAX_VMIN / Math.sqrt(n);
  return Array.from({ length: n }, (_, i) => {
    const anguloRad = (i * ANGULO_DOURADO_GRAUS * Math.PI) / 180;
    const raio = escalaRaio * Math.sqrt(i);
    const idade = n <= 1 ? 0 : 1 - i / (n - 1);
    const progresso = n <= 1 ? 0 : i / (n - 1);
    return {
      xVmin: raio * Math.cos(anguloRad),
      yVmin: raio * Math.sin(anguloRad),
      opacidade: OPACIDADE_MIN + (opacidadeMax - OPACIDADE_MIN) * (1 - idade),
      // Cresce em direção à borda (o crescimento mais recente é o mais
      // encorpado), com uma variação por índice pra não ficar uma rampa
      // limpa demais.
      raioPx: 3 + progresso * 5 + ((i * 7) % 5) * 0.6,
      nucleoPercent: 8 + ((i * 11) % 7) * 3,
      atrasoSegundos: -((i * 1.7) % 8),
    };
  });
}
