"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Preloader "velocímetro" — ponteiro sobe de -120° a 120° em ~1.5s com uma
 * mola simples (mesma física do `spring(t)` do material bruto: velocidade
 * amortecida a cada frame, não um easing fixo), um leve tremor no fim e
 * saída com skew+blur. Roda por conta própria (rAF imperativo, sem
 * re-render por frame) — só o texto da marca/porcentagem e a troca de
 * fase (`saindo`) usam estado React.
 */
export function Preloader({
  nome,
  accent,
  onComplete,
}: {
  nome: string;
  accent: string;
  onComplete: () => void;
}) {
  const needleRef = useRef<SVGGElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    let raf = 0;
    let vel = 0;
    let ang = -120;
    let jitterEnd = 0;
    const t0 = performance.now();

    const tick = (t: number) => {
      const p = Math.min((t - t0) / 1500, 1);
      const target = -120 + 240 * p;
      vel = (vel + (target - ang) * 0.11) * 0.8;
      ang += vel;
      const jitter = p > 0.93 ? Math.sin(t / 16) * 1.8 : 0;
      needleRef.current?.setAttribute("transform", `rotate(${ang + jitter} 100 100)`);
      if (pctRef.current) pctRef.current.textContent = String(Math.round(p * 100));

      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else if (!jitterEnd) {
        jitterEnd = t + 260;
        raf = requestAnimationFrame(tick);
      } else if (t < jitterEnd) {
        raf = requestAnimationFrame(tick);
      } else {
        setSaindo(true);
        setTimeout(onComplete, 640);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[9990] flex flex-col items-center justify-center gap-[18px] bg-[var(--d-bg)]"
      style={{
        transition: "transform 640ms cubic-bezier(.75,0,.15,1), filter 640ms cubic-bezier(.75,0,.15,1)",
        transform: saindo ? "translateX(-118%) skewX(7deg)" : "translateX(0) skewX(0deg)",
        filter: saindo ? "blur(16px)" : "blur(0px)",
      }}
      aria-hidden="true"
    >
      <svg width="210" height="160" viewBox="0 0 200 152" fill="none">
        <circle cx="100" cy="100" r="92" fill="var(--d-bg-elev)" stroke="var(--d-border)" strokeWidth="2" />
        <circle cx="100" cy="100" r="86" fill="none" stroke="var(--d-border)" strokeWidth="1" />
        <path
          d="M32.5 139 A78 78 0 1 1 167.3 139"
          stroke="var(--d-border)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path d="M167.5 61 A78 78 0 0 1 167.3 139" stroke={accent} strokeWidth="4" strokeLinecap="round" />
        {[
          [32.5, 139, 41.1, 134],
          [22, 100, 32, 100],
          [32.5, 61, 41.1, 66],
          [61, 32.5, 66, 41.1],
          [100, 22, 100, 32],
          [139, 32.5, 134, 41.1],
        ].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--d-muted)" strokeWidth="3" />
        ))}
        {[
          [167.5, 61, 158.9, 66],
          [178, 100, 168, 100],
          [167.5, 139, 158.9, 134],
        ].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeWidth="3" />
        ))}
        <text
          x="100"
          y="66"
          textAnchor="middle"
          fill="var(--d-muted)"
          style={{ font: "500 9px var(--d-mono)", letterSpacing: "3px" }}
        >
          GIRI ×1000
        </text>
        <g ref={needleRef} transform="rotate(-120 100 100)">
          <line x1="100" y1="100" x2="100" y2="34" stroke={accent} strokeWidth="4" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="100" r="8" fill="var(--d-text)" />
        <circle cx="100" cy="100" r="3" fill={accent} />
        <text
          x="100"
          y="130"
          textAnchor="middle"
          fill="var(--d-muted)"
          style={{ font: "500 8px var(--d-mono)", letterSpacing: "2px" }}
        >
          VEGLIA · MILANO
        </text>
      </svg>
      <div className="font-[family-name:var(--d-display)] text-2xl font-extrabold tracking-[5px] text-[var(--d-text)]">
        {nome.toUpperCase()}
        <span style={{ color: accent }}>.</span>
      </div>
      <div className="font-[family-name:var(--d-mono)] text-xs font-medium tracking-[2px] text-[var(--d-muted)] tabular-nums">
        <span ref={pctRef}>0</span>%
      </div>
    </div>
  );
}
