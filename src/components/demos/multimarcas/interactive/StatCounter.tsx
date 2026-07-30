"use client";

import { useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { formatarNumeroBR, parseNumeroFormatado } from "./logic";

/**
 * Contador que sobe do zero até o valor alvo quando entra no viewport
 * (easing quártico, ~1.3s) — fiel ao `countTo` do material bruto. O texto
 * de entrada (`valor`, ex.: "+1.200", "4,9★", "15 anos") já carrega
 * prefixo/sufixo/casas decimais (ver parseNumeroFormatado); só o número
 * anima — prefixo/sufixo (`+`, `★`, " anos") ficam estáticos e podem ganhar
 * a cor de destaque via `corDestaque`, fiel ao material bruto. Sem
 * reduced-motion, mostra o valor final direto, sem animar.
 */
export function StatCounter({
  valor,
  className,
  corDestaque,
}: {
  valor: string;
  className?: string;
  corDestaque?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const emVista = useInView(ref, { once: true, amount: 0.4 });
  const parsed = parseNumeroFormatado(valor);
  const [numero, setNumero] = useState(() => (parsed ? formatarNumeroBR(0, parsed.casas) : valor));

  useEffect(() => {
    if (!parsed) return;
    if (!emVista) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setNumero(formatarNumeroBR(parsed.alvo, parsed.casas)), 0);
      return () => clearTimeout(t);
    }
    const t0 = performance.now();
    const duracao = 1300;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duracao, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      setNumero(formatarNumeroBR(parsed.alvo * eased, parsed.casas));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emVista, valor]);

  if (!parsed) {
    return (
      <span ref={ref} className={className}>
        {valor}
      </span>
    );
  }

  return (
    <span ref={ref} className={className}>
      {parsed.prefixo && <span style={corDestaque ? { color: corDestaque } : undefined}>{parsed.prefixo}</span>}
      {numero}
      {parsed.sufixo && <span style={corDestaque ? { color: corDestaque } : undefined}>{parsed.sufixo}</span>}
    </span>
  );
}
