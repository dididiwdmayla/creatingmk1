"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";

const SESSION_KEY = "demo-petshop-intro-vista";
// Fiel ao timing do material bruto (assets/js/transitions.js: playIntro):
// "au au" entra aos 100ms, "miau miau" aos 500ms, a cortina sobe aos 1550ms.
const PALAVRA_2_DELAY_MS = 400;
const SAIDA_DELAY_MS = 1450;
const SAIDA_DURACAO_MS = 500;

/**
 * Splash de sessão (Theme.intro) — porte fiel do overlay "au au / miau
 * miau" do material bruto (fundo roxo cheio de tela, duas palavras
 * saltitantes em sequência, depois a cortina sobe revelando a página).
 * "au au"/"miau miau" são flavor de marca do template (como o "ROLE" da
 * lancheria ou o "FEITO COM OBSESSÃO" do rodapé dela) — chrome decorativo,
 * não dado do lead. Uma vez por sessão, mesmo padrão das demais skins.
 */
export function IntroExperience({
  fundo,
  palavra1Cor,
  palavra2Cor,
  ativa,
  children,
}: {
  /** Cor de fundo do overlay (fiel ao original: acentoSecundario). */
  fundo: string;
  /** Cor de "au au" (fiel ao original: acentoTerciario). */
  palavra1Cor: string;
  /** Cor de "miau miau" (fiel ao original: destaque). */
  palavra2Cor: string;
  ativa: boolean;
  children: ReactNode;
}) {
  const reduzida = useReducedMotion();
  const [terminado, setTerminado] = useState(false);

  // Pula a splash (fora do escopo, já vista na sessão, ou reduced-motion)
  // — setState adiado pro próximo tick pra não rodar sincronamente no
  // corpo do efeito (mesmo padrão de CustomCursor.tsx nas demais skins).
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
    // Dispara a saída aos SAIDA_DELAY_MS — a duração da própria animação de
    // saída (SAIDA_DURACAO_MS, no `transition` do motion.div abaixo) já
    // soma o tempo até o overlay sumir de fato; um `delay` A MAIS ali
    // dobraria a espera.
    const t = setTimeout(() => setTerminado(true), SAIDA_DELAY_MS);
    return () => clearTimeout(t);
  }, [mostrando]);

  return (
    <>
      <AnimatePresence>
        {mostrando && (
          <motion.div
            initial={{ y: 0 }}
            exit={{ y: "-102%" }}
            transition={{ duration: SAIDA_DURACAO_MS / 1000, ease: [0.7, 0, 0.2, 1] }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden text-center leading-[0.95]"
            style={{ backgroundColor: fundo }}
            aria-hidden="true"
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.3, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              className="font-[family-name:var(--d-display)] text-[clamp(3.5rem,13vw,9.5rem)] italic"
              style={{ color: palavra1Cor }}
            >
              au au
            </motion.span>
            <motion.span
              initial={{ opacity: 0, scale: 0.3, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                delay: PALAVRA_2_DELAY_MS / 1000,
                duration: 0.5,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              className="font-[family-name:var(--d-display)] text-[clamp(3.5rem,13vw,9.5rem)] italic"
              style={{ color: palavra2Cor }}
            >
              miau miau
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}
