"use client";

import { useEffect, useState } from "react";

/**
 * Header fiel ao original: transparente no topo, ganha fundo com blur,
 * borda e sombra ao passar de 50px de scroll. "AGENDAR" é chrome fixo do
 * template (como no original, independente do texto do CTA do hero).
 */
export function ScrollHeader({
  nome,
  links,
  ctaHref,
}: {
  nome: string;
  links: { href: string; label: string }[];
  ctaHref: string;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Throttled por rAF: sem isso, o listener roda a cada evento nativo de
    // scroll (muitos por frame em scroll rápido/momentum no mobile),
    // competindo com o main thread — ver LedEdges.tsx (mesmo padrão).
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setScrolled(window.scrollY > 50);
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
      className={`fixed inset-x-0 top-0 z-40 border-b transition-all duration-300 ${
        scrolled
          ? "border-[var(--d-accent)]/20 bg-[var(--d-bg)]/90 py-4 shadow-xl backdrop-blur-md"
          : "border-transparent bg-transparent py-6"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
        <a
          href="#topo"
          className="font-[family-name:var(--d-deco)] text-[28px] tracking-[0.08em] text-[var(--d-accent)] transition-opacity hover:opacity-80"
        >
          {nome}
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-[family-name:var(--d-mono)] text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--d-muted)] transition-colors hover:text-[var(--d-accent)]"
            >
              {link.label}
            </a>
          ))}
          <a
            href={ctaHref}
            className="border border-[var(--d-accent)]/30 px-4 py-2 font-[family-name:var(--d-mono)] text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--d-text)] transition-colors hover:bg-[var(--d-accent)] hover:text-[var(--d-accent-ink)]"
          >
            AGENDAR
          </a>
        </nav>
      </div>
    </header>
  );
}
