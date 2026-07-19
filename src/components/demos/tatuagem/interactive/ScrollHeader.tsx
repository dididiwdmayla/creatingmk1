"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { Wordmark } from "../Wordmark";

/**
 * Header fixo fiel ao original: transparente no topo, ganha fundo
 * translúcido com blur e borda ao passar de 50px de scroll. Entra com
 * slide-down suave (fiel ao `initial={{ y: -100 }}` do original).
 */
export function ScrollHeader({
  nome,
  links,
  ctaHref,
  ctaLabel,
}: {
  nome: string;
  links: { href: string; label: string }[];
  ctaHref: string;
  ctaLabel: string;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        scrolled
          ? "border-b border-[var(--d-border)] bg-[var(--d-bg)]/90 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
    >
      <div className="mx-auto flex h-24 max-w-7xl items-center justify-between px-6">
        <a href="#topo" className="pointer-events-auto">
          <Wordmark
            nome={nome}
            className="text-[26px] tracking-[0.05em] md:text-[30px]"
          />
        </a>

        <nav className="hidden items-center gap-10 font-[family-name:var(--d-mono)] text-[11px] uppercase tracking-widest text-[var(--d-muted)] md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative py-2 transition-colors hover:text-[var(--d-text)]"
            >
              {link.label}
              <span className="absolute bottom-0 left-0 h-px w-0 bg-[var(--d-accent)] transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
          <a
            href={ctaHref}
            className="ml-4 border border-[var(--d-border)] px-6 py-3 text-[var(--d-text)] transition-all duration-400 hover:bg-[var(--d-text)] hover:text-[var(--d-bg)]"
          >
            {ctaLabel}
          </a>
        </nav>
      </div>
    </motion.header>
  );
}
