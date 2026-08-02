import { fitaAfilada, perfilEspessura, pontoCubica, type Ponto } from "../fita";
import type { EfeitoIntensidade } from "../types";

/**
 * Veio = um traço orgânico só, com pulso viajando por cima.
 *
 * A versão anterior era uma curva quadrática desenhada com `stroke` de
 * espessura fixa (0.35) e `stroke-linecap: round`, com opacidade de até
 * 100% no pulso. Na captura isso lia como RISCO: linha reta de ponta a
 * ponta, mesma grossura do começo ao fim, cortada seca na borda da
 * viewport — e o pulso, um tracinho brilhante de tamanho constante
 * deslizando. Nada disso sobrou.
 *
 * Agora cada veio é uma FITA afilada (../fita.ts) construída sobre uma
 * Bézier CÚBICA (dois pontos de controle, então a curva serpenteia em vez
 * de arquear numa direção só): a espessura nasce e morre em zero, ondula
 * ao longo do traço, e nenhum veio tem o mesmo perfil do vizinho. O pulso
 * deixou de ser um segmento com ponta e virou um gradiente que corre pelo
 * comprimento do próprio veio (ver Veios.tsx).
 */

const CONTAGEM_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 3, 2: 5, 3: 7 };
/** Teto de 6% para forma geométrica (era 0.16/0.26/0.38 na base e até 1.0 no pulso). */
const OPACIDADE_BASE_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.016, 2: 0.028, 3: 0.042 };
const OPACIDADE_PULSO_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.024, 2: 0.042, 3: 0.06 };

export interface VeioTraco {
  /** Path FECHADO da fita (viewBox 0 0 100 100), ver ../fita.ts#fitaAfilada. */
  d: string;
  /** Extremos do traço — orientam o gradiente do pulso ao longo dele. */
  de: Ponto;
  ate: Ponto;
  duracaoSegundos: number;
  atrasoSegundos: number;
}

/**
 * Traços determinísticos (sem `Math.random` — o mesmo HTML precisa sair no
 * server e no client, como `particulas/estilo.ts#pontosParticulas`). Todo
 * número deriva do índice: origem, direção, curvatura dos dois controles,
 * espessura máxima, número de ondas da espessura e defasagem do pulso.
 */
export function veiosTracos(intensidade: Exclude<EfeitoIntensidade, 0>): VeioTraco[] {
  const n = CONTAGEM_POR_INTENSIDADE[intensidade];
  return Array.from({ length: n }, (_, i) => {
    const angulo = (((i * 47 + 23) % 360) * Math.PI) / 180;
    const comprimento = 62 + ((i * 13) % 40);
    const p0: Ponto = { x: (i * 31 + 9) % 100, y: (i * 59 + 17) % 100 };
    const p3: Ponto = {
      x: p0.x + Math.cos(angulo) * comprimento,
      y: p0.y + Math.sin(angulo) * comprimento,
    };
    // Controles deslocados para LADOS OPOSTOS da reta p0→p3: é o que faz a
    // cúbica serpentear (um "S" suave) em vez de arquear feito um C.
    const nx = -Math.sin(angulo);
    const ny = Math.cos(angulo);
    const desvio1 = 10 + ((i * 7) % 16);
    const desvio2 = 8 + ((i * 11) % 14);
    const c1: Ponto = {
      x: p0.x + Math.cos(angulo) * comprimento * 0.3 + nx * desvio1,
      y: p0.y + Math.sin(angulo) * comprimento * 0.3 + ny * desvio1,
    };
    const c2: Ponto = {
      x: p0.x + Math.cos(angulo) * comprimento * 0.68 - nx * desvio2,
      y: p0.y + Math.sin(angulo) * comprimento * 0.68 - ny * desvio2,
    };

    const espessura = 0.42 + ((i * 5) % 6) * 0.16;
    const ondas = 2 + (i % 4);
    const fase = (((i * 61) % 100) / 100) * Math.PI * 2;
    const curva = (t: number) => pontoCubica(p0, c1, c2, p3, t);

    return {
      d: fitaAfilada(curva, (t) => perfilEspessura(t, espessura, ondas, fase)),
      de: p0,
      ate: p3,
      duracaoSegundos: 7 + (i % 3) * 2.5,
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
