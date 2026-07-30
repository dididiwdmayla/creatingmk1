"use client";

import { useEffect, useRef } from "react";

/**
 * Manifesto que "acende" palavra a palavra conforme o progresso do scroll
 * pela seção — fiel ao original: `p = clamp((innerHeight*0.82 - top) /
 * (height*0.95), 0, 1)`, cada palavra some (opacidade 0.14) até o
 * progresso alcançá-la. No material bruto isso roda incondicionalmente,
 * FORA do bloco `if (anim)` que guarda o resto das animações — por isso,
 * ao contrário de CustomCursor/ParallaxHero, este componente NÃO é
 * gateado por `Theme.animacao` (mesma exceção do original), só por
 * `prefers-reduced-motion` (todas as palavras nascem visíveis, sem JS).
 */
export function ManifestoReveal({ texto, slot }: { texto: string; slot: string }) {
  const secaoRef = useRef<HTMLParagraphElement>(null);
  const palavras = texto.split(" ");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const secao = secaoRef.current;
    if (!secao) return;
    const spans = secao.querySelectorAll<HTMLElement>("[data-mw]");

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = secao.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (window.innerHeight * 0.82 - r.top) / (r.height * 0.95)));
        const n = spans.length;
        spans.forEach((span, i) => {
          span.style.opacity = p * n > i ? "1" : "0.14";
        });
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const reduzida =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <p
      ref={secaoRef}
      data-demo-slot={slot}
      className="font-[family-name:var(--d-display)] text-[clamp(2rem,4.4vw,3.75rem)] font-normal leading-[1.22] tracking-[-0.015em]"
      style={{ color: "var(--d-bg)" }}
    >
      {palavras.map((palavra, i) => (
        <span
          key={i}
          data-mw
          style={{
            opacity: reduzida ? 1 : 0.14,
            transition: "opacity 0.4s linear",
          }}
        >
          {palavra}{" "}
        </span>
      ))}
    </p>
  );
}
