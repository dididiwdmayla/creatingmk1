"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";

import { CustomCursor } from "./CustomCursor";

const SESSION_KEY = "demo-tatuagem2-intro-vista";
const DURACAO_MS = 900;

/**
 * Cursor customizado sempre montado + splash de abertura OPCIONAL
 * (Theme.intro): o material bruto (skins-raw/tatuagem2) não tem loader de
 * entrada — a página carrega direto no hero, com os blobs e o traço
 * animando via CSS — então o toggle fica desligado por padrão em todos os
 * presets (mesmo critério da lancheria); se o editor ligar, mostra uma
 * revelação curta do nome em DM Serif Display sobre o fundo do tema. Uma
 * vez por sessão (sessionStorage), pulada em prefers-reduced-motion.
 */
export function IntroExperience({
  nome,
  ativa,
  children,
}: {
  nome: string;
  ativa: boolean;
  children: ReactNode;
}) {
  const reduzida = useReducedMotion();
  const [terminado, setTerminado] = useState(false);

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
      <CustomCursor />
      <AnimatePresence>
        {mostrando && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4, ease: "easeInOut" } }}
            className="fixed inset-0 z-[10000] flex items-center justify-center"
            style={{ backgroundColor: "var(--d-bg)" }}
            aria-hidden="true"
          >
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="font-[family-name:var(--d-display)] text-4xl text-[var(--d-text)] md:text-6xl"
            >
              {nome}
              <span style={{ color: "var(--d-accent)" }}>.</span>
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}
