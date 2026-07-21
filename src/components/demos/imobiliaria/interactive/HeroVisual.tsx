"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import type { Animacao } from "@/lib/demos/types";

/**
 * Visual do hero fiel ao material bruto: a imagem principal com um leve
 * parallax vertical no scroll (`translateY(min(90px, scrollY * 0.07))`,
 * escrito direto no DOM por rAF — mesmo padrão de custo de LedEdges.tsx,
 * sem re-render React por frame) e o selo circular giratório com o nome
 * do negócio orbitando em SVG `textPath` (fiel ao "VIVENDA • IMÓVEIS COM
 * ALMA •" do original, aqui com `nome`/`slogan` vindos de `data`). O blob
 * decorativo atrás é CSS puro, sem dado do lead.
 */
export function HeroVisual({
  nome,
  slogan,
  imageSrc,
  animacao,
}: {
  nome: string;
  slogan?: string;
  imageSrc: string;
  animacao: Animacao;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (animacao === "nenhuma") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = Math.min(90, window.scrollY * 0.07);
        el.style.transform = `translateY(${y}px)`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [animacao]);

  const textoOrbita = `${nome.toUpperCase()} • ${(slogan ?? "").toUpperCase()} `;

  return (
    <div className="relative">
      <div ref={ref} className="will-change-transform">
        <div
          className="relative w-full overflow-hidden bg-[var(--d-bg-elev)]"
          style={{ aspectRatio: "4 / 5", borderRadius: "58% 42% 55% 45% / 46% 55% 45% 54%" }}
        >
          <Image
            src={imageSrc}
            alt={`Fachada em destaque de ${nome}`}
            fill
            unoptimized
            data-demo-slot="imagens.hero"
            className="object-cover"
            sizes="(max-width: 920px) 100vw, 45vw"
            priority
          />
        </div>

        <div
          className="d-badge-spin pointer-events-none absolute -left-11 -top-9 h-[150px] w-[150px]"
          style={{ filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.18))" }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <circle cx="50" cy="50" r="50" fill="var(--d-accent-3)" />
            <defs>
              <path id="imob-badge-circ" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" />
            </defs>
            <text
              style={{
                fontFamily: "var(--d-corpo)",
                fontWeight: 700,
                fontSize: "8.1px",
                letterSpacing: "2px",
                fill: "var(--d-text)",
              }}
            >
              <textPath href="#imob-badge-circ">{textoOrbita}</textPath>
            </text>
            <circle cx="50" cy="50" r="5" fill="var(--d-accent)" />
          </svg>
        </div>

        <div
          className="absolute -bottom-[18px] -right-[14px] -z-10 h-24 w-24 bg-[var(--d-accent-2)]"
          style={{ borderRadius: "62% 38% 50% 50% / 50% 60% 40% 50%" }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
