"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "radar:tema"; // "claro" | "escuro" (default: escuro)

/**
 * O tema vive no DOM (data-theme no <html>, aplicado pelo script inline do
 * layout antes da pintura) — o componente só espelha esse estado externo,
 * via useSyncExternalStore (sem setState em effect).
 */
let listeners: Array<() => void> = [];

function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function lendoDoDom(): boolean {
  return document.documentElement.dataset.theme === "light";
}

// No servidor o HTML sai no default escuro; o snapshot real entra na hidratação.
function noServidor(): boolean {
  return false;
}

function aplicarTema(claro: boolean) {
  if (claro) {
    document.documentElement.dataset.theme = "light";
  } else {
    delete document.documentElement.dataset.theme;
  }
  try {
    localStorage.setItem(STORAGE_KEY, claro ? "claro" : "escuro");
  } catch {
    // sem localStorage (modo privado etc.): o tema vale só na sessão
  }
  for (const listener of listeners) listener();
}

export function ThemeToggle() {
  const claro = useSyncExternalStore(subscribe, lendoDoDom, noServidor);

  return (
    <button
      type="button"
      onClick={() => aplicarTema(!claro)}
      aria-label={claro ? "Mudar para o tema escuro" : "Mudar para o tema claro"}
      title={claro ? "Tema escuro" : "Tema claro"}
      className="text-sm leading-none text-ink-muted hover:text-foreground"
    >
      {claro ? "☾" : "☀"}
    </button>
  );
}
