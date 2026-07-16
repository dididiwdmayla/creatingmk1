"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Tesoura animada ao lado do headline da Equipe — "clip-clip" 2 vezes ao
 * entrar na tela, uma única vez (fiel ao original).
 */
export function AnimatedScissors() {
  const [inView, setInView] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    const el = document.getElementById("d-scissors-trigger");
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasRun) {
          setInView(true);
          setHasRun(true);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasRun]);

  if (!inView) {
    return <div id="d-scissors-trigger" className="h-[80px] w-[80px] opacity-0" />;
  }

  const topBlade = [0, -15, 0, 0, -15, 0];
  const bottomBlade = [0, 15, 0, 0, 15, 0];
  const timing = { duration: 1.6, times: [0, 0.2, 0.4, 0.6, 0.8, 1], ease: "easeInOut" as const };

  return (
    <div id="d-scissors-trigger" className="relative h-[80px] w-[80px]">
      <motion.svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--d-muted)"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-full w-full drop-shadow-md"
        initial={{ opacity: 0, x: -20, rotate: -30 }}
        animate={{ opacity: 0.8, x: 0, rotate: -30 }}
        transition={{ duration: 0.6 }}
      >
        <motion.path
          d="M6 14 A 2 2 0 1 0 6 18 A 2 2 0 1 0 6 14 Z M 8 16 L 22 2"
          animate={{ rotate: topBlade, originX: 0.33, originY: 0.66 }}
          transition={timing}
        />
        <motion.path
          d="M6 6 A 2 2 0 1 0 6 10 A 2 2 0 1 0 6 6 Z M 8 8 L 22 22"
          animate={{ rotate: bottomBlade, originX: 0.33, originY: 0.33 }}
          transition={timing}
        />
        <circle cx="8" cy="12" r="1" fill="var(--d-accent)" stroke="none" />
      </motion.svg>
    </div>
  );
}
