"use client";

import { useState } from "react";

import type { DemoItem } from "@/lib/demos/types";

/**
 * Acordeão de perguntas — fiel ao material bruto: um item aberto por vez
 * (o primeiro já nasce aberto, `state = { open: 0 }` no original),
 * `grid-template-rows` 0fr→1fr para a transição de altura sem medir
 * pixel, ícone "+" que gira 45° virando "×", ponto colorido que só
 * preenche quando aberto (cor do ciclo de acentos do tema).
 */
export function FaqAccordion({
  itens,
  slotBase,
  accentCycle,
}: {
  itens: DemoItem[];
  slotBase: string;
  accentCycle: string[];
}) {
  const [aberto, setAberto] = useState<number>(itens.length > 0 ? 0 : -1);

  return (
    <div className="border-t border-[var(--d-border)]">
      {itens.map((item, i) => {
        const isOpen = aberto === i;
        const cor = accentCycle[i % accentCycle.length];
        return (
          <div key={i} className="border-b border-[var(--d-border)]">
            <button
              type="button"
              onClick={() => setAberto(isOpen ? -1 : i)}
              className="flex w-full items-center gap-4 py-6 text-left font-[family-name:var(--d-corpo)] transition-colors"
              aria-expanded={isOpen}
            >
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full border-[1.6px] transition-colors duration-300"
                style={{
                  borderColor: cor,
                  backgroundColor: isOpen ? cor : "transparent",
                }}
              />
              <span
                data-demo-slot={`${slotBase}.${i}.titulo`}
                className="flex-1 text-lg font-semibold text-[var(--d-text)] md:text-xl"
              >
                {item.titulo}
              </span>
              <span
                aria-hidden="true"
                className="font-[family-name:var(--d-display)] text-xl transition-transform duration-300"
                style={{
                  color: cor,
                  transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                }}
              >
                +
              </span>
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-[450ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                {item.texto && (
                  <p
                    data-demo-slot={`${slotBase}.${i}.texto`}
                    className="max-w-[60ch] pb-6 pl-[26px] text-[15px] leading-relaxed text-[var(--d-muted)]"
                  >
                    {item.texto}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
