"use client";

import { useEffect, useState } from "react";

import { OrderCta } from "./OrderCta";

/**
 * Header fiel ao original: transparente no topo, ganha fundo com blur e
 * borda ao passar de 50px de scroll. O botão de carrinho virou o CTA de
 * pedido neutro (ver OrderCta) — mesmo círculo de destaque, sem contador
 * de itens (não há carrinho de verdade na demo).
 */
export function Header({
  nome,
  whatsapp,
}: {
  nome: string;
  whatsapp: string | undefined;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        scrolled
          ? "border-b border-[var(--d-border)] bg-[var(--d-bg)]/80 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <a href="#topo" className="flex items-center gap-2">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--d-bg)] bg-[var(--d-accent-2)] font-[family-name:var(--d-display)] text-xl leading-none text-[var(--d-bg)]"
            aria-hidden="true"
          >
            {nome.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <span className="hidden font-[family-name:var(--d-display)] text-2xl uppercase tracking-tight text-[var(--d-text)] sm:block">
            {nome}
          </span>
        </a>

        <OrderCta
          whatsapp={whatsapp}
          mensagem="Olá! Gostaria de fazer um pedido."
          aria-label="Fazer pedido"
          className="d-cta-round d-cta-round-alt"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        </OrderCta>
      </div>
    </header>
  );
}
