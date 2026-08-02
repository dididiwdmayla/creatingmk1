import { fitaAfilada, perfilEspessura, type Ponto } from "../fita";
import type { EfeitoIntensidade } from "../types";

/**
 * Antes desta revisão o efeito desenhava HEXÁGONOS concêntricos fechados,
 * com `stroke` de espessura constante e opacidade de até 75%: dava pra
 * contar os lados a olho nu, e os dois lados verticais de cada camada
 * (a rotação de 30° alternada os deixa exatamente verticais) empilhavam
 * numa faixa escura atravessando o meio da tela — foi assim que a revisão
 * visual localizou o defeito. Nada disso sobrou.
 *
 * O que existe agora: ARCOS soltos, nunca um contorno fechado. Cada arco é
 * uma fita afilada (../fita.ts) — espessura nasce e morre em zero, varia
 * ao longo do traço e nunca é a mesma de um arco pro outro. Um anel é
 * feito de poucos arcos com folga entre eles, e cada arco tem um começo
 * angular próprio, então em nenhuma intensidade o conjunto fecha numa
 * figura de N lados. O raio de cada arco também ondula com o ângulo, então
 * nem os arcos isolados são circunferências perfeitas.
 */

const ARCOS_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 5, 2: 9, 3: 14 };
/**
 * Teto de 6% de opacidade para forma geométrica — o limite desta revisão.
 * Era 0.30/0.50/0.75.
 */
const OPACIDADE_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.022, 2: 0.038, 3: 0.06 };

/** Coordenadas em viewBox 0 0 100 100 (ver GeometricoPulsante.tsx). */
const CENTRO = 50;
const RAIO_MIN = 12;
const RAIO_MAX = 46;

export interface ArcoCamada {
  /** Path FECHADO da fita (ver ../fita.ts#fitaAfilada). */
  d: string;
  /** Extremos do arco — alimentam o gradiente de brilho ao longo do traço. */
  de: Ponto;
  ate: Ponto;
  /** Índice do padrão de stops do gradiente (ver GeometricoPulsante.tsx). */
  brilho: number;
  atrasoSegundos: number;
}

/**
 * Arcos determinísticos (nada de `Math.random`: o mesmo HTML precisa sair
 * no server e no client). Todo número deriva do índice — raio, abertura,
 * começo angular, espessura, ondulação e defasagem do pulso — de forma que
 * dois arcos nunca coincidam em mais de um atributo.
 */
export function arcosGeometricoPulsante(
  intensidade: Exclude<EfeitoIntensidade, 0>,
): ArcoCamada[] {
  const n = ARCOS_POR_INTENSIDADE[intensidade];
  return Array.from({ length: n }, (_, i) => {
    const raio = RAIO_MIN + (RAIO_MAX - RAIO_MIN) * (((i * 5) % n) / Math.max(1, n - 1));
    // Abertura curta e variada: um arco nunca dá a volta, então nunca há
    // anel fechado nem vértice pra leitura pegar como "lado de polígono".
    const abertura = (60 + ((i * 37) % 95)) * (Math.PI / 180);
    const inicio = ((i * 137 + 20) % 360) * (Math.PI / 180);
    const espessura = 0.5 + ((i * 3) % 5) * 0.22;
    const ondas = 2 + (i % 3);
    const fase = ((i * 47) % 100) / 100 * Math.PI * 2;
    // Ondulação do raio: tira a circunferência perfeita sem deformar o
    // arco a ponto de ele deixar de ler como curva.
    const amplitude = 1.1 + (i % 4) * 0.5;

    const ponto = (t: number): Ponto => {
      const angulo = inicio + abertura * t;
      const r = raio + amplitude * Math.sin(t * Math.PI * (1 + (i % 3)) + fase);
      return { x: CENTRO + r * Math.cos(angulo), y: CENTRO + r * Math.sin(angulo) };
    };

    return {
      d: fitaAfilada(ponto, (t) => perfilEspessura(t, espessura, ondas, fase)),
      de: ponto(0),
      ate: ponto(1),
      brilho: i % 4,
      atrasoSegundos: -(((i * 0.73) % 4.2) + 0.1),
    };
  });
}

export function opacidadeGeometricoPulsante(intensidade: Exclude<EfeitoIntensidade, 0>): number {
  return OPACIDADE_POR_INTENSIDADE[intensidade];
}
