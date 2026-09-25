"use client";

import { useEffect, useRef } from "react";

/**
 * Traço SVG que se desenha ao entrar no viewport (`stroke-dashoffset`, fiel
 * ao `[data-draw]`/`drawLine` do material bruto: usado no rabisco de
 * assinatura de cada artista e na linha que conecta os passos do Processo).
 *
 * **O HTML servido sai com o traço COMPLETO** (item 4 da sessão de
 * fundação — mesmo desenho de `FadeUp`/`SectionReveal` ao lado): a versão
 * anterior usava `motion.path` com `initial={{strokeDashoffset: 1}}`, que
 * saía invisível no documento do servidor (e ficaria assim para sempre sem
 * JavaScript). Aqui o traço nasce desenhado; só quando está fora da tela na
 * montagem o cliente o esconde e reanima ao entrar no viewport — o mesmo
 * IntersectionObserver do `SectionReveal`, animando `stroke-dashoffset` via
 * Web Animations API em vez de reatividade do React a cada frame.
 * `prefers-reduced-motion` mostra o traço completo direto, sem animação.
 */
export function LineDraw({
  d,
  viewBox,
  stroke,
  className = "",
  strokeWidth = 2,
  duration = 1.8,
}: {
  d: string;
  viewBox: string;
  stroke: string;
  className?: string;
  strokeWidth?: number;
  duration?: number;
}) {
  const ref = useRef<SVGPathElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const svg = el.closest("svg");
    if (!svg || svg.getBoundingClientRect().top < innerHeight) return;
    el.style.strokeDashoffset = "1";
    let animation: Animation | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.style.strokeDashoffset = "";
        animation = el.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
          duration: duration * 1000,
          easing: "cubic-bezier(0.6,0,0.3,1)",
          fill: "backwards",
        });
        observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(svg);
    return () => {
      observer.disconnect();
      animation?.cancel();
      el.style.strokeDashoffset = "";
    };
  }, [duration]);

  return (
    <svg viewBox={viewBox} className={className} aria-hidden="true">
      <path
        ref={ref}
        d={d}
        pathLength={1}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={1}
        strokeDashoffset={0}
      />
    </svg>
  );
}
