"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

import type { Animacao } from "@/lib/demos/types";

/**
 * Parallax vertical sutil em imagens, fiel ao `<Parallax>` do material
 * bruto (useScroll + useTransform). O deslocamento escala com
 * `theme.animacao`; em "nenhuma"/prefers-reduced-motion não anima (a
 * imagem fica parada, sem custo de scroll listener).
 */
const OFFSET: Record<"sutil" | "marcante", number> = {
  sutil: 20,
  marcante: 44,
};

export function Parallax({
  animacao,
  className = "",
  children,
}: {
  animacao: Animacao;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduzida = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const offset = animacao === "nenhuma" ? 0 : OFFSET[animacao];
  const y = useTransform(scrollYProgress, [0, 1], [-offset, offset]);

  if (animacao === "nenhuma" || reduzida) {
    return (
      <div ref={ref} className={`relative overflow-hidden ${className}`}>
        {children}
      </div>
    );
  }

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.div style={{ y }} className="relative h-full w-full">
        {children}
      </motion.div>
    </div>
  );
}
