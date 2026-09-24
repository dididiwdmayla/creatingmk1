"use client";

import { useEffect, useRef, type ReactNode } from "react";

import type { Animacao } from "@/lib/demos/types";

/**
 * Entrada por scroll fiel ao `<FadeUp>` do material bruto: fade + slide de
 * baixo, uma vez, granular (usado tanto pra envolver blocos inteiros quanto,
 * com `delay`, pro stagger item a item que o original faz em quase todo
 * bloco de texto — tags, parágrafos, itens do grid do portfólio, passos do
 * processo). A intensidade (distância/duração) escala com `theme.animacao`;
 * em "nenhuma" (ou prefers-reduced-motion) não monta wrapper nenhum.
 *
 * **O HTML servido é sempre visível** (item 4 da sessão de fundação — mesmo
 * desenho do `SectionReveal` ao lado): a versão anterior usava
 * `motion.div` com `initial={{opacity:0, y}}`, que saía no documento do
 * servidor com rótulo/texto/CTA do hero (e todo item com stagger)
 * transparentes — inclusive ACIMA da dobra, onde nem chega a haver scroll
 * para disparar a revelação. Aqui a entrada só é ARMADA no cliente, e só
 * para o que está fora da tela na montagem.
 */
const PRESETS: Record<"sutil" | "marcante", { dist: number; duration: number }> = {
  sutil: { dist: 12, duration: 400 },
  marcante: { dist: 24, duration: 650 },
};

export function FadeUp({
  animacao,
  delay = 0,
  className,
  children,
}: {
  animacao: Animacao;
  /** Atraso da entrada, em SEGUNDOS (mesma unidade da API anterior). */
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || animacao === "nenhuma" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < innerHeight) return;
    const { dist, duration } = PRESETS[animacao];
    el.style.opacity = "0";
    let animation: Animation | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.style.opacity = "";
        animation = el.animate(
          [
            { opacity: 0, transform: `translateY(${dist}px)` },
            { opacity: 1, transform: "none" },
          ],
          { duration, delay: delay * 1000, easing: "cubic-bezier(0.21,0.47,0.32,0.98)", fill: "backwards" },
        );
        observer.disconnect();
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      animation?.cancel();
      el.style.opacity = "";
    };
  }, [animacao, delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
