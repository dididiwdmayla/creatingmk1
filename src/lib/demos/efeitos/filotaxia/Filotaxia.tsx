"use client";

import { useMemo, useRef, type CSSProperties } from "react";

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
 *
 * Cada ponto é um gradiente RADIAL que cai a zero antes do raio acabar,
 * não um `rounded-full` de cor chapada: um círculo preenchido tem borda,
 * por menor que seja, e na captura o campo inteiro lia como poeira de
 * pontinhos recortados. Com o alfa caindo, cada ponto é um halo — e o
 * conjunto todo ainda passa por uma máscara radial, pra que a nuvem
 * termine em transparente em vez de ser cortada pela borda da viewport.
 */
export function Filotaxia({ intensidade, cores, pausado }: EfeitoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ativo, reducedMotion } = useEfeitoAtivo(containerRef, pausado);

  const pontos = useMemo(() => (intensidade === 0 ? [] : pontosFilotaxia(intensidade)), [intensidade]);

  if (intensidade === 0) return null;

  const mascara =
    "radial-gradient(closest-side circle at 50% 50%, rgba(0,0,0,1) 34%, rgba(0,0,0,0.55) 68%, transparent 100%)";

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
      aria-hidden="true"
      style={
        {
          maskImage: mascara,
          WebkitMaskImage: mascara,
          opacity: "var(--d-efeito-fade, 1)",
        } as CSSProperties
      }
    >
      <style>{`
        @keyframes d-efeito-filotaxia-brota {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.22); }
        }
      `}</style>
      {pontos.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full will-change-transform"
          style={{
            // Deslocamento em vmin a partir do centro: mantém a espiral
            // circular em qualquer proporção de tela (ver ./estilo.ts).
            left: `calc(50% + ${p.xVmin}vmin)`,
            top: `calc(50% + ${p.yVmin}vmin)`,
            width: p.raioPx * 2,
            height: p.raioPx * 2,
            background: `radial-gradient(circle, ${cores.destaque} 0%, ${cores.destaque} ${p.nucleoPercent}%, transparent 72%)`,
            opacity: p.opacidade,
            // O translate mora no @keyframes junto do scale: separá-los
            // faria o scale sobrescrever a centralização a cada frame.
            transform: "translate(-50%, -50%)",
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
