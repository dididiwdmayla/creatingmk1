"use client";

import { useState } from "react";

import { CustomCursor } from "./CustomCursor";
import { IntroLoader } from "./IntroLoader";

/**
 * Orquestra a experiência de entrada: cursor customizado sempre montado +
 * o loader letra-a-letra (uma vez por sessão, desligado em
 * prefers-reduced-motion) — fiel ao app/page.tsx original. `ativa`
 * (Theme.intro, toggle do editor) desliga só a splash; o cursor continua.
 */
export function IntroExperience({
  nome,
  accent,
  ativa = true,
  children,
}: {
  nome: string;
  accent: string;
  ativa?: boolean;
  children: React.ReactNode;
}) {
  const [introFinished, setIntroFinished] = useState(false);

  return (
    <>
      <CustomCursor accent={accent} />
      {!introFinished && (
        <IntroLoader nome={nome} ativa={ativa} onComplete={() => setIntroFinished(true)} />
      )}
      <div className="relative z-10">{children}</div>
    </>
  );
}
