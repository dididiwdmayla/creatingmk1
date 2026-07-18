"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import type { Animacao } from "@/lib/demos/types";

/**
 * Entrada de seção por scroll, intensidade conforme `theme.animacao`.
 * NÃO use este wrapper em volta de uma seção que tenha `position: sticky`
 * no seu interior (a sidebar da seção Serviços, por ex.): mesmo depois de
 * assentar em `y: 0`, o `transform: translateY(0px)` residual do motion
 * cria um containing block que quebra o sticky — a seção Serviços é
 * renderizada sem este wrapper em Skin.tsx por isso. "nenhuma" e
 * prefers-reduced-motion pulam o wrapper por completo — sem custo, sem
 * elemento extra no DOM.
 */
const PRESETS: Record<"sutil" | "marcante", { y: number; duration: number }> = {
  sutil: { y: 20, duration: 0.5 },
  marcante: { y: 56, duration: 0.8 },
};

export function SectionReveal({
  animacao,
  children,
}: {
  animacao: Animacao;
  children: ReactNode;
}) {
  const reduzida = useReducedMotion();

  if (animacao === "nenhuma" || reduzida || !children) {
    return <>{children}</>;
  }

  const preset = PRESETS[animacao];
  return (
    <motion.div
      initial={{ opacity: 0, y: preset.y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: preset.duration, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
