"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";

const SESSION_KEY = "demo-lancheria-intro-vista";
const DURACAO_MS = 1100;

/**
 * Splash de abertura opcional (Theme.intro) — o material bruto não tinha
 * nenhuma (a página carrega direto no Hero), então o toggle fica desligado
 * em todos os presets por padrão; se o editor ligar, mostra uma revelação
 * curta da marca (chrome fixo, sem dependência de dado do lead além do
 * nome). Uma vez por sessão (sessionStorage), igual às demais skins (ver
 * IntroExperience das outras skins para o mesmo padrão de efeito).
 */
export function IntroExperience({
  nome,
  accent,
  ink,
  ativa,
  children,
}: {
  nome: string;
  accent: string;
  ink: string;
  ativa: boolean;
  children: ReactNode;
}) {
  const reduzida = useReducedMotion();
  const [terminado, setTerminado] = useState(false);

  // Pula a splash (fora do escopo, já vista na sessão, ou reduced-motion)
  // — setState adiado pro próximo tick pra não rodar sincronamente no
  // corpo do efeito (mesmo padrão de CustomCursor.tsx/IntroExperience das
  // outras skins).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const jaViu = sessionStorage.getItem(SESSION_KEY);
    if (!ativa || reduzida || jaViu) {
      const t = setTimeout(() => setTerminado(true), 0);
      return () => clearTimeout(t);
    }
  }, [ativa, reduzida]);

  const mostrando = ativa && !reduzida && !terminado;

  useEffect(() => {
    if (!mostrando) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    const t = setTimeout(() => setTerminado(true), DURACAO_MS);
    return () => clearTimeout(t);
  }, [mostrando]);

  return (
    <>
      <AnimatePresence>
        {mostrando && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ backgroundColor: "var(--d-bg)" }}
            aria-hidden="true"
          >
            <motion.span
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-full px-8 py-4 font-[family-name:var(--d-display)] text-2xl uppercase tracking-tight md:text-4xl"
              style={{ backgroundColor: accent, color: ink }}
            >
              {nome}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}
