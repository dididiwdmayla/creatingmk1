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
        background: `radial-gradient(circle at 30% 30%, ${cores.destaque} 0%, transparent 40%), radial-gradient(circle at 70% 65%, ${cores.acentoTerciario} 0%, transparent 38%)`,
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
