"use client";

import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";

import { microcopiaDemo } from "@/lib/demos/microcopy";

/**
 * CTA de agendamento neutro — substitui os botões "Agendar horário" que,
 * no material bruto, abriam o wizard de agendamento em `agendamento.html`
 * (calendário + horários + Mercado Pago, fora do escopo da Forja: só as
 * páginas públicas visuais são convertidas).
 *
 * Configurável pelo próprio dado do lead, sem flag nova no contrato:
 * havendo `whatsapp` em DemoData, o botão vira link `wa.me` com a
 * mensagem pronta (agendamento real acontece via WhatsApp); sem número,
 * mostra um toast "Disponível na versão completa" — mesmo padrão usado
 * em `lancheria/interactive/OrderCta.tsx`.
 */
export function orderWaHref(whatsapp: string | undefined, mensagem: string): string | undefined {
  const digitos = (whatsapp ?? "").replace(/\D/g, "");
  if (!digitos) return undefined;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensagem)}`;
}

type Props = {
  whatsapp: string | undefined;
  mensagem: string;
  className?: string;
  slot?: string;
  children: ReactNode;
  idioma?: string;
  "aria-label"?: string;
};

export function OrderCta({ whatsapp, mensagem, className, slot, children, idioma, ...aria }: Props) {
  const [toastAberto, setToastAberto] = useState(false);
  const m = microcopiaDemo(idioma);
  const href = orderWaHref(whatsapp, mensagem);

  useEffect(() => {
    if (!toastAberto) return;
    const timer = setTimeout(() => setToastAberto(false), 2600);
    return () => clearTimeout(timer);
  }, [toastAberto]);

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-demo-slot={slot}
        className={className}
        {...aria}
      >
        {children}
      </a>
    );
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setToastAberto(true)}
        data-demo-slot={slot}
        className={className}
        {...aria}
      >
        {children}
      </button>
      <AnimatePresence>
        {toastAberto && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 w-max max-w-[220px] -translate-x-1/2 rounded-[var(--d-radius)] bg-[var(--d-bg-elev)] px-4 py-2 text-center font-[family-name:var(--d-corpo)] text-xs font-medium text-[var(--d-text)] shadow-xl"
            style={{ border: "1px solid var(--d-border)" }}
          >
            {m.disponivelNaVersaoCompleta}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
