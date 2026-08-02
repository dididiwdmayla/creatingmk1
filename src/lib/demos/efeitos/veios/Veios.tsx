"use client";

import { useMemo, useRef } from "react";

import type { EfeitoProps } from "../types";
import { useEfeitoAtivo } from "../useEfeitoAtivo";
import { opacidadeBase, opacidadePulso, veiosTracos } from "./geometria";

/**
 * Traços orgânicos (curvas quadráticas, ver ./geometria.ts) com um pulso
 * curto viajando por cima de cada um: mesmo `d`, uma segunda cópia do path
 * com `pathLength={1}` (normaliza a unidade de dasharray/dashoffset pra
 * não precisar calcular o comprimento real de cada curva) e
 * `stroke-dasharray` bem menor que o total — só esse trecho fica visível,
 * e animar `stroke-dashoffset` de 1 a -1 o desloca pelo traço inteiro em
 * loop. Sem rAF/JS nenhum, só CSS (`@keyframes`). As pontas de todo traço
 * são mascaradas por um gradiente radial centrado na viewport
 * (`mask-image`, CSS puro) — os traços nascem espalhados e se estendem em
 * direção às bordas, então a máscara desbota exatamente onde eles
 * terminam, sem precisar de uma máscara por traço.
 */
export function Veios({ intensidade, cores, pausado }: EfeitoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ativo, reducedMotion } = useEfeitoAtivo(containerRef, pausado);

  const tracos = useMemo(() => (intensidade === 0 ? [] : veiosTracos(intensidade)), [intensidade]);

  if (intensidade === 0) return null;

  const mask = "radial-gradient(circle at 50% 50%, black 55%, transparent 88%)";

  return (
    <div
      ref={containerRef}
      // fixed + z-index positivo: mesma convenção dos demais efeitos (ver
      // ARCHITECTURE.md, "Cobertura de viewport" / bug histórico do
      // z-index negativo).
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        <style>{`
          @keyframes d-efeito-veios-pulso {
            from { stroke-dashoffset: 1; }
            to { stroke-dashoffset: -1; }
          }
        `}</style>
        <g fill="none">
          {tracos.map((traco, i) => (
            <g key={i}>
              <path
                d={traco.d}
                stroke={cores.destaque}
                strokeWidth={0.35}
                strokeLinecap="round"
                opacity={opacidadeBase(intensidade)}
              />
              {!reducedMotion && (
                <path
                  d={traco.d}
                  pathLength={1}
                  stroke={cores.destaque}
                  strokeWidth={0.6}
                  strokeLinecap="round"
                  strokeDasharray="0.08 1"
                  opacity={opacidadePulso(intensidade)}
                  style={{
                    animationName: "d-efeito-veios-pulso",
                    animationDuration: `${traco.duracaoSegundos}s`,
                    animationDelay: `${traco.atrasoSegundos}s`,
                    animationTimingFunction: "linear",
                    animationIterationCount: "infinite",
                    animationPlayState: ativo ? "running" : "paused",
                  }}
                />
              )}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
