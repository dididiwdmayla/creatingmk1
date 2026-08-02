"use client";

import { useMemo, useRef } from "react";

import type { EfeitoProps } from "../types";
import { useEfeitoAtivo } from "../useEfeitoAtivo";
import { camadasGeometricoPulsante, opacidadeGeometricoPulsante } from "./estilo";

const GRADIENTE_ID = "d-efeito-geometrico-metal";

/**
 * Polígonos concêntricos (hexágonos, ver ./estilo.ts) com stroke
 * "metálico": um `linearGradient` com faixas claro/escuro alternadas
 * (banda de brilho = mistura com branco via `color-mix`, nunca uma cor
 * fixa) sobre a própria cor de destaque do tema — lê como metal
 * escovado em qualquer paleta, sem depender do matiz. Pulso (`transform:
 * scale` + `opacity`, nunca `filter`) defasado por camada via
 * `animation-delay` negativo.
 */
export function GeometricoPulsante({ intensidade, cores, pausado }: EfeitoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ativo, reducedMotion } = useEfeitoAtivo(containerRef, pausado);

  const camadas = useMemo(
    () => (intensidade === 0 ? [] : camadasGeometricoPulsante(intensidade)),
    [intensidade],
  );

  if (intensidade === 0) return null;

  const opacidade = opacidadeGeometricoPulsante(intensidade);
  const brilho = `color-mix(in srgb, ${cores.destaque} 55%, white)`;

  return (
    <div ref={containerRef} className="pointer-events-none fixed inset-0 z-40" aria-hidden="true">
      <style>{`
        @keyframes d-efeito-geometrico-pulso {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.045); opacity: 0.65; }
        }
      `}</style>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        style={{ transformBox: "view-box" } as React.CSSProperties}
      >
        <defs>
          <linearGradient id={GRADIENTE_ID} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={cores.textoSuave} />
            <stop offset="30%" stopColor={brilho} />
            <stop offset="50%" stopColor={cores.destaque} />
            <stop offset="70%" stopColor={brilho} />
            <stop offset="100%" stopColor={cores.textoSuave} />
          </linearGradient>
        </defs>
        <g fill="none" stroke={`url(#${GRADIENTE_ID})`} strokeWidth={0.4} opacity={opacidade}>
          {camadas.map((camada, i) => (
            <polygon
              key={i}
              points={camada.points}
              style={{
                transformBox: "view-box",
                transformOrigin: "50px 50px",
                animationName: reducedMotion ? "none" : "d-efeito-geometrico-pulso",
                animationDuration: "3.2s",
                animationDelay: `${camada.atrasoSegundos}s`,
                animationTimingFunction: "ease-in-out",
                animationIterationCount: "infinite",
                animationPlayState: ativo ? "running" : "paused",
              }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
