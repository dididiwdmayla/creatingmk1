"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Manifesto com palavras "acendendo" conforme o scroll passa pela seção —
 * fiel ao material bruto (`words`/`onScroll` do original): cada palavra
 * nasce esmaecida (mix entre texto e fundo do tema, funciona em preset
 * claro ou escuro) e vira cor sólida conforme o progresso do scroll
 * atinge o índice dela; a cada N palavras (`accentEvery`), a palavra
 * também ganha itálico e uma cor do ciclo de acentos do tema em vez do
 * texto normal — igual ao original destacar só ALGUMAS palavras
 * ("memória", "identidade"…) em cor e itálico.
 *
 * **O HTML servido sai ACESO** (item 4 da sessão de fundação): a versão
 * anterior pintava toda palavra em `--d-unlit` (32% de mistura — 1,97 a
 * 2,64:1 nas quatro paletas) já no JSX, e só um `useEffect` client-side
 * acendia — sem JavaScript, ou antes da hidratação, o manifesto inteiro era
 * ilegível. Agora cada palavra nasce na cor FINAL (o cliente é quem apaga,
 * num `useLayoutEffect` — antes do navegador pintar, sem flash de "aceso
 * depois apaga" — só as palavras ainda não alcançadas pelo scroll no
 * momento da montagem). `ativa=false` (Theme.animacao "nenhuma" ou
 * prefers-reduced-motion) não roda o efeito: fica tudo aceso, como o
 * documento servido.
 */
export function ManifestoReveal({
  texto,
  slot,
  className = "",
  accentCycle,
  accentEvery = 5,
  ativa,
}: {
  texto: string;
  slot?: string;
  className?: string;
  accentCycle: string[];
  accentEvery?: number;
  ativa: boolean;
}) {
  const containerRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!ativa || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const palavras = Array.from(container.querySelectorAll<HTMLElement>("[data-w]"));

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const vh = window.innerHeight;
        const r = container.getBoundingClientRect();
        const prog = Math.min(1, Math.max(0, (vh * 0.75 - r.top) / (r.height * 0.9)));
        const lit = Math.floor(prog * (palavras.length + 1));
        palavras.forEach((w, i) => {
          w.style.color =
            i < lit ? (w.dataset.accent ? w.dataset.accent : "var(--d-text)") : "var(--d-unlit)";
        });
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ativa, accentCycle, texto]);

  const palavras = texto.trim().split(/\s+/);

  return (
    <p ref={containerRef} data-demo-slot={slot} className={className}>
      {palavras.map((palavra, i) => {
        const destacada = i % accentEvery === accentEvery - 1;
        const cor = destacada ? accentCycle[(i / accentEvery) % accentCycle.length | 0] : undefined;
        return (
          <span
            key={i}
            data-w
            data-accent={cor}
            style={{
              color: cor ?? "var(--d-text)",
              fontStyle: destacada ? "italic" : "normal",
              fontWeight: destacada ? 300 : undefined,
              transition: "color .5s",
              marginRight: "0.28em",
              display: "inline-block",
            }}
          >
            {palavra}
          </span>
        );
      })}
    </p>
  );
}
