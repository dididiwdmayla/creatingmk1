"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { RazorBlade } from "./RazorBlade";
import { SparkParticles } from "./SparkParticles";

/**
 * Animação assinatura "navalha que corta a tela" — 5 fases coreografadas
 * por tempo (2.8s total) antes de revelar o conteúdo, fiel ao original.
 */
export function IntroAnimation({
  nome,
  cidade,
  accent,
  onComplete,
}: {
  nome: string;
  cidade?: string;
  accent: string;
  onComplete: () => void;
}) {
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setComplete(true);
      setTimeout(onComplete, 300);
    }, 2800);
    return () => clearTimeout(t);
  }, [onComplete]);

  if (complete) return null;

  const letterContainerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.6, ease: "easeOut" as const } },
  };
  const nameLetters = nome.split("");

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[var(--d-bg)] text-center"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col items-center justify-center px-4">
        {/* Metade superior */}
        <motion.div
          className="absolute left-0 right-0 top-1/2 flex flex-col items-center justify-end overflow-hidden"
          style={{ height: "50vh", marginTop: "-50vh" }}
          initial={{ y: 0 }}
          animate={{ y: "-100vh" }}
          transition={{ duration: 0.7, delay: 2.1, ease: "easeInOut" }}
        >
          <div className="relative -mb-[2.4rem] whitespace-nowrap md:-mb-[3.6rem]">
            <motion.div
              className="absolute inset-0 z-0 blur-[40px]"
              style={{
                background: `radial-gradient(ellipse at center, color-mix(in srgb, ${accent} 15%, transparent), transparent 70%)`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            />
            <motion.h1
              variants={letterContainerVariants}
              initial="hidden"
              animate="visible"
              className="relative z-10 whitespace-nowrap font-[family-name:var(--d-deco)] uppercase tracking-[0.08em] text-[var(--d-accent)]"
              style={{ fontSize: "clamp(3rem, 7vw, 5rem)" }}
            >
              {nameLetters.map((char, index) => (
                <motion.span
                  key={`top-${index}`}
                  initial={{ y: 0 }}
                  animate={{ y: -12 }}
                  transition={{ duration: 0.4, delay: 1.2 + index * 0.03, ease: "easeOut" }}
                >
                  {char}
                </motion.span>
              ))}
            </motion.h1>
          </div>
        </motion.div>

        {/* Fenda central de luz */}
        <motion.div
          className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
          style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
          initial={{ width: "0%", height: "0px", opacity: 0 }}
          animate={{ width: "100vw", height: "2px", opacity: [0, 1, 0] }}
          transition={{
            width: { duration: 0.4, delay: 1.2, ease: "easeInOut" },
            height: { duration: 0.2, delay: 1.2 },
            opacity: { times: [0, 0.2, 1], duration: 0.8, delay: 1.2, ease: "easeOut" },
          }}
        />

        {/* Metade inferior */}
        <motion.div
          className="absolute left-0 right-0 top-1/2 flex flex-col items-center justify-start overflow-hidden"
          style={{ height: "50vh" }}
          initial={{ y: 0 }}
          animate={{ y: "100vh" }}
          transition={{ duration: 0.7, delay: 2.1, ease: "easeInOut" }}
        >
          <div className="relative -mt-[2.4rem] whitespace-nowrap md:-mt-[3.6rem]">
            <motion.h1
              variants={letterContainerVariants}
              initial="hidden"
              animate="visible"
              className="relative z-10 whitespace-nowrap font-[family-name:var(--d-deco)] uppercase tracking-[0.08em] text-[var(--d-accent)]"
              style={{ fontSize: "clamp(3rem, 7vw, 5rem)" }}
            >
              {nameLetters.map((char, index) => (
                <motion.span
                  key={`bot-${index}`}
                  initial={{ y: 0 }}
                  animate={{ y: 12 }}
                  transition={{ duration: 0.4, delay: 1.2 + index * 0.03, ease: "easeOut" }}
                >
                  {char}
                </motion.span>
              ))}
            </motion.h1>
          </div>

          {cidade && (
            <motion.div
              className="mt-4 font-[family-name:var(--d-mono)] text-[10px] tracking-widest text-[var(--d-muted)] md:mt-8 md:text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              · {cidade}
            </motion.div>
          )}
        </motion.div>

        {/* A navalha */}
        <motion.div
          className="absolute left-1/2 top-1/2 z-30 -translate-y-1/2"
          initial={{ x: "60vw", opacity: 1 }}
          animate={{ x: "-60vw", opacity: [1, 1, 0] }}
          transition={{
            x: { duration: 1.4, delay: 0.6, ease: [0.5, 0, 0.2, 1] },
            opacity: { times: [0, 0.8, 1], duration: 1.4, delay: 0.6 },
          }}
        >
          <RazorBlade className="w-[180px] -rotate-6 drop-shadow-2xl md:w-[280px]" />
        </motion.div>

        <SparkParticles accent={accent} />

        <motion.button
          type="button"
          className="absolute bottom-8 right-8 font-[family-name:var(--d-mono)] text-[10px] uppercase tracking-wider text-[var(--d-muted)] opacity-60 transition-opacity hover:opacity-100"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 1, duration: 0.3 }}
          onClick={() => {
            setComplete(true);
            onComplete();
          }}
        >
          pular →
        </motion.button>
      </div>
    </motion.div>
  );
}
