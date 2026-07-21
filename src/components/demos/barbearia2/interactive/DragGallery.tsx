"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * Galeria com arraste por mouse e momentum ao soltar — fiel ao
 * `#nf-gallery` do material bruto (pointer events puros, sem lib). Só o
 * mouse arrasta (`pointerType !== 'mouse'` sai cedo, exatamente como o
 * original): toque usa o scroll nativo do navegador (`overflow-x:auto` +
 * `scroll-snap`), que já tem seu próprio momentum. `prefers-reduced-motion`
 * desliga só o momentum pós-soltura (o arraste 1:1 com o ponteiro continua,
 * igual ao original).
 */
export function DragGallery({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduzida = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let down = false;
    let startX = 0;
    let startL = 0;
    let vx = 0;
    let lastX = 0;
    let lastT = 0;
    let raf = 0;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      down = true;
      startX = e.clientX;
      startL = el.scrollLeft;
      lastX = e.clientX;
      lastT = performance.now();
      vx = 0;
      cancelAnimationFrame(raf);
      el.style.cursor = "grabbing";
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      el.scrollLeft = startL - (e.clientX - startX);
      const t = performance.now();
      vx = (e.clientX - lastX) / Math.max(1, t - lastT);
      lastX = e.clientX;
      lastT = t;
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      el.style.cursor = "grab";
      if (reduzida) return;
      let v = vx * 16;
      const step = () => {
        if (Math.abs(v) < 0.4) return;
        el.scrollLeft -= v;
        v *= 0.94;
        raf = requestAnimationFrame(step);
      };
      step();
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className={className} style={{ cursor: "grab", userSelect: "none" }}>
      {children}
    </div>
  );
}
