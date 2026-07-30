"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import type { Animacao } from "@/lib/demos/types";

/**
 * Entrada de seção por scroll, intensidade conforme `theme.animacao` e
 * direção conforme o override por seção (`DemoSecao.animacaoEntrada`).
 * Idêntico ao SectionReveal das outras skins (mesmo componente, mesmo
 * contrato) — ver src/components/demos/barbearia/interactive/SectionReveal.tsx
 * para a explicação completa do porquê de `viewport.amount: "some"`.
 */
export type RevealTipo = "padrao" | "fade" | "esquerda" | "direita";

const PRESETS: Record<"sutil" | "marcante", { dist: number; duration: number }> = {
  sutil: { dist: 20, duration: 0.5 },
  marcante: { dist: 56, duration: 0.8 },
};

export function SectionReveal({
  animacao,
  tipo = "padrao",
  className,
  children,
}: {
  animacao: Animacao;
  tipo?: RevealTipo;
  /** Repassado ao wrapper (motion.div OU o `<div>` liso do fallback) —
   * necessário quando o wrapper É o item de grid (ex.: card do bento de
   * imóveis, que carrega `lg:col-span-*`): sem isso, o span cairia no
   * FILHO em vez do item de grid de verdade. */
  className?: string;
  children: ReactNode;
}) {
  const reduzida = useReducedMotion();

  if (animacao === "nenhuma" || reduzida || !children) {
    return className ? <div className={className}>{children}</div> : <>{children}</>;
  }

  const preset = PRESETS[animacao];
  const inicial =
    tipo === "fade"
      ? { opacity: 0 }
      : tipo === "esquerda"
        ? { opacity: 0, x: -preset.dist }
        : tipo === "direita"
          ? { opacity: 0, x: preset.dist }
          : { opacity: 0, y: preset.dist };
  const final =
    tipo === "fade" ? { opacity: 1 } : tipo === "padrao" ? { opacity: 1, y: 0 } : { opacity: 1, x: 0 };

  return (
    <motion.div
      className={className}
      initial={inicial}
      whileInView={final}
      viewport={{ once: true, amount: "some" }}
      transition={{ duration: preset.duration, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
