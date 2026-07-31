"use client";

import dynamic from "next/dynamic";

import type { EfeitoComponente } from "./types";

/**
 * Resolve o componente de um efeito por id — SEMPRE por import dinâmico
 * sem SSR (nunca bloqueia o first paint da demo; efeitos usam window/
 * canvas/IntersectionObserver, que não existem no server de qualquer
 * forma). Cada `dynamic(() => import(...))` fica escrito por extenso e no
 * nível superior do módulo — é o que o bundler precisa pra casar o chunk
 * com a chamada e poder fazer code-splitting de verdade (ver
 * node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md).
 */
const AuraDinamico = dynamic(() => import("./aura/Aura").then((m) => m.Aura), { ssr: false });

const COMPONENTES_DINAMICOS: Record<string, EfeitoComponente> = {
  aura: AuraDinamico,
};

export function getEfeitoComponenteDinamico(id: string): EfeitoComponente | undefined {
  return COMPONENTES_DINAMICOS[id];
}
