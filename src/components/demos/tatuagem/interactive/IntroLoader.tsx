"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Splash de abertura fiel ao `<InitialLoader>` do material bruto: nome do
 * estúdio surge letra a letra (stagger 0.08s) seguido de uma linha de
 * acento crescendo — some depois de ~2s. Uma vez por sessão
 * (sessionStorage), pulada de vez em prefers-reduced-motion. `ativa`
 * (Theme.intro) desliga a splash por completo — o cursor contextual
 * continua (ver Skin.tsx).
 */
export function IntroLoader({
  nome,
  ativa,
  onComplete,
}: {
  nome: string;
  ativa: boolean;
  onComplete: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hasLoaded = sessionStorage.getItem("d-has-seen-intro");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!ativa || hasLoaded || reducedMotion) {
      const t = setTimeout(() => {
        setIsLoading(false);
        onComplete();
      }, 0);
      return () => clearTimeout(t);
    }

    const timer = setTimeout(() => {
      setIsLoading(false);
      sessionStorage.setItem("d-has-seen-intro", "true");
      onComplete();
    }, 2000);
    return () => clearTimeout(timer);
  }, [ativa, onComplete]);

  if (!isLoading) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="loader"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.4, ease: "easeInOut" } }}
        className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[var(--d-bg)]"
      >
        <motion.div
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.08 }}
          className="mb-6 ml-[0.05em] flex font-[family-name:var(--d-decorativa)] text-4xl tracking-tight text-[var(--d-text)] drop-shadow-md md:text-6xl"
        >
          {nome.split("").map((char, index) => (
            <motion.span
              key={index}
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
              }}
            >
              {char === " " ? " " : char}
            </motion.span>
          ))}
        </motion.div>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 120 }}
          transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
          className="h-px bg-[var(--d-accent)]"
        />
      </motion.div>
    </AnimatePresence>
  );
}
