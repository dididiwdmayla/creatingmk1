"use client";

import { useEffect, useState } from "react";

import { CustomCursor } from "./CustomCursor";
import { IntroAnimation } from "./IntroAnimation";

/**
 * Orquestra a experiência de entrada do site: cursor customizado sempre
 * montado + a animação de intro (uma vez por sessão, pulável, desligada
 * em prefers-reduced-motion) — fiel ao app/page.tsx original. O conteúdo
 * (`children`) já fica no DOM por baixo, revelado quando a navalha "abre".
 */
export function IntroExperience({
  nome,
  cidade,
  accent,
  children,
}: {
  nome: string;
  cidade?: string;
  accent: string;
  children: React.ReactNode;
}) {
  const [introFinished, setIntroFinished] = useState(false);

  useEffect(() => {
    const hasSeenIntro = sessionStorage.getItem("d-has-seen-intro");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (hasSeenIntro || reducedMotion) {
      const t = setTimeout(() => setIntroFinished(true), 0);
      return () => clearTimeout(t);
    }
  }, []);

  function handleIntroComplete() {
    sessionStorage.setItem("d-has-seen-intro", "true");
    setIntroFinished(true);
  }

  return (
    <>
      <CustomCursor accent={accent} />
      {!introFinished && (
        <IntroAnimation nome={nome} cidade={cidade} accent={accent} onComplete={handleIntroComplete} />
      )}
      <div className="relative z-0">{children}</div>
    </>
  );
}
