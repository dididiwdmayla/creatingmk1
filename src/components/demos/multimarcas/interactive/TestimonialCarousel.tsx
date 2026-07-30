"use client";

import { useEffect, useRef, useState } from "react";

import type { Animacao, DemoDepoimento } from "@/lib/demos/types";

/** Paleta fixa dos avatares (mecânica de exibição, não conteúdo do lead) — rotação determinística por autor. */
const CORES_AVATAR = ["#8C2B1E", "#1B5E3B", "#A0741F", "#4A3B2E", "#5E1E14", "#2B4A6B", "#6B3B5E"];

function corDoAutor(autor: string): string {
  let h = 0;
  for (let i = 0; i < autor.length; i++) h = (h * 31 + autor.charCodeAt(i)) | 0;
  return CORES_AVATAR[Math.abs(h) % CORES_AVATAR.length];
}

function iniciais(autor: string): string {
  const partes = autor.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

/**
 * Carrossel de depoimentos arrastável (pointer events puros, sem lib) com
 * autoplay a cada 6s — fiel ao `setupCarousel`/`startAuto` do material
 * bruto. Autoplay respeita o nível global de animação (desliga em
 * "nenhuma"/reduced-motion, mesmo critério do resto da Forja).
 */
export function TestimonialCarousel({
  depoimentos,
  animacao,
}: {
  depoimentos: DemoDepoimento[];
  animacao: Animacao;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const arrastoRef = useRef<{ x0: number; dx: number } | null>(null);
  const xRef = useRef(0);

  const n = depoimentos.length;
  const reduzida =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const autoplayOk = !reduzida && animacao !== "nenhuma";

  const irPara = (i: number, animar = true) => {
    const track = trackRef.current;
    const vp = viewportRef.current;
    if (!track || !vp) return;
    const novoIdx = Math.max(0, Math.min(n - 1, i));
    const passo = ((track.children[0] as HTMLElement | undefined)?.offsetWidth ?? 340) + 20; // +gap (gap-5 = 20px)
    const max = Math.max(track.scrollWidth - vp.offsetWidth, 0);
    const x = Math.min(novoIdx * passo, max);
    xRef.current = x;
    track.style.transition = animar && !reduzida ? "transform 550ms cubic-bezier(.25,1,.3,1)" : "none";
    track.style.transform = `translateX(${-x}px)`;
    setIdx(novoIdx);
  };

  useEffect(() => {
    if (!autoplayOk || n < 2) return;
    const id = setInterval(() => {
      setIdx((atual) => {
        const proximo = atual + 1 >= n ? 0 : atual + 1;
        irPara(proximo);
        return proximo;
      });
    }, 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplayOk, n]);

  if (n === 0) return null;

  return (
    <div>
      <div
        className="mb-3 h-[3px] w-[min(220px,40vw)] overflow-hidden rounded-full"
        style={{ background: "var(--d-border)" }}
      >
        <div
          className="h-full origin-left transition-transform duration-500"
          style={{ background: "var(--d-accent)", transform: `scaleX(${(idx + 1) / n})` }}
        />
      </div>
      <div
        ref={viewportRef}
        className="cursor-grab overflow-hidden [touch-action:pan-y] select-none"
        onPointerDown={(e) => {
          arrastoRef.current = { x0: e.clientX, dx: 0 };
          if (trackRef.current) trackRef.current.style.transition = "none";
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!arrastoRef.current || !trackRef.current) return;
          arrastoRef.current.dx = e.clientX - arrastoRef.current.x0;
          trackRef.current.style.transform = `translateX(${-xRef.current + arrastoRef.current.dx}px)`;
        }}
        onPointerUp={() => {
          if (!arrastoRef.current) return;
          const { dx } = arrastoRef.current;
          arrastoRef.current = null;
          irPara(Math.abs(dx) > 55 ? idx - Math.sign(dx) : idx);
        }}
        onPointerCancel={() => {
          arrastoRef.current = null;
          irPara(idx);
        }}
      >
        <div ref={trackRef} className="flex gap-5 will-change-transform">
          {depoimentos.map((d, i) => (
            <figure
              key={i}
              className="m-0 flex w-[min(360px,82vw)] flex-none flex-col gap-[18px] border p-7"
              style={{ background: "var(--d-bg-elev)", borderColor: "var(--d-border)", borderRadius: "var(--d-radius)" }}
            >
              <p className="font-[family-name:var(--d-corpo)] text-[15.5px] leading-[1.65] text-[var(--d-text)]/80">
                &ldquo;{d.texto}&rdquo;
              </p>
              <figcaption className="mt-auto flex items-center gap-3.5">
                <span
                  className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full font-[family-name:var(--d-mono)] text-[15px] font-semibold tracking-[1px] text-white"
                  style={{ background: corDoAutor(d.autor) }}
                >
                  {iniciais(d.autor)}
                </span>
                <span>
                  <span className="block font-[family-name:var(--d-corpo)] text-sm font-bold text-[var(--d-text)]">
                    {d.autor}
                  </span>
                  {d.contexto && (
                    <span className="mt-0.5 block font-[family-name:var(--d-corpo)] text-xs font-medium text-[var(--d-accent)]">
                      {d.contexto}
                    </span>
                  )}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
