"use client";

import { type RefObject, useEffect, useState } from "react";

/** Estado de "deve rodar agora?" que todo componente de efeito consulta. */
export interface EfeitoAtivoState {
  /**
   * true quando o efeito deve estar animando: elemento na viewport, aba
   * visível e sem pedido de pausa externo (prop `pausado`). false não
   * significa "some" — o efeito congela na última posição/estado.
   */
  ativo: boolean;
  /**
   * prefers-reduced-motion ligado — o efeito deve renderizar estático
   * (sem listener/rAF de movimento nenhum), não só "pausado".
   */
  reducedMotion: boolean;
}

/**
 * Combina as três fontes de pausa do contrato de efeitos (ver ./types.ts):
 * IntersectionObserver (fora da viewport), visibilitychange (aba oculta) e
 * o sinal `pausado` explícito da prop — mais a leitura de
 * prefers-reduced-motion, que é "estático", não "pausado". `ref` é o
 * elemento-raiz do efeito, observado pelo IntersectionObserver.
 */
export function useEfeitoAtivo(
  ref: RefObject<HTMLElement | null>,
  pausadoExterno = false,
): EfeitoAtivoState {
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  // Otimista até o observer/documento confirmarem — evita um frame de
  // "pausado" no primeiro paint (o elemento normalmente já nasce visível).
  const [intersecting, setIntersecting] = useState(true);
  const [abaVisivel, setAbaVisivel] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIntersecting(entry?.isIntersecting ?? false),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  useEffect(() => {
    const onVisibility = () => setAbaVisivel(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return {
    ativo: intersecting && abaVisivel && !pausadoExterno,
    reducedMotion,
  };
}
