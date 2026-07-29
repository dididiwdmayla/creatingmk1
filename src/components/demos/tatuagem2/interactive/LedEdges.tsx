"use client";

import { useEffect, useRef } from "react";

import type { LedPreset } from "@/lib/demos/types";

/**
 * Bordas laterais com luz LED na cor de destaque do tema — preset de
 * micro-interação (Theme.led), CSS puro (opacity/box-shadow, sem
 * transform de layout): reage SUTILMENTE ao scroll (a "posição" do brilho
 * ao longo da barra acompanha o progresso da página, via custom property
 * `--d-led-scroll` escrita direto no DOM por rAF — sem re-render React a
 * cada scroll) e pulsa no clique (`.d-led-pulse`, reiniciada por classe).
 *
 * Custo baixo em mobile por design: um listener de scroll passivo
 * throttled por rAF, um listener de click, nenhum estado React por
 * frame. "desligado" nem monta o componente; prefers-reduced-motion
 * mantém as barras estáticas (sem listener de scroll/click nenhum).
 */
export function LedEdges({ preset }: { preset: LedPreset }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (preset === "desligado") return;
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--d-led-scroll", "0.5");
      return;
    }

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? window.scrollY / max : 0;
        el.style.setProperty("--d-led-scroll", String(Math.min(1, Math.max(0, pct))));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const onClick = () => {
      el.classList.remove("d-led-pulse");
      void el.offsetWidth; // força reflow pra poder reiniciar a animação
      el.classList.add("d-led-pulse");
    };
    document.addEventListener("click", onClick);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [preset]);

  if (preset === "desligado") return null;

  return (
    <div ref={ref} data-d-led={preset} className="d-led-edges" aria-hidden="true">
      <span className="d-led-bar d-led-left" />
      <span className="d-led-bar d-led-right" />
    </div>
  );
}
