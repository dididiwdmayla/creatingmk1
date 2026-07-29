"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Cursor customizado — ponto sólido com mix-blend-mode multiply, fiel ao
 * material bruto (`[data-cursor]`, 14px → 40px sobre link/botão, cor =
 * pigmento da seção atual via `--d-pigment`, escrita por PigmentTracker).
 * Some em touch devices, sem hover, e com prefers-reduced-motion.
 */
export function CustomCursor() {
  const [isVisible, setIsVisible] = useState(false);
  const [big, setBig] = useState(false);

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  const [reducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  const springConfig = { damping: 34, stiffness: 500, mass: 0.4 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    if (reducedMotion) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const t = setTimeout(() => setIsVisible(true), 0);
    document.body.style.cursor = "none";

    const handleMouseMove = (e: MouseEvent) => {
      cursorX.set(e.clientX - 7);
      cursorY.set(e.clientY - 7);
    };
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      setBig(Boolean(target.closest("a, button")));
    };

    window.addEventListener("pointermove", handleMouseMove);
    document.addEventListener("pointerover", handleMouseOver, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointermove", handleMouseMove);
      document.removeEventListener("pointerover", handleMouseOver, true);
      document.body.style.cursor = "auto";
    };
  }, [cursorX, cursorY, reducedMotion]);

  if (!isVisible || reducedMotion) return null;

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[9999] hidden rounded-full md:block"
      style={{
        x: cursorXSpring,
        y: cursorYSpring,
        width: big ? 40 : 14,
        height: big ? 40 : 14,
        backgroundColor: "var(--d-pigment, var(--d-accent))",
        mixBlendMode: "multiply",
        transition: "width 250ms, height 250ms, background-color 400ms",
      }}
    />
  );
}
