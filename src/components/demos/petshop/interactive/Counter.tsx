"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { formatarContador, parseContador } from "./contador";

const DURACAO_MS = 1700;

/**
 * Contagem animada ao entrar no viewport — fiel ao `data-count`/
 * `AumigoFX.counters()` do material bruto (IntersectionObserver +
 * easing cúbico, uma vez só). O alvo/prefixo/sufixo são extraídos do
 * próprio texto (ver ./contador.ts) pra não precisar de campos novos no
 * contrato: o editor continua editando um `DemoItem.titulo` normal.
 */
export function Counter({ texto }: { texto: string }) {
  // Memoizado por `texto`: sem isso, cada tick de setExibido recriaria o
  // objeto e reexecutaria o efeito abaixo (que depende de `parsed`),
  // recriando o IntersectionObserver a cada frame da animação.
  const parsed = useMemo(() => parseContador(texto), [texto]);
  const [exibido, setExibido] = useState(parsed ? formatarContador(0, parsed) : texto);
  const ref = useRef<HTMLSpanElement>(null);
  const animouRef = useRef(false);

  useEffect(() => {
    if (!parsed) return;
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // setState adiado pro próximo tick — mesmo padrão de CustomCursor.tsx
      // nas demais skins: não roda sincronamente no corpo do efeito.
      const t = setTimeout(() => setExibido(texto), 0);
      return () => clearTimeout(t);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || animouRef.current) continue;
          animouRef.current = true;
          io.unobserve(el);
          const t0 = performance.now();
          const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / DURACAO_MS);
            const eased = 1 - (1 - p) ** 3;
            setExibido(formatarContador(parsed.alvo * eased, parsed));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [parsed, texto]);

  return <span ref={ref}>{exibido}</span>;
}
