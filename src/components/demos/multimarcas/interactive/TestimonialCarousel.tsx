"use client";

import { useEffect, useRef, useState } from "react";

import type { Animacao, DemoDepoimento } from "@/lib/demos/types";
import type { MultimarcasComposicao } from "@/lib/demos/types";
import { corDoAutor, type CorDeAvatar } from "./logic";

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
  coresAvatar,
  desenho = "carrossel",
}: {
  depoimentos: DemoDepoimento[];
  animacao: Animacao;
  /** Fundo+tinta dos avatares, derivados da paleta (ver `coresDoAvatar`). */
  coresAvatar: readonly CorDeAvatar[];
  /**
   * O desenho (knob `depoimentos`). Só o carrossel e a citação correm — um
   * de cada vez, arrastável, com autoplay; empilhado e tira são listas
   * paradas, e nelas o trilho não recebe transform nenhum.
   */
  desenho?: MultimarcasComposicao["depoimentos"];
}) {
  const corre = desenho === "carrossel" || desenho === "citacao";
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const arrastoRef = useRef<{ x0: number; dx: number } | null>(null);
  const xRef = useRef(0);

  const n = depoimentos.length;
  const reduzida =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const autoplayOk = corre && !reduzida && animacao !== "nenhuma";

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
    <div className="mm-dep">
      {corre && (
        <div
          className="mm-dep-progresso mb-3 h-[3px] w-[min(220px,40vw)] overflow-hidden rounded-full"
          style={{ background: "var(--d-border)" }}
        >
          <div
            className="h-full origin-left transition-transform duration-500"
            style={{ background: "var(--d-accent)", transform: `scaleX(${(idx + 1) / n})` }}
          />
        </div>
      )}
      <div
        ref={viewportRef}
        className={`mm-dep-janela ${corre ? "cursor-grab select-none [touch-action:pan-y]" : ""}`}
        onPointerDown={(e) => {
          if (!corre) return;
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
        <div ref={trackRef} className="mm-dep-trilho will-change-transform">
          {depoimentos.map((d, i) => (
            <figure key={i} className="mm-dep-item">
              <p className="mm-dep-texto font-[family-name:var(--d-corpo)] text-[var(--d-text)]/80">
                &ldquo;{d.texto}&rdquo;
              </p>
              <figcaption className="mm-dep-autor">
                <span
                  className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full font-[family-name:var(--d-mono)] text-[15px] font-semibold tracking-[1px]"
                  style={{
                    background: corDoAutor(d.autor, coresAvatar)?.fundo ?? "var(--d-text)",
                    color: corDoAutor(d.autor, coresAvatar)?.tinta ?? "var(--d-bg)",
                  }}
                >
                  {iniciais(d.autor)}
                </span>
                <span className="mm-dep-quem">
                  <span className="block font-[family-name:var(--d-corpo)] text-sm font-bold text-[var(--d-text)]">
                    {d.autor}
                  </span>
                  {d.contexto && (
                    <span className="mm-dep-contexto mt-0.5 block font-[family-name:var(--d-corpo)] text-xs font-medium text-[var(--d-accent)]">
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
