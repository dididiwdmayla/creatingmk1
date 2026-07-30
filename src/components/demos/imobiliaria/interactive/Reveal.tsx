"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import type { Animacao } from "@/lib/demos/types";

/**
 * Reveal por scroll fiel ao `data-reveal` do material bruto: fade +
 * `translateY(26px)`, 900ms, `cubic-bezier(.22,.61,.21,1)`, com atraso
 * (`data-delay`) em ms para o stagger do hero. Diferente de
 * `SectionReveal.tsx` (que embrulha SEÇÕES inteiras e respeita o override
 * `DemoSecao.animacaoEntrada` da skin): este componente é para o stagger
 * FINO de elementos pequenos dentro de uma seção (olho-eyebrow, título,
 * parágrafo, botões do hero…), sem opção de direção — o original também
 * só tinha um tipo de reveal (fade+sobe), nunca esquerda/direita.
 */
export function Reveal({
  animacao,
  atraso = 0,
  children,
  className,
}: {
  animacao: Animacao;
  atraso?: number;
  children: ReactNode;
  className?: string;
}) {
  const reduzida = useReducedMotion();

  if (animacao === "nenhuma" || reduzida) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: "some" }}
      transition={{ duration: 0.9, delay: atraso / 1000, ease: [0.22, 0.61, 0.21, 1] }}
    >
      {children}
    </motion.div>
  );
}
