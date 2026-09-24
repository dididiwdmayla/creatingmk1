"use client";

import { AnimatePresence, motion } from "motion/react";
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
 *
 * **O documento servido nunca é escondido** (item 4 da sessão de fundação):
 * `mostrando` é ESTADO, com valor inicial `false` — o mesmo em SSR e no
 * primeiro paint do cliente — e só vira `true` dentro de um `useEffect`
 * (nunca computado direto no corpo do render). Com `intro: true`, a versão
 * antiga calculava `mostrando` na hora — `ativa && !reduzida && !terminado`,
 * com `terminado` começando em `false` — então o próprio HTML do servidor
 * já saía com a camada `fixed inset-0` opaca cobrindo a página. Mesmo
 * defeito do preloader da multimarcas, mesmo remédio (`IntroExperience.tsx`
 * de lá): o efeito que liga a splash roda só no cliente, depois da
 * hidratação, e nunca antes dela.
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
  const [mostrando, setMostrando] = useState(false);

  useEffect(() => {
    if (!ativa) return;
    const jaViu = sessionStorage.getItem(SESSION_KEY);
    const reduzida = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzida || jaViu) return;
    // Adiado pro próximo tick: setState síncrono no corpo do efeito é o
    // que o lint de hooks reprova (mesmo padrão das outras skins).
    const t = setTimeout(() => setMostrando(true), 0);
    return () => clearTimeout(t);
  }, [ativa]);

  function completar() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setMostrando(false);
  }

  useEffect(() => {
    if (!mostrando) return;
    const t = setTimeout(completar, DURACAO_MS);
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
