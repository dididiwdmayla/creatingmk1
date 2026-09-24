import type { CSSProperties } from "react";

import type { DemoItem } from "@/lib/demos/types";

/**
 * Acordeão de perguntas — `<details>/<summary>` nativo (item 4 da sessão de
 * fundação): a versão anterior guardava o item aberto em `useState`, então
 * sem JavaScript só a pergunta 0 abria — as respostas 2–4 ficavam
 * inalcançáveis para quem lê o documento servido (o robô de prospecção
 * incluído). `<details>` abre/fecha sem uma linha de script; o primeiro
 * item nasce aberto (`open`, fiel ao `state = { open: 0 }` do material
 * bruto), o ícone "+"→"×" gira via `[open]` no CSS, e o ponto colorido
 * preenche do mesmo jeito.
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
  return (
    <div className="border-t border-[var(--d-border)]">
      {itens.map((item, i) => {
        const cor = accentCycle[i % accentCycle.length];
        return (
          <details key={i} className="group border-b border-[var(--d-border)]" open={i === 0}>
            <summary className="flex cursor-pointer list-none items-center gap-4 py-6 font-[family-name:var(--d-corpo)] marker:content-none [&::-webkit-details-marker]:hidden">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full border-[1.6px] transition-colors duration-300 group-open:[background-color:var(--d-dot)]"
                style={{ borderColor: cor, "--d-dot": cor } as CSSProperties}
              />
              <span
                data-demo-slot={`${slotBase}.${i}.titulo`}
                className="flex-1 text-lg font-semibold text-[var(--d-text)] md:text-xl"
              >
                {item.titulo}
              </span>
              <span
                aria-hidden="true"
                className="font-[family-name:var(--d-display)] text-xl transition-transform duration-300 group-open:rotate-45"
                style={{ color: cor }}
              >
                +
              </span>
            </summary>
            {item.texto && (
              <p
                data-demo-slot={`${slotBase}.${i}.texto`}
                className="max-w-[60ch] pb-6 pl-[26px] text-[15px] leading-relaxed text-[var(--d-muted)]"
              >
                {item.texto}
              </p>
            )}
          </details>
        );
      })}
    </div>
  );
}
