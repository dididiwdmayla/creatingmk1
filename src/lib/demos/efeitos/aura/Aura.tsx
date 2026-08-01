"use client";

import { useEffect, useRef } from "react";

import type { EfeitoProps } from "../types";
import { useEfeitoAtivo } from "../useEfeitoAtivo";
import { alvoPonteiro, alvoScroll, deriva, fatorLerp, lerpPonto } from "./alvo";

/**
 * Dois blobs de gradiente radial com blur assado (filter fixo, NUNCA
 * animado — só transform muda a cada frame) misturados por
 * mix-blend-mode. No desktop (pointer:fine) o alvo segue o ponteiro; no
 * celular o alvo é o CENTRO da viewport, deslocado pelo progresso de
 * scroll e somado a uma deriva lenta autônoma (senoidal), pra não morrer
 * parado enquanto o usuário não rola nem move o dedo. Interpolação (lerp)
 * suaviza o movimento em direção ao alvo — nunca posição colada. Matemática
 * do alvo isolada em ./alvo.ts (testável sem DOM).
 *
 * A posição é escrita direto no DOM via ref a cada frame (nunca via
 * estado React) — mesmo padrão de custo baixo do LedEdges. O loop só
 * avança quando `ativo` (viewport + aba + sem pausa externa); reduced
 * motion nem registra listener/rAF, só posiciona os blobs uma vez.
 */

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
    let target = { x: 0, y: 0 };
    let current1 = { x: -10, y: -10 };
    let current2 = { x: 10, y: 10 };

    function onPointerMove(event: PointerEvent) {
      target = alvoPonteiro(event.clientX, event.clientY, container!.getBoundingClientRect());
    }

    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      target = alvoScroll(window.scrollY, max);
    }

    if (isDesktop) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
    } else {
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    const lerp = fatorLerp(intensidade);
    let raf = 0;

    function tick(now: number) {
      raf = requestAnimationFrame(tick);
      if (!ativoRef.current) return; // pausado: congela na última posição

      let alvo = target;
      if (!isDesktop) {
        const d = deriva(now);
        alvo = { x: target.x + d.x, y: target.y + d.y };
      }

      current1 = lerpPonto(current1, alvo, lerp);
      current2 = lerpPonto(current2, { x: -alvo.x, y: -alvo.y }, lerp);

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
    <div
      ref={containerRef}
      // fixed (não absolute): cobre a viewport inteira em qualquer scroll,
      // em vez de ficar preso à altura do bloco inicial do documento — ver
      // ARCHITECTURE.md ("efeitos de fundo cobrem a viewport inteira").
      // z-index negativo garante que fica atrás de TODO conteúdo normal da
      // demo, inclusive seções sem position (que, sem isso, pintariam
      // atrás de um elemento posicionado com z-index:auto).
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
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
