"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Cursor customizado — máquina de tatuagem, fiel ao material bruto
 * (ícone fixo com spring physics, sem troca de ícone por contexto como na
 * barbearia). Mostra "Ver detalhes" sob o cursor ao passar sobre um card
 * de portfólio (`data-cursor="portfolio"`). Some em touch devices, sem
 * hover, e com prefers-reduced-motion.
 */
export function CustomCursor({ accent }: { accent: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const [hoverType, setHoverType] = useState<"" | "link" | "portfolio">("");

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const scale = useMotionValue(1);

  const [reducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  const springConfig = reducedMotion
    ? { damping: 50, stiffness: 400, mass: 0.3 }
    : { damping: 30, stiffness: 400, mass: 0.3 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);
  const scaleSpring = useSpring(scale, springConfig);

  useEffect(() => {
    if (reducedMotion) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const t = setTimeout(() => setIsVisible(true), 0);
    document.body.style.cursor = "none";

    const handleMouseMove = (e: MouseEvent) => {
      cursorX.set(e.clientX - 12);
      cursorY.set(e.clientY - 24);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isPortfolioHover = target.closest('[data-cursor="portfolio"]');
      const isLinkHover =
        target.tagName?.toLowerCase() === "a" ||
        target.tagName?.toLowerCase() === "button" ||
        target.closest("a") ||
        target.closest("button") ||
        target.closest('[data-cursor="hover"]');

      if (isPortfolioHover) {
        setHoverType("portfolio");
        scale.set(1.5);
      } else if (isLinkHover) {
        setHoverType("link");
        scale.set(1.5);
      } else {
        setHoverType("");
        scale.set(1);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseover", handleMouseOver);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseover", handleMouseOver);
      document.body.style.cursor = "auto";
    };
  }, [cursorX, cursorY, scale, reducedMotion]);

  if (!isVisible || reducedMotion) return null;

  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[9999] hidden flex-col items-center justify-end md:flex"
      style={{ x: cursorXSpring, y: cursorYSpring, width: 24, height: 24 }}
    >
      <motion.svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="rgba(245,245,245,0.1)"
        stroke={accent}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0"
        style={{ scale: scaleSpring, originX: 0.5, originY: 1, rotate: 15 }}
      >
        <path d="M12 18v6" />
        <rect x="10" y="10" width="4" height="8" rx="1" />
        <path d="M12 10V6" />
        <circle cx="9" cy="5" r="2" />
        <circle cx="15" cy="5" r="2" />
        <path d="M7 5h10" />
        <path d="M15 3l-2 2" />
      </motion.svg>

      {hoverType === "portfolio" && (
        <span className="absolute top-9 whitespace-nowrap font-[family-name:var(--d-corpo)] text-[11px] uppercase tracking-[0.2em] text-[var(--d-text)]">
          Ver detalhes
        </span>
      )}
    </motion.div>
  );
}
