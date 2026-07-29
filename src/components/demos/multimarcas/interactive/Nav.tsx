"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { waHref } from "./logic";

export interface NavLink {
  id: string;
  rotulo: string;
}

/**
 * Nav fixa fiel ao material bruto: fundo transparente até `scrollY > 80`
 * (blur + borda depois), links gerados a partir das seções visíveis
 * (`rotulo`, na ordem efetiva — nunca uma lista fixa), burger que abre um
 * overlay fullscreen com os mesmos links numerados e stagger de entrada.
 * O breakpoint desktop/mobile vira responsivo via Tailwind (`md:`) em vez
 * do `matchMedia` imperativo do original — mesmo resultado visual.
 */
export function Nav({ nome, links, whatsapp }: { nome: string; links: NavLink[]; whatsapp?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = aberto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [aberto]);

  return (
    <>
      <nav
        className="fixed inset-x-0 top-0 z-[900] flex items-center justify-between border-b px-[max(24px,4vw)] py-3.5 transition-[background-color,border-color,backdrop-filter] duration-[400ms]"
        style={{
          paddingTop: "calc(14px + env(safe-area-inset-top))",
          background: scrolled ? "color-mix(in srgb, var(--d-bg) 80%, transparent)" : "transparent",
          backdropFilter: scrolled ? "blur(14px)" : "none",
          borderBottomColor: scrolled ? "var(--d-border)" : "transparent",
        }}
      >
        <a
          href="#topo"
          data-demo-slot="nome"
          className="d-press inline-block font-[family-name:var(--d-display)] text-[22px] font-extrabold tracking-[3px] text-[var(--d-text)] transition-[letter-spacing] duration-300 hover:tracking-[5px]"
        >
          {nome.toUpperCase()}
          <span className="text-[var(--d-accent)]">.</span>
        </a>

        <div className="hidden items-center gap-[34px] md:flex">
          {links.map((l, i) => {
            const ultimo = i === links.length - 1;
            return (
              <a
                key={l.id}
                href={`#${l.id}`}
                className={
                  ultimo
                    ? "d-press rounded-full border px-5 py-2.5 font-[family-name:var(--d-corpo)] text-xs font-semibold tracking-[2.5px] text-[var(--d-text)] transition-colors hover:bg-[var(--d-accent)] hover:text-[var(--d-accent-ink)]"
                    : "font-[family-name:var(--d-corpo)] text-xs font-semibold tracking-[2.5px] text-[var(--d-text)]/70 transition-colors hover:text-[var(--d-accent)]"
                }
                style={ultimo ? { borderColor: "color-mix(in srgb, var(--d-accent) 55%, transparent)" } : undefined}
              >
                {l.rotulo.toUpperCase()}
              </a>
            );
          })}
        </div>

        <button
          type="button"
          aria-label={aberto ? "Fechar menu" : "Menu"}
          onClick={() => setAberto((v) => !v)}
          className="relative z-[960] block h-11 w-11 p-2.5 md:hidden"
        >
          <span
            className="block h-0.5 w-6 origin-center bg-[var(--d-text)] transition-transform duration-300"
            style={{ transform: aberto ? "translateY(4.5px) rotate(45deg)" : "none" }}
          />
          <span
            className="mt-[7px] block h-0.5 w-6 origin-center bg-[var(--d-text)] transition-[transform,opacity] duration-300"
            style={{ transform: aberto ? "translateY(-4.5px) rotate(-45deg)" : "none" }}
          />
        </button>
      </nav>

      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-[950] flex flex-col justify-center px-[max(28px,8vw)]"
            style={{ background: "color-mix(in srgb, var(--d-bg) 98%, transparent)" }}
          >
            <div className="pointer-events-none absolute inset-0 opacity-[0.05]" aria-hidden="true">
              <div
                className="h-full w-full"
                style={{
                  backgroundImage: "radial-gradient(var(--d-text) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
            </div>
            <div className="relative flex flex-col gap-1.5">
              {links.map((l, i) => (
                <motion.a
                  key={l.id}
                  href={`#${l.id}`}
                  onClick={() => setAberto(false)}
                  initial={{ opacity: 0, x: 34, y: 22 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.08 + i * 0.065, ease: [0.2, 0.9, 0.25, 1] }}
                  className="flex items-baseline gap-3.5 py-2 font-[family-name:var(--d-display)] text-4xl font-bold tracking-tight text-[var(--d-text)] md:text-5xl"
                >
                  <span className="font-[family-name:var(--d-mono)] text-[13px] font-semibold tabular-nums text-[var(--d-accent)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {l.rotulo.toUpperCase()}
                </motion.a>
              ))}
              <motion.a
                href={waHref(whatsapp, "Olá! Vim pelo site e quero mais informações.")}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, x: 34, y: 22 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.55, delay: 0.08 + links.length * 0.065, ease: [0.2, 0.9, 0.25, 1] }}
                className="mt-6 inline-flex items-center gap-2.5 font-[family-name:var(--d-corpo)] text-sm font-semibold text-[var(--d-accent)]"
              >
                Falar no WhatsApp →
              </motion.a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
