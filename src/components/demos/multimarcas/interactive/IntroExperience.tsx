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
 * contextual continua.
 *
 * **O documento servido nunca é escondido.** O HTML do servidor sai SEM o
 * preloader e com `revelado = true`: o nome no `<h1>`, o texto e os CTAs
 * da abertura já visíveis, como na barbearia ("intro não é barreira sem
 * JavaScript"). Só depois da hidratação, e só se a intro vai MESMO rodar
 * (ligada, sem reduced-motion, primeira vez na sessão), o preloader monta
 * por cima e a abertura se recolhe atrás dele — para subir palavra a
 * palavra quando o ponteiro chega ao fim. Sem JavaScript, ou com a intro
 * desligada (três das quatro variantes), nada é recolhido.
 */
export function IntroExperience({
  nome,
  accent,
  ativa,
  idioma,
  children,
}: {
  nome: string;
  accent: string;
  ativa: boolean;
  idioma?: string;
  children: React.ReactNode;
}) {
  const [preloader, setPreloader] = useState(false);

  useEffect(() => {
    if (!ativa) return;
    const jaViu = sessionStorage.getItem(SESSION_KEY);
    const reduzida = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzida || jaViu) return;
    // Adiado pro próximo tick: setState síncrono no corpo do efeito é o
    // que o lint de hooks reprova (mesmo padrão das outras skins).
    const t = setTimeout(() => setPreloader(true), 0);
    return () => clearTimeout(t);
  }, [ativa]);

  function completar() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setPreloader(false);
  }

  return (
    <>
      <CustomCursor accent={accent} />
      {preloader && <Preloader nome={nome} accent={accent} idioma={idioma} onComplete={completar} />}
      <IntroDoneProvider value={!preloader}>{children}</IntroDoneProvider>
    </>
  );
}
