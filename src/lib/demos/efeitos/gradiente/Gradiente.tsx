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
        // Cada mancha cai em VÁRIOS stops, não num salto direto pra
        // `transparent`: uma rampa de dois pontos tem inclinação constante,
        // e o olho pega o fim dela como se fosse um contorno — mesmo com
        // 80px de blur por cima. Os dois raios também diferem, pra que as
        // manchas não leiam como dois círculos gêmeos.
        background: [
          `radial-gradient(circle at 28% 26%, ${cores.destaque} 0%, color-mix(in srgb, ${cores.destaque} 55%, transparent) 16%, color-mix(in srgb, ${cores.destaque} 18%, transparent) 32%, transparent 52%)`,
          `radial-gradient(circle at 72% 68%, ${cores.acentoTerciario} 0%, color-mix(in srgb, ${cores.acentoTerciario} 50%, transparent) 14%, color-mix(in srgb, ${cores.acentoTerciario} 16%, transparent) 30%, transparent 46%)`,
        ].join(", "),
        filter: estilo.filter,
        opacity: estilo.opacity,
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
