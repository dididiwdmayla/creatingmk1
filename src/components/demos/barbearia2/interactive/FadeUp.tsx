"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import type { Animacao } from "@/lib/demos/types";

/**
 * Entrada por scroll fiel ao `data-reveal` do material bruto: fade + slide
 * de baixo, `whileInView` uma vez, easing idêntico ao original
 * (`cubic-bezier(0.22, 1, 0.36, 1)`, usado ali em toda transição de
 * revelação). A intensidade (distância/duração) escala com `theme.animacao`,
 * igual ao SectionReveal — em "nenhuma" (ou prefers-reduced-motion) não
 * monta wrapper nenhum: sem custo, sem elemento extra no DOM.
 *
 * Usado para o stagger granular item a item que o original faz nos blocos
 * de texto (as duas linhas do Manifesto, os três pilares do Ritual) via
 * `data-delay="0ms"/"80ms"/"160ms"`.
 */
const PRESETS: Record<"sutil" | "marcante", { dist: number; duration: number }> = {
  sutil: { dist: 12, duration: 0.4 },
  marcante: { dist: 20, duration: 0.6 },
};

export function FadeUp({
  animacao,
  delay = 0,
  className,
  children,
}: {
  animacao: Animacao;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const reduzida = useReducedMotion();

  if (animacao === "nenhuma" || reduzida) {
    return <div className={className}>{children}</div>;
  }

  const { dist, duration } = PRESETS[animacao];

  return (
    <motion.div
      initial={{ opacity: 0, y: dist }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
