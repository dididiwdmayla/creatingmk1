"use client";

import { useEffect, useRef } from "react";

import type { Animacao } from "@/lib/demos/types";

/**
 * Cursor customizado — ponto sólido na cor de destaque que cresce (escala
 * 3.2x) e fica mais translúcido sobre um card de imóvel (`[data-card]`).
 * Fiel ao material bruto: segue o mouse DIRETO (sem spring/atraso — só a
 * escala/opacidade têm transição CSS), e só existe quando `animacoes`
 * está ligado (`Theme.animacao !== "nenhuma"`, o mesmo `anim` que guarda o
 * bloco no original) e o ponteiro é fino (mouse). Escrita direta no DOM
 * via ref (sem estado React por frame), mesmo padrão de LedEdges.tsx.
 */
export function CustomCursor({ animacao }: { animacao: Animacao }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (animacao === "nenhuma") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const el = ref.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      el.style.transform = `translate(${e.clientX - 7}px, ${e.clientY - 7}px)`;
      const overCard = (e.target as HTMLElement | null)?.closest?.("[data-card]");
      el.style.scale = overCard ? "3.2" : "1";
      el.style.opacity = overCard ? "0.45" : "0.85";
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [animacao]);

  if (animacao === "nenhuma") return null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[9999] hidden h-[14px] w-[14px] rounded-full opacity-0 md:block motion-reduce:hidden"
      style={{
        backgroundColor: "var(--d-accent)",
        transform: "translate(-100px, -100px)",
        transition: "scale 0.35s cubic-bezier(0.22, 0.61, 0.21, 1), opacity 0.3s",
      }}
    />
  );
}
