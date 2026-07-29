"use client";

import { useEffect, useState } from "react";

import { CustomCursor } from "./CustomCursor";
import { IntroDoneProvider } from "./introContext";
import { Preloader } from "./Preloader";

const SESSION_KEY = "demo-multimarcas-intro-vista";

/**
 * Orquestra a entrada do site: cursor customizado sempre montado + o
 * preloader "velocímetro" (uma vez por sessão, desligado em
 * prefers-reduced-motion) — fiel ao `runPreloader`/`componentDidMount` do
 * material bruto. `ativa` (Theme.intro) desliga só o preloader; o cursor
 * contextual continua. `introDone` fica disponível pros filhos via contexto
 * (o Hero usa pra disparar a revelação escalonada do título).
 */
export function IntroExperience({
  nome,
  accent,
  ativa,
  children,
}: {
  nome: string;
  accent: string;
  ativa: boolean;
  children: React.ReactNode;
}) {
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const jaViu = sessionStorage.getItem(SESSION_KEY);
    const reduzida = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!ativa || reduzida || jaViu) {
      const t = setTimeout(() => setIntroDone(true), 0);
      return () => clearTimeout(t);
    }
  }, [ativa]);

  const mostrandoPreloader = ativa && !introDone;

  function completar() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setIntroDone(true);
  }

  return (
    <>
      <CustomCursor accent={accent} />
      {mostrandoPreloader && <Preloader nome={nome} accent={accent} onComplete={completar} />}
      <IntroDoneProvider value={introDone}>{children}</IntroDoneProvider>
    </>
  );
}
