"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import type { Animacao } from "@/lib/demos/types";

/**
 * Entrada de seção por scroll, intensidade conforme `theme.animacao` e
 * direção conforme o override por seção (`DemoSecao.animacaoEntrada`):
 *
 *   - "padrao" — fade + slide de baixo (comportamento original da skin);
 *   - "fade" — só opacidade, SEM transform (seguro para seções com
 *     `position: sticky` interno, como a sidebar de Serviços);
 *   - "esquerda"/"direita" — fade + slide lateral (entra vindo do lado).
 *
 * NÃO use os tipos com transform em volta de uma seção que tenha sticky
 * no interior: mesmo depois de assentar, o `transform: translate(0)`
 * residual do motion cria um containing block que quebra o sticky — por
 * isso o contrato da skin (secoes.ts, `entradaOptions`) só oferece
 * "fade"/"typewriter" para a seção Serviços. "nenhuma" global e
 * prefers-reduced-motion pulam o wrapper por completo — sem custo, sem
 * elemento extra no DOM.
 */
export type RevealTipo = "padrao" | "fade" | "esquerda" | "direita";

const PRESETS: Record<"sutil" | "marcante", { dist: number; duration: number }> = {
  sutil: { dist: 20, duration: 0.5 },
  marcante: { dist: 56, duration: 0.8 },
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
      // envolve a SEÇÃO INTEIRA, e seções com lista de tamanho livre podem
      // ficar muito mais altas que a viewport — uma fração como 0.2 exige
      // 20% da área TOTAL do elemento na viewport, inatingível quando a
      // seção passa de ~5x a altura da viewport (mesmo bug corrigido na
      // seção Portfólio da skin de tatuagem — ver SectionReveal de lá).
      viewport={{ once: true, amount: "some" }}
      transition={{ duration: preset.duration, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
