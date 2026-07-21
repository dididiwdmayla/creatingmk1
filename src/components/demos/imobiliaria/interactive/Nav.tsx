"use client";

import { useEffect, useState } from "react";

/**
 * Header fiel ao original: sempre translúcido com blur (não há estado
 * "transparente no topo" — o original já nasce com fundo semi-opaco), só
 * a COR troca conforme a seção sob a barra (`[data-nav-theme="light"|
 * "dark"]`, marcado pela própria skin em cada `<section>`). O critério de
 * detecção é idêntico ao original: a seção cujo topo está a 50px ou menos
 * do topo da viewport e ainda não terminou. As cores em si (claro/escuro)
 * vêm de CSS puro (`[data-nav-escura]` no `<style>` de Skin.tsx, usando as
 * mesmas CSS vars do tema) — este componente só decide QUAL estado vale.
 */
export function Nav({
  nome,
  links,
}: {
  nome: string;
  links: { href: string; label: string }[];
}) {
  const [escura, setEscura] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const secoes = document.querySelectorAll<HTMLElement>("[data-nav-theme]");
        let tema = "light";
        for (const el of secoes) {
          const r = el.getBoundingClientRect();
          if (r.top <= 50 && r.bottom > 50) {
            tema = el.getAttribute("data-nav-theme") ?? "light";
            break;
          }
        }
        setEscura(tema === "dark");
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
      data-nav-escura={escura}
      className="d-nav fixed inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-4 backdrop-blur-md transition-colors duration-500 md:px-10"
    >
      <a
        href="#topo"
        className="font-[family-name:var(--d-deco)] text-2xl italic tracking-tight text-[var(--d-nav-fg)] transition-colors duration-500"
      >
        {nome}
      </a>
      <div className="hidden items-center gap-8 text-sm font-medium md:flex">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="text-[var(--d-nav-fg)]/85 transition-colors hover:text-[var(--d-nav-fg)]"
          >
            {link.label}
          </a>
        ))}
      </div>
      <a
        href="#contato"
        className="d-nav-cta group inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold transition-[padding] duration-300"
      >
        Fale com a gente
        <span className="ml-0 inline-block w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:ml-2 group-hover:w-4 group-hover:opacity-100">
          →
        </span>
      </a>
    </nav>
  );
}
