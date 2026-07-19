"use client";

import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";

/**
 * CTA de pedido neutro — substitui os botões de carrinho/checkout do
 * material bruto (que dependiam de Mercado Pago + painel de comandas,
 * fora do escopo da Forja: só páginas públicas visuais são convertidas).
 *
 * Configurável pelo próprio dado do lead, sem flag nova no contrato:
 * havendo `whatsapp` em DemoData, o botão vira link `wa.me` com a
 * mensagem pronta (pedido real funciona via WhatsApp); sem número, mostra
 * um toast "Disponível na versão completa" — o mesmo padrão visual de
 * toast do material bruto (cartão creme, entrada com slide+fade), só que
 * sem o carrinho por trás.
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
  "aria-label"?: string;
};

export function OrderCta({ whatsapp, mensagem, className, slot, children, ...aria }: Props) {
  const [toastAberto, setToastAberto] = useState(false);
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
            Disponível na versão completa
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
