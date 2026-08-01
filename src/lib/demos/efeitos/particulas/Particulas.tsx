"use client";

import { useMemo, useRef } from "react";

import type { EfeitoProps } from "../types";
import { useEfeitoAtivo } from "../useEfeitoAtivo";
import { estiloPonto, opacidadeContainer, pontosParticulas } from "./estilo";

/**
 * Pontos subindo em loop, posições determinísticas por índice. Migrado do
 * overlay fixo por skin (`Theme.fundoEfeito` "particulas", antes CSS puro
 * em cada Skin.tsx) para o registro de efeitos: mesma técnica visual,
 * agora um componente único que só depende de `cores` e escala contagem +
 * opacidade com `intensidade`.
 */
export function Particulas({ intensidade, cores, pausado }: EfeitoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ativo, reducedMotion } = useEfeitoAtivo(containerRef, pausado);

  const pontos = useMemo(
    () => (intensidade === 0 ? [] : pontosParticulas(intensidade)),
    [intensidade],
  );

  if (intensidade === 0) return null;

  const ponto = estiloPonto(reducedMotion, ativo);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
      aria-hidden="true"
      style={{ opacity: opacidadeContainer(intensidade) }}
    >
      <style>{`
        @keyframes d-efeito-particulas-flutua {
          0% { transform: translateY(0); opacity: 0; }
          8% { opacity: 0.35; }
          85% { opacity: 0.12; }
          100% { transform: translateY(-105vh); opacity: 0; }
        }
      `}</style>
      {pontos.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            bottom: "-10px",
            width: p.grande ? 3 : 2,
            height: p.grande ? 3 : 2,
            background: cores.destaque,
            opacity: reducedMotion ? 0.12 : 0,
            animationName: ponto.animationName,
            animationDuration: `${p.duracaoSegundos}s`,
            animationDelay: `${p.atrasoSegundos}s`,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            animationPlayState: ponto.animationPlayState,
          }}
        />
      ))}
    </div>
  );
}
