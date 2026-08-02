"use client";

import { useEffect, useState } from "react";

import { microcopiaDemo } from "@/lib/demos/microcopy";
import { OrderCta } from "./OrderCta";

/**
 * Header fiel ao original (`.nav-bar`/`nav.js`): transparente no topo,
 * ganha fundo translúcido com blur ao passar de ~24px de scroll. O
 * material bruto tem links para páginas irmãs (Serviços/Sobre/Contato) —
 * fora do escopo de uma demo de página única (ver Skin.tsx); o botão
 * "Agendar" virou o CTA de agendamento neutro (ver OrderCta).
 */
export function Header({
  nome,
  whatsapp,
  idioma,
}: {
  nome: string;
  whatsapp: string | undefined;
  idioma?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const m = microcopiaDemo(idioma);

  useEffect(() => {
    // Throttled por rAF — mesmo padrão de LedEdges.tsx: sem isso, o
    // listener roda a cada evento nativo de scroll.
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setScrolled(window.scrollY > 24);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
        scrolled ? "shadow-[0_1px_0_var(--d-border)] backdrop-blur-lg" : ""
      }`}
      style={{ backgroundColor: scrolled ? "color-mix(in srgb, var(--d-bg) 88%, transparent)" : "transparent" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <a
          href="#topo"
          className="font-[family-name:var(--d-display)] text-2xl text-[var(--d-text)]"
          style={{ letterSpacing: "-0.01em" }}
        >
          {nome}
        </a>

        {/* Visibilidade responsiva no wrapper, não no próprio botão: as
            classes utilitárias `.d-cta-pill`/`.d-cta-round` (definidas no
            <style> da skin) e os utilitários `hidden`/`sm:*` do Tailwind
            têm a MESMA especificidade — combinados no mesmo elemento, a
            ordem de origem decide o empate, e o <style> da skin (que vem
            depois da folha do Tailwind no documento) venceria sempre,
            deixando os dois CTAs visíveis ao mesmo tempo. */}
        <span className="hidden sm:inline-flex">
          <OrderCta
            whatsapp={whatsapp}
            mensagem="Olá! Gostaria de agendar um horário para o meu pet."
            idioma={idioma}
            className="d-cta-pill"
          >
            Agendar
          </OrderCta>
        </span>
        <span className="sm:hidden">
          <OrderCta
            whatsapp={whatsapp}
            mensagem="Olá! Gostaria de agendar um horário para o meu pet."
            idioma={idioma}
            aria-label={m.agendarHorario}
            className="d-cta-round"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="3" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </OrderCta>
        </span>
      </div>
    </header>
  );
}
