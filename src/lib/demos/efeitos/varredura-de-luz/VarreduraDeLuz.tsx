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
      style={{ opacity: "var(--d-efeito-fade, 1)" }}
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
          // Perfil ASSIMÉTRICO na largura: núcleo estreito fora do centro,
          // com uma cauda longa atrás. Uma rampa simétrica de três stops
          // (transparent → brilho → transparent) lê como uma barra de luz
          // com meio marcado; um feixe de verdade tem frente mais dura que
          // rastro.
          background: `linear-gradient(90deg, transparent 0%, color-mix(in srgb, ${brilho} 22%, transparent) 24%, color-mix(in srgb, ${brilho} 70%, transparent) 52%, ${brilho} 62%, color-mix(in srgb, ${brilho} 40%, transparent) 74%, transparent 100%)`,
          // Máscara no COMPRIMENTO: sem ela, o feixe (160% de altura,
          // inclinado 18°) entra e sai da viewport com as duas pontas
          // retas cruzando a tela.
          maskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.85) 26%, rgba(0,0,0,1) 46%, rgba(0,0,0,0.6) 72%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.85) 26%, rgba(0,0,0,1) 46%, rgba(0,0,0,0.6) 72%, transparent 100%)",
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
