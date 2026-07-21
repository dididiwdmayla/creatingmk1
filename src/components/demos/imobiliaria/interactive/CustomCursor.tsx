"use client";

import { useEffect, useRef } from "react";

/**
 * Cursor customizado fiel ao material bruto: um ponto sólido que segue o
 * mouse (posicionamento DIRETO, sem spring — o original só usa
 * `transition: scale .35s, opacity .3s` no próprio elemento, o
 * deslocamento em si é imediato) e cresce/perde opacidade ao passar sobre
 * um card de imóvel (`[data-cursor-alvo]`). Some em touch devices, sem
 * hover, e com prefers-reduced-motion — mesmo critério das demais skins.
 */
export function CustomCursor({ accent }: { accent: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const el = ref.current;
    if (!el) return;

    const t = setTimeout(() => {
      el.style.opacity = "0.85";
    }, 0);

    const onMove = (e: MouseEvent) => {
      el.style.transform = `translate(${e.clientX - 7}px, ${e.clientY - 7}px)`;
      const overCard = (e.target as HTMLElement).closest?.("[data-cursor-alvo]");
      el.style.scale = overCard ? "3.2" : "1";
      el.style.opacity = overCard ? "0.45" : "0.85";
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[9999] hidden h-3.5 w-3.5 rounded-full opacity-0 transition-[scale,opacity] duration-300 ease-[cubic-bezier(0.22,0.61,0.21,1)] md:block"
      style={{ backgroundColor: accent, transform: "translate(-100px, -100px)" }}
    />
  );
}
