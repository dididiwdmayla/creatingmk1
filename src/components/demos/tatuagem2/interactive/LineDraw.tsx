"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Traço SVG que se desenha ao entrar no viewport (`pathLength`/
 * `strokeDashoffset`, fiel ao `[data-draw]`/`drawLine` do material bruto:
 * usado no rabisco de assinatura de cada artista e na linha que conecta
 * os passos do Processo). `prefers-reduced-motion` mostra o traço
 * completo direto, sem animação.
 */
export function LineDraw({
  d,
  viewBox,
  stroke,
  className = "",
  strokeWidth = 2,
  duration = 1.8,
}: {
  d: string;
  viewBox: string;
  stroke: string;
  className?: string;
  strokeWidth?: number;
  duration?: number;
}) {
  const reduzida = useReducedMotion();

  return (
    <svg viewBox={viewBox} className={className} aria-hidden="true">
      <motion.path
        d={d}
        pathLength={1}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={1}
        initial={reduzida ? { strokeDashoffset: 0 } : { strokeDashoffset: 1 }}
        whileInView={{ strokeDashoffset: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={reduzida ? { duration: 0 } : { duration, ease: [0.6, 0, 0.3, 1] }}
      />
    </svg>
  );
}
