"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Animacao } from "@/lib/demos/types";

export type RevealTipo = "padrao" | "fade" | "esquerda" | "direita";

/** HTML sempre visível. Só conteúdo fora da viewport ganha entrada após hidratação.
 * IntersectionObserver usa threshold 0: seções maiores que a tela também entram.
 * O fill não persiste transform, preservando a sidebar sticky de Serviços. */
export function SectionReveal({ animacao, tipo = "padrao", children }: {
  animacao: Animacao; tipo?: RevealTipo; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || animacao === "nenhuma" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < innerHeight) return;
    const dist = animacao === "marcante" ? 56 : 20;
    const transform = tipo === "fade" ? undefined : tipo === "esquerda"
      ? `translateX(${-dist}px)` : tipo === "direita" ? `translateX(${dist}px)` : `translateY(${dist}px)`;
    el.style.opacity = "0";
    let animation: Animation | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      el.style.opacity = "";
      animation = el.animate([
        { opacity: 0, ...(transform && { transform }) },
        { opacity: 1, ...(transform && { transform: "none" }) },
      ], { duration: animacao === "marcante" ? 800 : 500, easing: "cubic-bezier(0.16,1,0.3,1)" });
      observer.disconnect();
    }, { threshold: 0 });
    observer.observe(el);
    return () => { observer.disconnect(); animation?.cancel(); el.style.opacity = ""; };
  }, [animacao, tipo]);
  return <div ref={ref}>{children}</div>;
}
