"use client";

import { createContext, useContext } from "react";

/**
 * Sinaliza pro Hero se a abertura está à mostra: `false` só enquanto o
 * preloader (velocímetro) cobre a tela, no cliente — quando ele termina, a
 * volta a `true` dispara a revelação escalonada das palavras (fiel ao
 * `heroIntro()` do material bruto). `true` por padrão e no HTML do
 * servidor (ver IntroExperience): sem provider, sem JavaScript ou sem
 * intro, a abertura nunca nasce escondida.
 */
const IntroDoneContext = createContext(true);

export const IntroDoneProvider = IntroDoneContext.Provider;

export function useIntroDone(): boolean {
  return useContext(IntroDoneContext);
}
