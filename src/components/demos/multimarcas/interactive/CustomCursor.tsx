"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Cursor customizado — ponto exato + anel com leve atraso (spring), que
 * cresce e fica sólido sobre links/botões/inputs/cards de veículo. Fiel ao
 * material bruto (`setupCursor`): só em ponteiro fino (mouse), escondido em
 * touch/reduced-motion. O anel usava um lerp manual (fator .16 por frame)
 * no original — aqui vira spring do `motion`, mesmo padrão das skins de
 * barbearia/tatuagem (ver interactive/CustomCursor.tsx de lá).
 */
export function CustomCursor({ accent }: { accent: string }) {
  const [visivel, setVisivel] = useState(false);
  const [hot, setHot] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const springConfig = { damping: 30, stiffness: 260, mass: 0.4 };
  const ringX = useSpring(x, springConfig);
  const ringY = useSpring(y, springConfig);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const t = setTimeout(() => setVisivel(true), 0);

    const onMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    const onOver = (e: MouseEvent) => {
      const alvo = e.target as HTMLElement;
      setHot(Boolean(alvo.closest("a, button, input, [data-car]")));
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseover", onOver);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
    };
  }, [x, y]);

  if (!visivel) return null;

  const tamanho = hot ? 58 : 36;

  return (
    <>
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[10001] hidden h-[6px] w-[6px] -ml-[3px] -mt-[3px] rounded-full md:block"
        style={{ x, y, background: accent }}
        aria-hidden="true"
      />
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[10000] hidden rounded-full border-[1.5px] md:block"
        style={{
          x: ringX,
          y: ringY,
          width: tamanho,
          height: tamanho,
          marginLeft: -tamanho / 2,
          marginTop: -tamanho / 2,
          borderColor: hot ? accent : `color-mix(in srgb, ${accent} 55%, transparent)`,
          transition: "width .25s ease, height .25s ease, border-color .25s ease, margin .25s ease",
        }}
        aria-hidden="true"
      />
    </>
  );
}
