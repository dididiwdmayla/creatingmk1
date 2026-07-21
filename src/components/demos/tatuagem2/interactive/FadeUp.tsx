"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import type { Animacao } from "@/lib/demos/types";

/**
 * Entrada por scroll fiel ao `<FadeUp>` do material bruto: fade + slide de
 * baixo, `whileInView` uma vez, easing quase idêntico ao original
 * ([0.21, 0.47, 0.32, 0.98]). A intensidade (distância/duração) escala com
 * `theme.animacao`, igual ao SectionReveal da barbearia — em "nenhuma" (ou
 * prefers-reduced-motion) não monta wrapper nenhum: sem custo, sem
 * elemento extra no DOM.
 *
 * Usado tanto para envolver seções inteiras quanto, com `delay`, para o
 * stagger granular item a item que o original faz em quase todo bloco de
 * texto (tags, parágrafos, itens do grid do portfólio, passos do
 * processo).
 */
const PRESETS: Record<"sutil" | "marcante", { dist: number; duration: number }> = {
  sutil: { dist: 12, duration: 0.4 },
  marcante: { dist: 24, duration: 0.65 },
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
      transition={{ duration, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
