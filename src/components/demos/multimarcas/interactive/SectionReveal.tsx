"use client";

import { useEffect, useRef, type ReactNode } from "react";

import type { Animacao } from "@/lib/demos/types";

/**
 * Entrada de seção por scroll, intensidade conforme `theme.animacao` e
 * direção conforme o override por seção (`DemoSecao.animacaoEntrada`).
 *
 * **O HTML servido é sempre visível** — mesmo desenho do SectionReveal da
 * barbearia. A versão anterior (motion, `initial={{opacity:0}}`) saía no
 * documento do servidor com as sete seções transparentes: sem JavaScript,
 * ou até a hidratação, a página era só a abertura. Aqui a entrada só é
 * ARMADA no cliente, e só para o que está fora da tela na montagem — o que
 * já está à vista não pisca. O IntersectionObserver usa threshold 0, então
 * seções mais altas que a tela também entram.
 */
export type RevealTipo = "padrao" | "fade" | "esquerda" | "direita";

export function SectionReveal({
  animacao,
  tipo = "padrao",
  delay = 0,
  children,
}: {
  animacao: Animacao;
  tipo?: RevealTipo;
  /** Atraso da entrada, em segundos (escalonamento de itens de uma grade). */
  delay?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || animacao === "nenhuma" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < innerHeight) return;
    const dist = animacao === "marcante" ? 56 : 20;
    const transform =
      tipo === "fade"
        ? undefined
        : tipo === "esquerda"
          ? `translateX(${-dist}px)`
          : tipo === "direita"
            ? `translateX(${dist}px)`
            : `translateY(${dist}px)`;
    el.style.opacity = "0";
    let animation: Animation | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.style.opacity = "";
        animation = el.animate(
          [
            { opacity: 0, ...(transform && { transform }) },
            { opacity: 1, ...(transform && { transform: "none" }) },
          ],
          {
            duration: animacao === "marcante" ? 800 : 500,
            delay: delay * 1000,
            easing: "cubic-bezier(0.16,1,0.3,1)",
            fill: "backwards",
          },
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
  }, [animacao, tipo, delay]);

  if (!children) return null;
  return <div ref={ref}>{children}</div>;
}
