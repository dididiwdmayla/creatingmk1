import type { EfeitoIntensidade } from "../types";

/**
 * Matemática do alvo da Aura, separada do componente pra ser testável sem
 * DOM (ver __tests__/alvo.test.ts) — mesma convenção do resto do repo
 * (lógica pura extraída, componente fica fino, ver gradiente/particulas
 * estilo.ts). Contrato: no desktop (`pointer: fine`) o alvo segue o
 * ponteiro (`alvoPonteiro`); no celular o alvo é o CENTRO da viewport
 * (0,0), deslocado pelo progresso de scroll (`alvoScroll`) e somado à
 * deriva lenta autônoma (`deriva`) — nunca parado enquanto o usuário não
 * rola nem move o dedo. `lerpPonto` interpola suavemente em direção ao
 * alvo (nunca posição colada).
 */

export interface Ponto {
  x: number;
  y: number;
}

const ESCALA_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.55, 2: 0.8, 3: 1 };
/** rad/ms — deriva lenta autônoma no celular. */
export const DERIVA_VELOCIDADE = 0.00012;

/** Fator de interpolação (lerp) por intensidade: mais intenso, alcança o alvo mais rápido. */
export function fatorLerp(intensidade: Exclude<EfeitoIntensidade, 0>): number {
  return ESCALA_POR_INTENSIDADE[intensidade] * 0.06 + 0.02;
}

/** Alvo no desktop: posição do ponteiro relativa ao container, em % (-20 a 20). */
export function alvoPonteiro(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): Ponto {
  return {
    x: ((clientX - rect.left) / rect.width - 0.5) * 40,
    y: ((clientY - rect.top) / rect.height - 0.5) * 40,
  };
}

/**
 * Alvo no celular: centro da viewport (0,0) deslocado pelo progresso de
 * scroll (-15 no topo, 0 na metade, +15 no fim). `scrollMax <= 0` (página
 * mais curta que a viewport) cai no topo (pct 0), nunca divide por zero.
 */
export function alvoScroll(scrollY: number, scrollMax: number): Ponto {
  const pct = scrollMax > 0 ? scrollY / scrollMax : 0;
  const offset = (pct - 0.5) * 30;
  return { x: offset, y: offset };
}

/** Deriva lenta autônoma (senoidal), amplitude 8, defasada entre x/y. */
export function deriva(nowMs: number): Ponto {
  return {
    x: Math.sin(nowMs * DERIVA_VELOCIDADE) * 8,
    y: Math.cos(nowMs * DERIVA_VELOCIDADE * 0.7) * 8,
  };
}

/** Interpola `atual` em direção a `alvo` por `fator` (0-1) — nunca salta pra cima do alvo. */
export function lerpPonto(atual: Ponto, alvo: Ponto, fator: number): Ponto {
  return {
    x: atual.x + (alvo.x - atual.x) * fator,
    y: atual.y + (alvo.y - atual.y) * fator,
  };
}
