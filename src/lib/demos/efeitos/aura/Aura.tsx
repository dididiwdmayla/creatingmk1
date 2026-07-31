"use client";

import { useEffect, useRef } from "react";

import type { EfeitoProps } from "../types";
import { useEfeitoAtivo } from "../useEfeitoAtivo";

/**
 * Dois blobs de gradiente radial com blur assado (filter fixo, NUNCA
 * animado — só transform muda a cada frame) misturados por
 * mix-blend-mode. No desktop (pointer:fine) o alvo segue o ponteiro; no
 * celular segue o progresso de scroll da página somado a uma deriva lenta
 * autônoma (senoidal), pra não morrer parado enquanto o usuário não rola.
 * Interpolação (lerp) suaviza o movimento em direção ao alvo.
 *
 * A posição é escrita direto no DOM via ref a cada frame (nunca via
 * estado React) — mesmo padrão de custo baixo do LedEdges. O loop só
 * avança quando `ativo` (viewport + aba + sem pausa externa); reduced
 * motion nem registra listener/rAF, só posiciona os blobs uma vez.
 */
const ESCALA_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.55, 2: 0.8, 3: 1 };
const DERIVA_VELOCIDADE = 0.00012; // rad/ms — deriva lenta autônoma no celular

export function Aura({ intensidade, cores, pausado }: EfeitoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const blob1Ref = useRef<HTMLDivElement>(null);
  const blob2Ref = useRef<HTMLDivElement>(null);
  const { ativo, reducedMotion } = useEfeitoAtivo(containerRef, pausado);
  const ativoRef = useRef(ativo);

  useEffect(() => {
    ativoRef.current = ativo;
  }, [ativo]);

  useEffect(() => {
    if (intensidade === 0) return;
    const container = containerRef.current;
    const blob1 = blob1Ref.current;
    const blob2 = blob2Ref.current;
    if (!container || !blob1 || !blob2) return;

    if (reducedMotion) {
      // Estático: posição fixa, sem listener nem rAF nenhum.
      blob1.style.transform = "translate3d(-10%, -10%, 0)";
      blob2.style.transform = "translate3d(10%, 10%, 0)";
      return;
    }

    const isDesktop = window.matchMedia("(pointer: fine)").matches;
    const target = { x: 0, y: 0 };
    const current1 = { x: -10, y: -10 };
    const current2 = { x: 10, y: 10 };

    function onPointerMove(event: PointerEvent) {
      const rect = container!.getBoundingClientRect();
      target.x = ((event.clientX - rect.left) / rect.width - 0.5) * 40;
      target.y = ((event.clientY - rect.top) / rect.height - 0.5) * 40;
    }

    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? window.scrollY / max : 0;
      target.x = (pct - 0.5) * 30;
      target.y = (pct - 0.5) * 30;
    }

    if (isDesktop) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
    } else {
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    const lerp = ESCALA_POR_INTENSIDADE[intensidade] * 0.06 + 0.02;
    let raf = 0;

    function tick(now: number) {
      raf = requestAnimationFrame(tick);
      if (!ativoRef.current) return; // pausado: congela na última posição

      let tx = target.x;
      let ty = target.y;
      if (!isDesktop) {
        tx += Math.sin(now * DERIVA_VELOCIDADE) * 8;
        ty += Math.cos(now * DERIVA_VELOCIDADE * 0.7) * 8;
      }

      current1.x += (tx - current1.x) * lerp;
      current1.y += (ty - current1.y) * lerp;
      current2.x += (-tx - current2.x) * lerp;
      current2.y += (-ty - current2.y) * lerp;

      blob1!.style.transform = `translate3d(${current1.x}%, ${current1.y}%, 0)`;
      blob2!.style.transform = `translate3d(${current2.x}%, ${current2.y}%, 0)`;
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, [intensidade, reducedMotion]);

  if (intensidade === 0) return null;

  const opacidade = 0.28 + intensidade * 0.1; // 1→0.38, 2→0.48, 3→0.58
  const blur = 40 + intensidade * 20; // 60/80/100px — fixo, nunca animado

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        ref={blob1Ref}
        className="absolute left-1/4 top-1/4 h-[60vmax] w-[60vmax] rounded-full will-change-transform"
        style={{
          background: `radial-gradient(circle, ${cores.destaque} 0%, transparent 70%)`,
          filter: `blur(${blur}px)`,
          opacity: opacidade,
          mixBlendMode: "screen",
          transform: "translate3d(-10%, -10%, 0)",
        }}
      />
      <div
        ref={blob2Ref}
        className="absolute right-1/4 bottom-1/4 h-[55vmax] w-[55vmax] rounded-full will-change-transform"
        style={{
          background: `radial-gradient(circle, ${cores.acentoSecundario} 0%, transparent 70%)`,
          filter: `blur(${blur}px)`,
          opacity: opacidade,
          mixBlendMode: "screen",
          transform: "translate3d(10%, 10%, 0)",
        }}
      />
    </div>
  );
}
