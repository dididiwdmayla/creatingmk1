"use client";

import { useRef } from "react";

/**
 * Easter egg do rodapé: 3 cliques na marca em 1.6s disparam a wordmark
 * "escapando" pra fora da tela e voltando — fiel ao `setupEgg` do material
 * bruto (Web Animations API, sem lib). Desligado em prefers-reduced-motion.
 */
export function FooterEgg({ nome, accent }: { nome: string; accent: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const tapsRef = useRef(0);
  const t0Ref = useRef(0);

  function onClick() {
    const agora = Date.now();
    if (agora - t0Ref.current > 1600) tapsRef.current = 0;
    t0Ref.current = agora;
    tapsRef.current += 1;
    if (tapsRef.current < 3) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    tapsRef.current = 0;
    ref.current?.animate(
      [
        { transform: "translateX(0) rotate(0deg)" },
        { transform: "translateX(-14px) rotate(-6deg)", offset: 0.18 },
        { transform: "translateX(140px) rotate(3deg)", opacity: 0, offset: 0.55 },
        { transform: "translateX(-60px)", opacity: 0, offset: 0.56 },
        { transform: "translateX(0)", opacity: 1 },
      ],
      { duration: 1100, easing: "cubic-bezier(.5,0,.2,1)" },
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="inline-block bg-transparent p-0 font-[family-name:var(--d-display)] text-2xl font-extrabold tracking-[3px] text-[var(--d-text)]"
    >
      {nome.toUpperCase()}
      <span style={{ color: accent }}>.</span>
    </button>
  );
}
