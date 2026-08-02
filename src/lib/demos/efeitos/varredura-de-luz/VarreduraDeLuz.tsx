"use client";

import { useRef } from "react";

import type { EfeitoProps } from "../types";
import { useEfeitoAtivo } from "../useEfeitoAtivo";
import { estiloVarredura } from "./estilo";

/**
 * Brilho diagonal atravessando a parte de cima da viewport (onde o título
 * hero normalmente está) periodicamente. Cor: branco misturado com
 * `cores.destaque` (`color-mix`, nunca uma cor fixa) somado por cima via
 * `mix-blend-mode: screen` — só ADICIONA luz, nunca escurece nem inverte
 * matiz, por isso lê igualmente bem sobre um destaque dourado (quente) ou
 * cromado/prateado (frio): o brilho em si é neutro, a cor de baixo só
 * "brilha" através dele. `transform: translateX` é a única propriedade
 * animada (nunca `filter`).
 */
export function VarreduraDeLuz({ intensidade, cores, pausado }: EfeitoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ativo, reducedMotion } = useEfeitoAtivo(containerRef, pausado);

  if (intensidade === 0) return null;

  const estilo = estiloVarredura(intensidade, reducedMotion, ativo);
  const brilho = `color-mix(in srgb, ${cores.destaque} 45%, white)`;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
      aria-hidden="true"
    >
      <style>{`
        @keyframes d-efeito-varredura-sweep {
          0%   { transform: rotate(18deg) translateX(0%); }
          14%  { transform: rotate(18deg) translateX(340vw); }
          100% { transform: rotate(18deg) translateX(340vw); }
        }
      `}</style>
      <div
        className="absolute -left-[60%] -top-[30%] h-[160%] will-change-transform"
        style={{
          width: `${estilo.larguraPercent}%`,
          background: `linear-gradient(90deg, transparent 0%, ${brilho} 50%, transparent 100%)`,
          opacity: reducedMotion ? estilo.opacidade * 0.5 : estilo.opacidade,
          mixBlendMode: "screen",
          // reduced motion: sem @keyframes, congela a meio caminho da passada — ainda visível, não só fora da tela.
          transform: reducedMotion ? "rotate(18deg) translateX(150vw)" : undefined,
          animationName: estilo.animationName,
          animationDuration: `${estilo.duracaoSegundos}s`,
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
          animationPlayState: estilo.animationPlayState,
        }}
      />
    </div>
  );
}
