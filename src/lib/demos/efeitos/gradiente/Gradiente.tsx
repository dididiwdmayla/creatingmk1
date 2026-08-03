"use client";

import { useRef } from "react";

import type { EfeitoProps } from "../types";
import { useEfeitoAtivo } from "../useEfeitoAtivo";
import { estiloGradiente } from "./estilo";

/**
 * Dois radiais de gradiente, blur assado (fixo, nunca animado) derivando
 * devagar via `transform` (GPU). Migrado do overlay fixo por skin
 * (`Theme.fundoEfeito` "gradiente", antes CSS puro em cada Skin.tsx) para
 * o registro de efeitos: mesma técnica visual, agora um componente único
 * que só depende de `cores` (nunca de CSS vars locais de uma skin
 * específica) e escala com `intensidade`.
 */
/**
 * Rampa de cada mancha, em `[parada, percentual de cor]`.
 *
 * Cada mancha cai em VÁRIOS stops, não num salto direto pra `transparent`:
 * uma rampa de dois pontos tem inclinação constante, e o olho pega o fim
 * dela como se fosse um contorno. Antes eram 4 paradas com um
 * `filter: blur(80px)` por cima arredondando o resto; o filtro caiu (ver
 * ./estilo.ts, "A queda do blur" — ele custava 5/6 dos quadros da página)
 * e a suavidade que ele dava virou o que sempre foi, matematicamente, para
 * uma mancha radial: mais paradas e uma cauda mais longa. Os dois raios
 * continuam diferentes, pra que as manchas não leiam como círculos gêmeos.
 */
const PARADAS_PRIMARIA: ReadonlyArray<readonly [number, number]> = [
  [0, 100],
  [8, 78],
  [17, 50],
  [26, 26],
  [36, 10],
  [46, 3],
  [58, 0],
];
const PARADAS_SECUNDARIA: ReadonlyArray<readonly [number, number]> = [
  [0, 100],
  [7, 74],
  [15, 46],
  [23, 23],
  [32, 9],
  [41, 3],
  [52, 0],
];

function mancha(
  posicao: string,
  cor: string,
  paradas: ReadonlyArray<readonly [number, number]>,
): string {
  const stops = paradas.map(([parada, pct]) => {
    if (pct === 100) return `${cor} ${parada}%`;
    if (pct === 0) return `transparent ${parada}%`;
    return `color-mix(in srgb, ${cor} ${pct}%, transparent) ${parada}%`;
  });
  return `radial-gradient(circle at ${posicao}, ${stops.join(", ")})`;
}

export function Gradiente({ intensidade, cores, pausado }: EfeitoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ativo, reducedMotion } = useEfeitoAtivo(containerRef, pausado);

  if (intensidade === 0) return null;

  const estilo = estiloGradiente(intensidade, reducedMotion, ativo);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-[-25%] z-40 will-change-transform"
      aria-hidden="true"
      style={{
        background: [
          mancha("28% 26%", cores.destaque, PARADAS_PRIMARIA),
          mancha("72% 68%", cores.acentoTerciario, PARADAS_SECUNDARIA),
        ].join(", "),
        // `none`, sempre: com `filter`, a animação de transform abaixo
        // re-rasteriza a superfície inteira (150% da viewport) a cada
        // quadro. Ver ./estilo.ts.
        filter: estilo.filter,
        opacity: `calc(${estilo.opacity} * var(--d-efeito-fade, 1))`,
        animationName: estilo.animationName,
        animationDuration: "26s",
        animationTimingFunction: "ease-in-out",
        animationIterationCount: "infinite",
        animationDirection: "alternate",
        animationPlayState: estilo.animationPlayState,
      }}
    >
      <style>{`
        @keyframes d-efeito-gradiente-drift {
          from { transform: translate3d(-3%, -2%, 0) scale(1); }
          to { transform: translate3d(3%, 2%, 0) scale(1.08); }
        }
      `}</style>
    </div>
  );
}
