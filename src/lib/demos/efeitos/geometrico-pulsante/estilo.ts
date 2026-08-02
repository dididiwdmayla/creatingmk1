import type { EfeitoIntensidade } from "../types";

const CAMADAS_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 3, 2: 5, 3: 7 };
const OPACIDADE_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.3, 2: 0.5, 3: 0.75 };
const LADOS = 6;
const RAIO_MAX_PERCENT = 42;

export interface PoligonoCamada {
  /** Atributo `points` do `<polygon>` SVG (viewBox 0 0 100 100). */
  points: string;
  atrasoSegundos: number;
}

function pontosPoligono(raio: number, lados: number, rotacaoGraus: number): string {
  return Array.from({ length: lados }, (_, i) => {
    const anguloRad = ((360 / lados) * i + rotacaoGraus) * (Math.PI / 180);
    const x = 50 + raio * Math.cos(anguloRad);
    const y = 50 + raio * Math.sin(anguloRad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

/**
 * Polígonos concêntricos, do menor (mais interno) pro maior — cada camada
 * alterna 30° de rotação (não fica tudo alinhado radialmente, quebra a
 * simetria repetitiva). Atraso NEGATIVO escalonado por camada (ver
 * `GeometricoPulsante.tsx`) faz o pulso rodar defasado entre elas — como
 * uma onda saindo de dentro pra fora, sem sincronizar todo mundo no mesmo
 * frame.
 */
export function camadasGeometricoPulsante(
  intensidade: Exclude<EfeitoIntensidade, 0>,
): PoligonoCamada[] {
  const n = CAMADAS_POR_INTENSIDADE[intensidade];
  return Array.from({ length: n }, (_, i) => {
    const raio = RAIO_MAX_PERCENT * ((i + 1) / n);
    return {
      points: pontosPoligono(raio, LADOS, i % 2 === 0 ? 0 : 30),
      atrasoSegundos: -(i * 0.35),
    };
  });
}

export function opacidadeGeometricoPulsante(intensidade: Exclude<EfeitoIntensidade, 0>): number {
  return OPACIDADE_POR_INTENSIDADE[intensidade];
}
