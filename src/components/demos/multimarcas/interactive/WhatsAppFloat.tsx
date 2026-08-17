"use client";

import { useEffect, useRef, useState } from "react";

import { waHref } from "./logic";

/**
 * Botão flutuante de WhatsApp: aparece depois que o hero rola pra fora
 * (`scrollY > 75vh`) e pulsa um anel a cada 8s enquanto visível — fiel ao
 * `loop`/`setupWaPulse` do material bruto.
 */
export function WhatsAppFloat({ whatsapp }: { whatsapp?: string }) {
  const [visivel, setVisivel] = useState(false);
  const ringRef = useRef<HTMLSpanElement>(null);
  const href = waHref(whatsapp, "Olá! Vim pelo site e quero mais informações.");

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setVisivel(window.scrollY > window.innerHeight * 0.75);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!visivel || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      const el = ringRef.current;
      if (!el) return;
      el.style.animation = "none";
      void el.offsetWidth;
      el.style.animation = "d-waping 1.1s ease-out";
    }, 8000);
    return () => clearInterval(id);
  }, [visivel]);

  // Sem número, o flutuante não existe: um botão fixo de WhatsApp que
  // abre o app em branco é o pior dos links mortos — está sempre na tela.
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      className="fixed z-[800] flex h-[60px] w-[60px] items-center justify-center rounded-full transition-[opacity,transform] duration-[450ms]"
      style={{
        right: "calc(18px + env(safe-area-inset-right))",
        bottom: "calc(18px + env(safe-area-inset-bottom))",
        background: "var(--d-accent)",
        boxShadow: "0 12px 30px color-mix(in srgb, var(--d-accent) 40%, transparent)",
        opacity: visivel ? 1 : 0,
        transform: visivel ? "translateY(0)" : "translateY(24px)",
        pointerEvents: visivel ? "auto" : "none",
      }}
    >
      <span
        ref={ringRef}
        className="absolute inset-0 rounded-full border-2"
        style={{ borderColor: "var(--d-accent)" }}
        aria-hidden="true"
      />
      <svg width="27" height="27" viewBox="0 0 24 24" fill="var(--d-accent-ink)" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm-3 6.2c.2-.5.5-.6.8-.6h.7c.2 0 .5.1.7.6l.9 1.9c.1.3.1.5-.1.7l-.6.8c.6 1.1 1.9 2.4 3.1 3l.9-.6c.2-.2.5-.2.7-.1l1.9 1c.4.2.5.4.5.7-.1.8-.9 1.9-2.2 1.9-2.4 0-7.3-3.2-8-7.3-.2-1 .3-1.7.7-2Z" />
      </svg>
    </a>
  );
}
