"use client";

import { useEffect, useRef } from "react";

/** Barra fina no topo com o progresso de leitura da página — puro CSS/rAF, sem re-render por frame. */
export function ProgressBar({ accent }: { accent: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
        const pct = window.scrollY / max;
        ref.current?.style.setProperty("transform", `scaleX(${pct})`);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="fixed left-0 right-0 top-0 z-[1200] h-[2px] origin-left"
      style={{ background: accent, transform: "scaleX(0)" }}
      aria-hidden="true"
    />
  );
}
