"use client";

import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties, ElementType, ReactNode } from "react";

import type { Animacao } from "@/lib/demos/types";

/**
 * Revelação por elemento fiel ao `data-reveal`/`data-delay` do material
 * bruto: cada bloco (etiqueta, título, parágrafo, CTA, card…) nasce com
 * `opacity:0; translateY(26px)` e entra sozinho ao cruzar a viewport, com
 * atraso individual (stagger) — não há wrapper de SEÇÃO inteira no
 * original, é elemento a elemento. Mesmo easing do original
 * (`cubic-bezier(.22,.61,.21,1)`), intensidade escalada por
 * `theme.animacao`; "nenhuma"/prefers-reduced-motion não montam wrapper
 * nenhum (sem custo, sem elemento extra).
 */
const PRESETS: Record<"sutil" | "marcante", { dist: number; duration: number }> = {
  sutil: { dist: 16, duration: 0.6 },
  marcante: { dist: 30, duration: 0.95 },
};

export function Reveal({
  animacao,
  delay = 0,
  as: As = "div",
  className,
  style,
  children,
}: {
  animacao: Animacao;
  /** Atraso em milissegundos, fiel ao `data-delay` do original. */
  delay?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const reduzida = useReducedMotion();

  if (animacao === "nenhuma" || reduzida) {
    const Plain = As;
    return (
      <Plain className={className} style={style}>
        {children}
      </Plain>
    );
  }

  const { dist, duration } = PRESETS[animacao];
  const MotionTag = (motion as unknown as Record<string, typeof motion.div>)[As as string] ?? motion.div;

  return (
    <MotionTag
      initial={{ opacity: 0, y: dist }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: "some" }}
      transition={{ duration, delay: delay / 1000, ease: [0.22, 0.61, 0.21, 1] }}
      className={className}
      style={style}
    >
      {children}
    </MotionTag>
  );
}
