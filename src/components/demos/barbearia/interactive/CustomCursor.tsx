"use client";

import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";

import { CombIcon, OpenScissorsIcon, RazorIcon, ShavingMachineIcon } from "./cursorIcons";

/**
 * Cursor customizado contextual — troca de ícone conforme `data-cursor`
 * do elemento sob o ponteiro, com spring physics (fiel ao original).
 * Some em touch devices, sem hover, e com prefers-reduced-motion.
 */
export function CustomCursor({ accent }: { accent: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isHoveringLink, setIsHoveringLink] = useState(false);
  const [cursorType, setCursorType] = useState<string | null>(null);
  const [hoverText, setHoverText] = useState<string | null>(null);

  const [reducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const springConfig = { damping: 35, stiffness: 600, mass: 0.1 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    if (reducedMotion) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (!window.matchMedia("(hover: hover)").matches) return;

    const t = setTimeout(() => setIsVisible(true), 0);

    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      setIsHoveringLink(Boolean(target.closest("a, button")));

      const cursorEl = target.closest("[data-cursor]");
      setCursorType(cursorEl ? cursorEl.getAttribute("data-cursor") : null);

      const hoverCard = target.closest("[data-cursor-text]");
      setHoverText(hoverCard ? hoverCard.getAttribute("data-cursor-text") : null);
    };

    window.addEventListener("mousemove", moveCursor);
    window.addEventListener("mouseover", handleMouseOver);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", moveCursor);
      window.removeEventListener("mouseover", handleMouseOver);
    };
  }, [cursorX, cursorY, reducedMotion]);

  if (!isVisible || reducedMotion) return null;

  const renderIcon = () => {
    switch (cursorType) {
      case "razor":
        return <RazorIcon color={accent} />;
      case "comb":
        return <CombIcon color={accent} />;
      case "shaving-machine":
        return <ShavingMachineIcon color={accent} />;
      case "open-scissors":
        return <OpenScissorsIcon color={accent} />;
      default:
        return (
          <motion.svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={accent}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: isHoveringLink ? 30 : -15, scale: isHoveringLink ? 1.1 : 1 }}
            transition={{ duration: 0.15 }}
          >
            <motion.path
              d="M6 14 A 2 2 0 1 0 6 18 A 2 2 0 1 0 6 14 Z M 8 16 L 22 2"
              animate={{ rotate: isHoveringLink ? -15 : 0, originX: 0.33, originY: 0.66 }}
              transition={{ duration: 0.15 }}
            />
            <motion.path
              d="M6 6 A 2 2 0 1 0 6 10 A 2 2 0 1 0 6 6 Z M 8 8 L 22 22"
              animate={{ rotate: isHoveringLink ? 15 : 0, originX: 0.33, originY: 0.33 }}
              transition={{ duration: 0.15 }}
            />
          </motion.svg>
        );
    }
  };

  return (
    <motion.div
      className="fixed top-0 left-0 z-[9999] hidden pointer-events-none md:block"
      style={{ x: cursorXSpring, y: cursorYSpring }}
    >
      <div className="relative -ml-3 -mt-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={cursorType || "default"}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.1 }}
          >
            {renderIcon()}
          </motion.div>
        </AnimatePresence>

        {hoverText && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-8 left-4 whitespace-nowrap border border-[var(--d-border)] bg-[var(--d-bg)]/90 px-2 py-1 font-[family-name:var(--d-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--d-text)] shadow-lg backdrop-blur-sm"
            aria-label={`Cursor informativo: ${hoverText}`}
          >
            {hoverText}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
