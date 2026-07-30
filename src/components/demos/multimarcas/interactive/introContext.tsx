"use client";

import { createContext, useContext } from "react";

/**
 * Sinaliza pro Hero quando o preloader (velocímetro) terminou, pra disparar
 * a revelação escalonada das palavras do título (fiel ao `heroIntro()` do
 * material bruto). `true` por padrão (sem provider = revelado, usado no
 * preview do editor e em qualquer render fora de IntroExperience).
 */
const IntroDoneContext = createContext(true);

export const IntroDoneProvider = IntroDoneContext.Provider;

export function useIntroDone(): boolean {
  return useContext(IntroDoneContext);
}
