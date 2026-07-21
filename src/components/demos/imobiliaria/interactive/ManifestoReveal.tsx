"use client";

import { useEffect, useRef } from "react";

import type { Animacao } from "@/lib/demos/types";

/**
 * Revelação palavra a palavra fiel ao manifesto do material bruto: cada
 * palavra nasce em opacidade baixa (0.14) e "acende" (opacidade 1)
 * conforme o progresso de scroll da seção — não é um reveal único (fade
 * in de uma vez), é uma leitura progressiva, calculada a cada frame de
 * scroll (mesma fórmula do original: progresso = quanto de
 * `innerHeight*0.82 - top` já foi percorrido sobre `altura*0.95`).
 * Opacidade escrita direto no DOM por rAF (sem estado React por palavra —
 * mesmo padrão de custo de LedEdges.tsx). Desligado por `animacao ===
 * "nenhuma"` ou prefers-reduced-motion: todas as palavras ficam 100%
 * visíveis, sem leitor de scroll nenhum.
 */
export function ManifestoReveal({ texto, animacao }: { texto: string; animacao: Animacao }) {
  const secaoRef = useRef<HTMLParagraphElement>(null);
  const palavras = texto.split(" ");
  const ligado = animacao !== "nenhuma";

  useEffect(() => {
    if (!ligado) return;
    const el = secaoRef.current;
    if (!el) return;
    const spans = el.querySelectorAll<HTMLElement>("[data-mw]");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      spans.forEach((span) => {
        span.style.opacity = "1";
      });
      return;
    }

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
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
  }, [ligado]);

  return (
    <p
      ref={secaoRef}
      data-demo-slot="secoes.manifesto.texto"
      className="font-[family-name:var(--d-citacao)] text-[clamp(1.75rem,4.4vw,3.75rem)] font-normal leading-[1.22] tracking-tight text-[var(--d-bg)]"
    >
      {palavras.map((palavra, i) => (
        <span
          key={i}
          data-mw
          className="transition-opacity duration-[400ms] ease-linear"
          style={{ opacity: ligado ? 0.14 : 1 }}
        >
          {palavra}{" "}
        </span>
      ))}
    </p>
  );
}
