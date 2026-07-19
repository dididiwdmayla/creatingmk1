"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

/**
 * Elemento decorativo flutuante entre seções, fiel ao `<DecorativeElement>`
 * do original (tomate/queijo/bacon caindo pela borda, com parallax sutil
 * no scroll). Sem fotos do material bruto: a forma é um blob de contorno
 * simples na cor de acento do tema (procedural, sem asset — cores vêm de
 * `theme`, não hardcoded).
 */
export function DecorativeBlob({
  side,
  rotate = 8,
  size = 200,
  cor,
}: {
  side: "left" | "right";
  rotate?: number;
  size?: number;
  cor: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [24, -24]);
  const sideClass = side === "right" ? "right-0 translate-x-1/3" : "left-0 -translate-x-1/3";

  // Ancorado à BORDA INFERIOR da seção (fora do fluxo, -z-10 pra ficar
  // sempre atrás do conteúdo) — mesma ideia do spacer fino entre seções
  // do original, sem precisar de um wrapper dedicado que quebraria ao
  // reordenar seções no editor.
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute -z-10 bottom-0 translate-y-1/2 select-none ${sideClass}`}
      style={{ width: `clamp(70px, 14vw, ${size}px)`, height: `clamp(70px, 14vw, ${size}px)` }}
    >
      <motion.svg
        style={{ y, rotate, filter: "drop-shadow(8px 8px 0px var(--d-bg))" }}
        className="h-full w-full motion-reduce:transform-none"
        viewBox="0 0 200 200"
        fill="none"
      >
        <path
          d="M100 14c40 0 74 20 82 54 7 30-8 60-40 76-30 15-68 14-92-8-22-20-28-56-12-84 14-26 40-38 62-38Z"
          fill={cor}
          fillOpacity={0.5}
          stroke="var(--d-bg)"
          strokeWidth={6}
        />
      </motion.svg>
    </div>
  );
}
