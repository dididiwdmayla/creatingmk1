"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Nav fixa que troca de tema (claro/escuro) conforme a seção visível sob
 * ela — fiel ao original (`data-nav-theme` em cada `<section>` + o loop de
 * `getBoundingClientRect` a 50px do topo). As cores dos dois modos vêm de
 * `color-mix()` sobre os tokens do tema no `<style>` de Skin.tsx
 * (`.d-nav[data-theme="dark"]`), não hardcoded aqui — só a leitura de
 * scroll é imperativa (throttled por rAF, mesmo padrão de LedEdges.tsx).
 */
export function Nav({
  nome,
  itens,
  ctaLabel,
}: {
  nome: string;
  itens: { href: string; label: string }[];
  ctaLabel: string | undefined;
}) {
  const [tema, setTema] = useState<"light" | "dark">("light");
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        let proximo: "light" | "dark" = "light";
        for (const secao of document.querySelectorAll<HTMLElement>("[data-nav-theme]")) {
          const r = secao.getBoundingClientRect();
          if (r.top <= 50 && r.bottom > 50) {
            proximo = (secao.dataset.navTheme as "light" | "dark") ?? "light";
            break;
          }
        }
        setTema((atual) => (atual === proximo ? atual : proximo));
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
    <nav
      ref={navRef}
      data-theme={tema}
      className="d-nav fixed inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-[18px] backdrop-blur-md sm:px-10"
    >
      <a
        href="#topo"
        className="font-[family-name:var(--d-display)] text-2xl italic font-semibold tracking-tight"
      >
        {nome}
      </a>
      <div className="hidden items-center gap-8 text-[15px] font-medium md:flex">
        {itens.map((item) => (
          <a key={item.href} href={item.href} className="opacity-85 transition-opacity hover:opacity-100">
            {item.label}
          </a>
        ))}
      </div>
      {ctaLabel && (
        <a
          href="#contato"
          data-cta
          className="d-nav-cta d-arrow-cta inline-flex items-center rounded-full px-[22px] py-[11px] text-[15px] font-semibold transition-[padding,background,color] duration-300 hover:pr-[26px]"
        >
          {ctaLabel}
          <span className="d-arrow-cta-tail">&nbsp;→</span>
        </a>
      )}
    </nav>
  );
}
