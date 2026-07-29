"use client";

import { useEffect, useRef, type ReactNode } from "react";

import type { Animacao } from "@/lib/demos/types";

/**
 * Parallax sutil da imagem do hero no scroll — fiel ao original
 * (`translateY(Math.min(90, scrollY * 0.07))`, sem lib, throttled por
 * rAF). O material bruto só liga isso quando `animacoes` está ativo
 * (`if (anim && this._hero)`), então aqui também gateamos por
 * `Theme.animacao !== "nenhuma"` — igual ao CustomCursor.tsx.
 */
export function ParallaxHero({
  animacao,
  children,
}: {
  animacao: Animacao;
  children: ReactNode;
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

  return (
    <div ref={ref} className="will-change-transform">
      {children}
    </div>
  );
}
