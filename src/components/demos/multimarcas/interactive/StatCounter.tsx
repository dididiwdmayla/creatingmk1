"use client";

import { useEffect, useRef, useState } from "react";

import { formatarNumero, parseNumeroFormatado } from "./logic";

/**
 * Contador que sobe do zero até o valor alvo quando entra no viewport
 * (easing quártico, ~1.3s) — fiel ao `countTo` do material bruto. O texto
 * de entrada (`valor`, ex.: "+1.200", "15 anos") já carrega
 * prefixo/sufixo/casas decimais (ver parseNumeroFormatado); só o número
 * anima — prefixo/sufixo (`+`, " anos") ficam estáticos e podem ganhar
 * a cor de destaque via `corDestaque`, fiel ao material bruto.
 *
 * **O HTML do servidor traz o valor FINAL**, já formatado — nunca o zero
 * de partida. A contagem só é armada no cliente, e só para o contador que
 * está FORA da tela na montagem: ele volta a zero onde ninguém vê e sobe
 * quando entra. O que já está à vista fica como veio (sem piscar para
 * zero), e reduced-motion não anima nada. Sem isso, sem JavaScript, todo
 * preço do estoque saía "0".
 */
export function StatCounter({
  valor,
  className,
  corDestaque,
  idioma,
}: {
  valor: string;
  className?: string;
  corDestaque?: string;
  /** Locale da demo: lê o separador do texto e formata a contagem com o dele. */
  idioma?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const parsed = parseNumeroFormatado(valor, idioma);
  const final = parsed ? formatarNumero(parsed.alvo, parsed.casas, idioma) : valor;
  const [numero, setNumero] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!parsed || !el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    const { alvo, casas } = parsed;
    let raf = 0;
    const armar = setTimeout(() => setNumero(formatarNumero(0, casas, idioma)), 0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const t0 = performance.now();
        const duracao = 1300;
        const tick = (t: number) => {
          const p = Math.min((t - t0) / duracao, 1);
          const eased = 1 - Math.pow(1 - p, 4);
          setNumero(p < 1 ? formatarNumero(alvo * eased, casas, idioma) : null);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      clearTimeout(armar);
      observer.disconnect();
      cancelAnimationFrame(raf);
      setNumero(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, idioma]);

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
      {numero ?? final}
      {parsed.sufixo && <span style={corDestaque ? { color: corDestaque } : undefined}>{parsed.sufixo}</span>}
    </span>
  );
}
