"use client";

import { useMemo, useRef, type CSSProperties } from "react";

import type { EfeitoProps } from "../types";
import { useEfeitoAtivo } from "../useEfeitoAtivo";
import { faiscas as gerarFaiscas, opacidadeContainer } from "./estilo";

/**
 * Faíscas: reaproveita o motor de partículas (ver ./estilo.ts) com
 * gravidade (deriva horizontal + queda, `transform` só — nunca `filter`),
 * vida curta (frações de segundo, contra os 14-23s de "partículas") e
 * blend aditivo (`mix-blend-mode: screen`, mesma técnica do blob da Aura —
 * soma luz, nunca escurece por cima do conteúdo).
 */
export function Faiscas({ intensidade, cores, pausado }: EfeitoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ativo, reducedMotion } = useEfeitoAtivo(containerRef, pausado);

  const pontos = useMemo(() => (intensidade === 0 ? [] : gerarFaiscas(intensidade)), [intensidade]);

  if (intensidade === 0) return null;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
      aria-hidden="true"
      style={{ opacity: opacidadeContainer(intensidade), mixBlendMode: "screen" }}
    >
      <style>{`
        @keyframes d-efeito-faiscas-queda {
          0% { transform: translate3d(0, 0, 0) scale(1); opacity: 0; }
          12% { opacity: 1; }
          35% { transform: translate3d(var(--d-faisca-dx), -14px, 0) scale(1); }
          100% { transform: translate3d(calc(var(--d-faisca-dx) * 2), 46px, 0) scale(0.3); opacity: 0; }
        }
      `}</style>
      {pontos.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.tamanhoPx,
            height: p.tamanhoPx,
            // Brasa, não disquinho: núcleo claro, queda radial até
            // transparente. Uma cor chapada num `rounded-full` termina em
            // borda — foi o que a captura mostrou, um campo de pontinhos
            // recortados em vez de faíscas.
            background: `radial-gradient(circle, color-mix(in srgb, ${cores.destaque} 60%, white) 0%, ${cores.destaque} ${p.nucleoPercent}%, transparent 70%)`,
            // reduced motion: sem @keyframes rodando, mantém uma brasa parada e discreta em vez de sumir.
            opacity: reducedMotion ? 0.35 : 0,
            "--d-faisca-dx": `${p.derivaXPx}px`,
            animationName: reducedMotion ? "none" : "d-efeito-faiscas-queda",
            animationDuration: `${p.duracaoSegundos}s`,
            animationDelay: `${p.atrasoSegundos}s`,
            animationTimingFunction: "ease-in",
            animationIterationCount: "infinite",
            animationPlayState: ativo ? "running" : "paused",
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
