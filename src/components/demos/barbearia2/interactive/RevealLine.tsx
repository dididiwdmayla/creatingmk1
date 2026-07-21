"use client";

import { motion, useReducedMotion } from "motion/react";

import type { Animacao } from "@/lib/demos/types";

/**
 * Linha divisória que "abre" da esquerda pra direita (scaleX 0 → 1) — o
 * `data-reveal="line"` do material bruto, usado antes da etiqueta de toda
 * seção não-fixa. Easing distinto do resto das entradas (`cubic-bezier(
 * 0.83, 0, 0.17, 1)`, fiel ao original), duração escala com
 * `theme.animacao`. `delay` em segundos, opcional (hero usa pra encaixar no
 * mesmo timing do stagger de abertura).
 */
const DURACAO: Record<"sutil" | "marcante", number> = { sutil: 0.7, marcante: 1.2 };

export function RevealLine({
  animacao,
  delay = 0,
  className,
}: {
  animacao: Animacao;
  delay?: number;
  className?: string;
}) {
  const reduzida = useReducedMotion();

  if (animacao === "nenhuma" || reduzida) {
    return <div className={className} style={{ transform: "scaleX(1)" }} aria-hidden="true" />;
  }

  return (
    <motion.div
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: DURACAO[animacao], delay, ease: [0.83, 0, 0.17, 1] }}
      style={{ transformOrigin: "left" }}
      className={className}
      aria-hidden="true"
    />
  );
}
