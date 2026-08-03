"use client";

import { useEffect, useRef } from "react";

import type { EfeitoProps } from "../types";
import { useEfeitoAtivo } from "../useEfeitoAtivo";
import { alvoPonteiro, alvoScroll, deriva, fatorLerp, lerpPonto } from "./alvo";
import { fundoMancha, opacidadeAura } from "./estilo";

/**
 * Dois blobs de gradiente radial misturados por mix-blend-mode. Sem
 * `filter` NENHUM: o blob recebe um transform novo a cada quadro, e um
 * elemento filtrado não composita a transformação — ele re-rasteriza e
 * re-borra 60vmax de superfície toda vez que se move (12,7 fps medidos).
 * A suavidade que o blur dava virou rampa de gradiente, calculada em
 * ./estilo.ts como o mesmo cone convoluído com uma gaussiana.
 *
 * No desktop (pointer:fine) o alvo segue o ponteiro; no
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

  const opacidade = opacidadeAura(intensidade);

  return (
    <div
      ref={containerRef}
      // fixed (não absolute): cobre a viewport inteira em qualquer scroll,
      // em vez de ficar preso à altura do bloco inicial do documento — ver
      // ARCHITECTURE.md ("efeitos de fundo cobrem a viewport inteira").
      // z-index POSITIVO (mesma convenção de gradiente/particulas): toda
      // seção da demo tem fundo sólido próprio (--d-bg/--d-bg-alt cobrindo
      // 100% da largura, sem gaps), então um z-index negativo pinta o
      // efeito atrás desse fundo e ele nunca aparece — ver ARCHITECTURE.md.
      // mix-blend-mode: screen nos blobs faz o efeito se somar à cor por
      // baixo (nunca cobrir/escurecer), então ficar por cima é seguro em
      // tema claro e escuro; pointer-events: none garante que não bloqueia clique.
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
      aria-hidden="true"
      // Fade da camada (--d-efeito-fade, escrito por EfeitoCamada conforme
      // as seções com animação entram e saem da viewport — ver
      // lib/demos/animacao/cobertura.ts). Toda raiz de efeito multiplica
      // esta var na própria opacidade; ausente = 1 (fora da camada).
      style={{ opacity: "var(--d-efeito-fade, 1)" }}
    >
      {/*
        A caixa é ESCALA_CAIXA vezes o lado histórico (60/55vmax) e o
        canto é recuado de metade do que ela cresceu, pra que o CENTRO do
        blob fique exatamente onde estava: sem `filter` não há
        sangramento pra fora do elemento, então a cauda da mancha (que o
        blur pintava fora da caixa) precisa caber DENTRO dela. Ver
        ./estilo.ts.
      */}
      <div
        ref={blob1Ref}
        className="absolute left-[calc(25%-18vmax)] top-[calc(25%-18vmax)] h-[96vmax] w-[96vmax] rounded-full will-change-transform"
        style={{
          background: fundoMancha(cores.destaque, intensidade),
          opacity: opacidade,
          mixBlendMode: "screen",
          transform: "translate3d(-10%, -10%, 0)",
        }}
      />
      <div
        ref={blob2Ref}
        className="absolute right-[calc(25%-16.5vmax)] bottom-[calc(25%-16.5vmax)] h-[88vmax] w-[88vmax] rounded-full will-change-transform"
        style={{
          background: fundoMancha(cores.acentoSecundario, intensidade),
          opacity: opacidade,
          mixBlendMode: "screen",
          transform: "translate3d(10%, 10%, 0)",
        }}
      />
    </div>
  );
}
