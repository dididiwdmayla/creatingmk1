"use client";

import { useRef } from "react";

/**
 * Faixa de marcas em loop infinito (CSS `animation`, sem JS de posição) —
 * pausa no hover/touch, fiel ao `setupMarquee` do material bruto. A lista
 * (nomes de marca) é conteúdo real (`secoes.avaliacao.itens`) duplicada UMA
 * vez aqui só pra fechar o loop visual sem costura.
 */
export function Marquee({ marcas }: { marcas: string[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  if (marcas.length === 0) return null;

  const pausar = () => {
    if (trackRef.current) trackRef.current.style.animationPlayState = "paused";
  };
  const retomar = () => {
    if (trackRef.current) trackRef.current.style.animationPlayState = "running";
  };

  const grupo = (chave: string) => (
    <div
      key={chave}
      className="flex items-center gap-11 whitespace-nowrap pr-11 font-[family-name:var(--d-mono)] text-2xl font-semibold tracking-[3px] text-[var(--d-text)]"
    >
      {marcas.map((marca, i) => (
        <span key={`${chave}-${marca}-${i}`} className="flex items-center gap-11">
          {marca.toUpperCase()}
          <span className="text-sm text-[var(--d-accent)]" aria-hidden="true">
            ◆
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div
      className="overflow-hidden border-t-2 py-[18px] text-[var(--d-text)]"
      style={{
        marginTop: "clamp(44px, 6vw, 70px)",
        background: "var(--d-bg-alt)",
        borderTopColor: "var(--d-text)",
      }}
      onMouseEnter={pausar}
      onMouseLeave={retomar}
      onTouchStart={pausar}
      onTouchEnd={retomar}
    >
      <div ref={trackRef} className="d-marquee-track flex w-max">
        {grupo("a")}
        {grupo("b")}
      </div>
    </div>
  );
}
