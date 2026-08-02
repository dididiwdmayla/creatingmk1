"use client";

import { useEffect, useRef } from "react";

import type { LedPreset } from "../types";
import { LED_ESTILO_PADRAO } from "./registry";

/**
 * Bordas com luz LED na cor de destaque do tema (`var(--d-accent)`,
 * definida pelo wrapper da própria skin — este componente nunca recebe
 * `cores`, só lê a CSS var já disponível no DOM ancestral, igual a antes
 * desta migração). Micro-interação de `Theme.led` (nível: desligado/
 * sutil/marcante) × `Theme.ledEstilo` (registro de estilos visuais — ver
 * ./registry.ts): CSS puro (opacity/box-shadow/gradiente, sem transform de
 * layout), reage ao scroll via uma única custom property (`--d-led-scroll`,
 * 0–1) escrita direto no DOM por um ref dentro de um listener de scroll
 * passivo throttled por rAF — nenhum estado React por frame — e pulsa no
 * clique (`.d-led-pulse`, `filter: brightness()` reiniciado por toggle de
 * classe). `desligado` nem monta nada; `prefers-reduced-motion` mantém as
 * barras estáticas (sem listener de scroll/click nenhum).
 *
 * Centralizado aqui (era um arquivo idêntico duplicado em cada
 * `src/components/demos/<skin>/interactive/LedEdges.tsx` — ver
 * ARCHITECTURE.md): o CSS de cada estilo vive TODO neste componente
 * (mesma convenção de `efeitos/gradiente/Gradiente.tsx`, que injeta o
 * próprio `<style>`), então acrescentar um estilo novo ao registro não
 * exige tocar em nenhuma das 8 skins. Cada `interactive/LedEdges.tsx` de
 * skin agora só reexporta este componente.
 */
export function LedEdges({ preset, estilo }: { preset: LedPreset; estilo?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const estiloResolvido = estilo || LED_ESTILO_PADRAO;

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
    <div ref={ref} data-d-led={preset} data-d-led-estilo={estiloResolvido} className="d-led-edges" aria-hidden="true">
      <style>{`
        .d-led-edges {
          position: fixed; inset: 0; z-index: 45; pointer-events: none;
          --d-led-scroll: 0;
        }

        /* ---- estilo "barra" (default/original): barra fina, ponta nítida ---- */
        .d-led-bar {
          position: absolute; top: 0; bottom: 0; width: 3px;
          background: linear-gradient(to bottom,
            transparent 0%,
            color-mix(in srgb, var(--d-accent) 65%, transparent) calc(var(--d-led-scroll) * 100% - 18%),
            var(--d-accent) calc(var(--d-led-scroll) * 100%),
            color-mix(in srgb, var(--d-accent) 65%, transparent) calc(var(--d-led-scroll) * 100% + 18%),
            transparent 100%);
          box-shadow: 0 0 10px 1px color-mix(in srgb, var(--d-accent) 55%, transparent);
          opacity: 0.5;
          transition: opacity 200ms ease, box-shadow 200ms ease;
        }
        [data-d-led="marcante"] .d-led-bar {
          width: 4px;
          opacity: 0.85;
          box-shadow: 0 0 20px 3px color-mix(in srgb, var(--d-accent) 70%, transparent);
        }
        .d-led-left { left: 0; }
        .d-led-right { right: 0; }

        /* ---- estilo "dissipado": halo largo e difuso, sem borda nítida ---- */
        [data-d-led-estilo="dissipado"] .d-led-bar {
          width: 110px;
          opacity: 0.4;
          box-shadow: none;
          background: linear-gradient(to bottom,
            transparent 0%,
            color-mix(in srgb, var(--d-accent) 24%, transparent) calc(var(--d-led-scroll) * 100% - 36%),
            color-mix(in srgb, var(--d-accent) 40%, transparent) calc(var(--d-led-scroll) * 100%),
            color-mix(in srgb, var(--d-accent) 24%, transparent) calc(var(--d-led-scroll) * 100% + 36%),
            transparent 100%);
        }
        [data-d-led-estilo="dissipado"][data-d-led="marcante"] .d-led-bar {
          width: 160px;
          opacity: 0.65;
          box-shadow: none;
        }

        /* ---- estilo "cantos": luz só nos 4 cantos, sem barra contínua ---- */
        .d-led-corner {
          position: absolute; width: 64px; height: 64px;
          background: radial-gradient(circle, color-mix(in srgb, var(--d-accent) 70%, transparent) 0%, transparent 72%);
          box-shadow: 0 0 24px 6px color-mix(in srgb, var(--d-accent) 40%, transparent);
          transition: opacity 200ms ease;
        }
        [data-d-led="marcante"] .d-led-corner { width: 96px; height: 96px; }
        .d-led-corner-tl { top: 0; left: 0; }
        .d-led-corner-tr { top: 0; right: 0; }
        .d-led-corner-bl { bottom: 0; left: 0; }
        .d-led-corner-br { bottom: 0; right: 0; }
        /* topo mais forte no início do scroll, base mais forte no fim — o par acende conforme a seção correspondente se aproxima. */
        .d-led-corner-tl, .d-led-corner-tr {
          opacity: clamp(0.15, calc(0.15 + (1 - var(--d-led-scroll)) * 0.45), 0.6);
        }
        .d-led-corner-bl, .d-led-corner-br {
          opacity: clamp(0.15, calc(0.15 + var(--d-led-scroll) * 0.45), 0.6);
        }
        [data-d-led="marcante"] .d-led-corner-tl, [data-d-led="marcante"] .d-led-corner-tr {
          opacity: clamp(0.3, calc(0.3 + (1 - var(--d-led-scroll)) * 0.6), 1);
        }
        [data-d-led="marcante"] .d-led-corner-bl, [data-d-led="marcante"] .d-led-corner-br {
          opacity: clamp(0.3, calc(0.3 + var(--d-led-scroll) * 0.6), 1);
        }

        /* ---- estilo "moldura": perímetro completo, pulso percorrendo via scroll ---- */
        .d-led-side {
          position: absolute;
          box-shadow: 0 0 10px 1px color-mix(in srgb, var(--d-accent) 55%, transparent);
          opacity: 0.5;
          transition: opacity 200ms ease;
        }
        [data-d-led="marcante"] .d-led-side { opacity: 0.85; }
        .d-led-side-top { top: 0; left: 0; right: 0; height: 3px; }
        .d-led-side-bottom { bottom: 0; left: 0; right: 0; height: 3px; }
        .d-led-side-left { top: 0; bottom: 0; left: 0; width: 3px; }
        .d-led-side-right { top: 0; bottom: 0; right: 0; width: 3px; }
        [data-d-led="marcante"] .d-led-side-top, [data-d-led="marcante"] .d-led-side-bottom { height: 4px; }
        [data-d-led="marcante"] .d-led-side-left, [data-d-led="marcante"] .d-led-side-right { width: 4px; }
        /* --d-led-scroll (0-1) dividido em 4 quartos, um por lado (topo → direita → baixo → esquerda) —
           o ponto mais brilhante viaja de lado a lado conforme a página inteira é rolada, sem @keyframes. */
        .d-led-side-top {
          background: linear-gradient(to right,
            transparent 0%,
            color-mix(in srgb, var(--d-accent) 65%, transparent) calc(clamp(0%, var(--d-led-scroll) * 400%, 100%) - 18%),
            var(--d-accent) clamp(0%, calc(var(--d-led-scroll) * 400%), 100%),
            color-mix(in srgb, var(--d-accent) 65%, transparent) calc(clamp(0%, var(--d-led-scroll) * 400%, 100%) + 18%),
            transparent 100%);
        }
        .d-led-side-right {
          background: linear-gradient(to bottom,
            transparent 0%,
            color-mix(in srgb, var(--d-accent) 65%, transparent) calc(clamp(0%, calc((var(--d-led-scroll) - 0.25) * 400%), 100%) - 18%),
            var(--d-accent) clamp(0%, calc((var(--d-led-scroll) - 0.25) * 400%), 100%),
            color-mix(in srgb, var(--d-accent) 65%, transparent) calc(clamp(0%, calc((var(--d-led-scroll) - 0.25) * 400%), 100%) + 18%),
            transparent 100%);
        }
        .d-led-side-bottom {
          background: linear-gradient(to left,
            transparent 0%,
            color-mix(in srgb, var(--d-accent) 65%, transparent) calc(clamp(0%, calc((var(--d-led-scroll) - 0.5) * 400%), 100%) - 18%),
            var(--d-accent) clamp(0%, calc((var(--d-led-scroll) - 0.5) * 400%), 100%),
            color-mix(in srgb, var(--d-accent) 65%, transparent) calc(clamp(0%, calc((var(--d-led-scroll) - 0.5) * 400%), 100%) + 18%),
            transparent 100%);
        }
        .d-led-side-left {
          background: linear-gradient(to top,
            transparent 0%,
            color-mix(in srgb, var(--d-accent) 65%, transparent) calc(clamp(0%, calc((var(--d-led-scroll) - 0.75) * 400%), 100%) - 18%),
            var(--d-accent) clamp(0%, calc((var(--d-led-scroll) - 0.75) * 400%), 100%),
            color-mix(in srgb, var(--d-accent) 65%, transparent) calc(clamp(0%, calc((var(--d-led-scroll) - 0.75) * 400%), 100%) + 18%),
            transparent 100%);
        }

        @keyframes d-led-pulso {
          0% { filter: brightness(1); }
          30% { filter: brightness(1.8); }
          100% { filter: brightness(1); }
        }
        .d-led-pulse .d-led-bar,
        .d-led-pulse .d-led-corner,
        .d-led-pulse .d-led-side {
          animation: d-led-pulso 500ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .d-led-bar, .d-led-corner, .d-led-side { transition: none; }
          .d-led-pulse .d-led-bar,
          .d-led-pulse .d-led-corner,
          .d-led-pulse .d-led-side { animation: none; }
        }
      `}</style>
      {estiloResolvido === "cantos" ? (
        <>
          <span className="d-led-corner d-led-corner-tl" />
          <span className="d-led-corner d-led-corner-tr" />
          <span className="d-led-corner d-led-corner-bl" />
          <span className="d-led-corner d-led-corner-br" />
        </>
      ) : estiloResolvido === "moldura" ? (
        <>
          <span className="d-led-side d-led-side-top" />
          <span className="d-led-side d-led-side-right" />
          <span className="d-led-side d-led-side-bottom" />
          <span className="d-led-side d-led-side-left" />
        </>
      ) : (
        <>
          <span className="d-led-bar d-led-left" />
          <span className="d-led-bar d-led-right" />
        </>
      )}
    </div>
  );
}
