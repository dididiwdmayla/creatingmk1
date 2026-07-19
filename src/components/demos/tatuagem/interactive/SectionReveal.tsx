"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import type { Animacao } from "@/lib/demos/types";

/**
 * Entrada de seção por scroll, intensidade conforme `theme.animacao` e
 * direção conforme o override por seção (`DemoSecao.animacaoEntrada`):
 *
 *   - "padrao" — fade + slide de baixo (comportamento default do
 *     template para a maioria das seções);
 *   - "fade" — só opacidade, sem transform;
 *   - "esquerda"/"direita" — fade + slide lateral.
 *
 * "nenhuma" global e prefers-reduced-motion pulam o wrapper por completo
 * — sem custo, sem elemento extra no DOM (ver Skin.tsx: "statement" e
 * "marquee" já nascem sem wrapper, fiéis ao material bruto estático).
 */
export type RevealTipo = "padrao" | "fade" | "esquerda" | "direita";

const PRESETS: Record<"sutil" | "marcante", { dist: number; duration: number }> = {
  sutil: { dist: 20, duration: 0.5 },
  marcante: { dist: 48, duration: 0.75 },
};

export function SectionReveal({
  animacao,
  tipo = "padrao",
  children,
}: {
  animacao: Animacao;
  tipo?: RevealTipo;
  children: ReactNode;
}) {
  const reduzida = useReducedMotion();

  if (animacao === "nenhuma" || reduzida || !children) {
    return <>{children}</>;
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
      initial={inicial}
      whileInView={final}
      // "some" (qualquer parte visível), não uma fração fixa: o wrapper
      // envolve a SEÇÃO INTEIRA, e seções com lista de tamanho livre (ex.:
      // portfólio, até 30 itens — ver validate.ts) podem ficar muito mais
      // altas que a viewport, sobretudo no masonry de 1 coluna do celular.
      // Uma fração como 0.2 exige que 20% da área TOTAL do elemento
      // intersecte a viewport — matematicamente inatingível quando a seção
      // passa de ~5x a altura da viewport, deixando a seção (e as imagens
      // dentro dela) presa em opacity:0 para sempre.
      viewport={{ once: true, amount: "some" }}
      transition={{ duration: preset.duration, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
