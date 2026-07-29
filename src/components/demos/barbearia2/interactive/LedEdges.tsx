"use client";

import { useEffect, useRef } from "react";

import type { LedPreset } from "@/lib/demos/types";

/**
 * Bordas laterais com luz LED — idêntico nas demais skins (componente sem
 * dependência do nicho). Ver
 * src/components/demos/barbearia/interactive/LedEdges.tsx para os detalhes.
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
