"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Rastreia qual seção está em foco no viewport e escreve a cor dela em
 * `--d-pigment` num wrapper — fiel ao `secIO`/`data-pigment` do material
 * bruto (o ponto ao lado do logo e o cursor customizado mudam de cor
 * conforme a seção). Cada seção marca sua cor via `data-pigment="<cor>"`
 * (ver Skin.tsx); a cor vem sempre de `theme.paleta`, nunca hardcoded.
 * Direto no DOM (sem estado React por interseção) — mesmo padrão de
 * LedEdges.tsx.
 */
export function PigmentTracker({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const alvos = Array.from(root.querySelectorAll<HTMLElement>("[data-pigment]"));
    if (alvos.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cor = entry.target.getAttribute("data-pigment");
            if (cor) root.style.setProperty("--d-pigment", cor);
          }
        });
      },
      { threshold: 0.5 },
    );
    alvos.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
