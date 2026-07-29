"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Galeria em trilha horizontal "pinada": a seção fica alta e, enquanto o
 * usuário rola verticalmente, a trilha desliza para a esquerda — fiel ao
 * `[data-gallery-wrap]`/`[data-track]` do material bruto (sticky +
 * `translateX` proporcional ao progresso do scroll). A altura do wrapper
 * é calculada a partir da largura real da trilha (não um "320vh" fixo do
 * original) para funcionar com qualquer número de itens do portfólio.
 *
 * Em ponteiro grosso (touch) — e em prefers-reduced-motion — cai para
 * scroll horizontal nativo, sem pin: mesmo comportamento do original, que
 * desliga a mecânica de scroll-driven em `coarse` pointers.
 */
export function ScrollGallery({ children }: { children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reduzida = useReducedMotion();

  const [pinar, setPinar] = useState(false);
  const [maxScroll, setMaxScroll] = useState(0);
  const [wrapperHeight, setWrapperHeight] = useState<number | null>(null);

  useEffect(() => {
    const fino = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const t = setTimeout(() => setPinar(fino && !reduzida), 0);
    return () => clearTimeout(t);
  }, [reduzida]);

  useEffect(() => {
    if (!pinar) return;
    const track = trackRef.current;
    if (!track) return;

    const medir = () => {
      const max = Math.max(0, track.scrollWidth - window.innerWidth);
      setMaxScroll(max);
      setWrapperHeight(window.innerHeight + max);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [pinar]);

  // `target` só aponta pro wrapperRef quando ele de fato existe no DOM
  // (`pinar`): no fallback de scroll nativo esse ref nunca é montado, e
  // passá-lo mesmo assim faz o motion avisar "ref defined but not
  // hydrated" — sem target, o hook cai no scroll do documento (cujo valor
  // é ignorado aqui, já que `x` não é aplicado fora do ramo `pinar`).
  const { scrollYProgress } = useScroll({
    target: pinar ? wrapperRef : undefined,
    offset: ["start start", "end end"],
  });
  const x = useTransform(scrollYProgress, [0, 1], [0, -maxScroll]);

  if (!pinar) {
    return (
      <div
        ref={trackRef}
        className="flex w-max gap-6 overflow-x-auto px-6 pb-6 [-webkit-overflow-scrolling:touch] md:px-[clamp(20px,5vw,72px)]"
        style={{ width: "auto" }}
      >
        {children}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} style={{ height: wrapperHeight ?? "100vh" }} className="relative">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <motion.div ref={trackRef} style={{ x }} className="flex w-max items-end gap-6 px-6 md:px-[clamp(20px,5vw,72px)]">
          {children}
        </motion.div>
      </div>
    </div>
  );
}
