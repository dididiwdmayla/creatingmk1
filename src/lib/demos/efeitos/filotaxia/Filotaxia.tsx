"use client";

import { useMemo, useRef } from "react";

import type { EfeitoProps } from "../types";
import { useEfeitoAtivo } from "../useEfeitoAtivo";
import { pontosFilotaxia } from "./estilo";

/**
 * Pontos crescendo do centro pra fora pelo ângulo dourado (ver
 * ./estilo.ts#pontosFilotaxia), cada um com opacidade fixa (o decaimento
 * por idade já está no cálculo — não precisa de animação pra existir).
 * Por cima disso, um "brotar" bem sutil (só `transform: scale`, nunca
 * `filter`/`opacity` reanimados — a opacidade de base já carrega o
 * decaimento) com atraso escalonado por índice: CSS puro, sem loop de JS.
 */
export function Filotaxia({ intensidade, cores, pausado }: EfeitoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ativo, reducedMotion } = useEfeitoAtivo(containerRef, pausado);

  const pontos = useMemo(() => (intensidade === 0 ? [] : pontosFilotaxia(intensidade)), [intensidade]);

  if (intensidade === 0) return null;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
      aria-hidden="true"
    >
      <style>{`
        @keyframes d-efeito-filotaxia-brota {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `}</style>
      {pontos.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full will-change-transform"
          style={{
            left: `${p.xPercent}%`,
            top: `${p.yPercent}%`,
            width: p.raioPx * 2,
            height: p.raioPx * 2,
            marginLeft: -p.raioPx,
            marginTop: -p.raioPx,
            background: cores.destaque,
            opacity: p.opacidade,
            animationName: reducedMotion ? "none" : "d-efeito-filotaxia-brota",
            animationDuration: "3.6s",
            animationDelay: `${p.atrasoSegundos}s`,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
            animationPlayState: ativo ? "running" : "paused",
          }}
        />
      ))}
    </div>
  );
}
