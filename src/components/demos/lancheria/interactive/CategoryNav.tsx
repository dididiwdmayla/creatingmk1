"use client";

import { useEffect, useState } from "react";

type Categoria = { id: string; label: string };

/**
 * Nav de categorias sticky, fiel ao original: pills com estado ativo
 * conforme a seção visível no scroll, rolagem suave ao clicar. As
 * categorias vêm de fora (rótulo de cada seção, na ordem efetiva) — nada
 * hardcoded aqui além do comportamento de scroll.
 */
export function CategoryNav({ categorias }: { categorias: Categoria[] }) {
  const [activeId, setActiveId] = useState(categorias[0]?.id);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150;
      for (const cat of categorias) {
        const el = document.getElementById(cat.id);
        if (el) {
          const { offsetTop, offsetHeight } = el;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveId(cat.id);
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  if (categorias.length === 0) return null;

  return (
    <nav className="sticky top-16 z-30 w-full border-y border-[var(--d-border)] bg-[var(--d-bg)]/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4">
        <ul className="scrollbar-hide flex items-center gap-3 overflow-x-auto py-3 md:gap-6">
          {categorias.map((cat) => (
            <li key={cat.id} className="shrink-0">
              <button
                type="button"
                onClick={() => scrollToSection(cat.id)}
                className={`rounded-full px-5 py-2 font-[family-name:var(--d-corpo)] text-[10px] font-bold uppercase tracking-wide transition-all md:text-xs ${
                  activeId === cat.id
                    ? "bg-[var(--d-accent-2)] italic text-[var(--d-bg)] shadow-md"
                    : "border border-[var(--d-border)] text-[var(--d-muted)] hover:bg-[var(--d-bg-alt)]"
                }`}
              >
                {cat.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
