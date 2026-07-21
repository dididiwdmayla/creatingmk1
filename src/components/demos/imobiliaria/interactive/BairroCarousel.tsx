"use client";

import Image from "next/image";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";

import type { DemoItem } from "@/lib/demos/types";

/**
 * Carrossel de bairros com arraste fiel ao original: `pointerdown` marca a
 * origem, só passa a rolar (e captura o ponteiro) depois de 6px de
 * movimento — evita "roubar" cliques nos cards por tremores de mão. Sem
 * lib de carrossel: a rolagem nativa (`overflow-x: auto`) já funciona por
 * toque; o listener só adiciona o arraste por mouse.
 *
 * Cada card tem duas camadas de gradiente: uma de contraste (`--d-text`→
 * transparente, garante legibilidade do texto em QUALQUER preset, já que
 * texto/fundo são sempre o par de contraste do tema) e uma de matiz
 * decorativo por índice (3 acentos da paleta, sem dado do lead — só
 * variedade visual, igual ao original, que também alterna 3 gradientes
 * fixos entre os bairros).
 */
const MATIZ_VARS = ["--d-accent", "--d-accent-2", "--d-accent-3"] as const;

export function BairroCarousel({
  itens,
  imagens,
}: {
  itens: DemoItem[];
  imagens: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { down: true, startX: e.clientX, startLeft: ref.current?.scrollLeft ?? 0, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    const d = drag.current;
    if (!d.down || !el) return;
    if (Math.abs(e.clientX - d.startX) > 6 && !d.moved) {
      d.moved = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // alvo já perdeu o ponteiro (ex.: pointerup disparou antes) — sem problema.
      }
    }
    if (d.moved) el.scrollLeft = d.startLeft - (e.clientX - d.startX);
  };
  const onPointerUp = () => {
    drag.current.down = false;
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="scrollbar-hide flex cursor-grab gap-6 overflow-x-auto px-5 pb-5 select-none active:cursor-grabbing md:px-10"
    >
      {itens.map((bairro, i) => {
        const src = imagens[`bairro-${i + 1}`] ?? imagens.hero;
        return (
          <div
            key={bairro.titulo}
            className="relative h-[470px] w-[330px] flex-none overflow-hidden rounded-[22px] bg-[var(--d-bg-elev)]"
          >
            {src && (
              <Image
                src={src}
                alt={bairro.titulo}
                fill
                unoptimized
                data-demo-slot={`imagens.bairro-${i + 1}`}
                className="pointer-events-none object-cover"
                sizes="330px"
              />
            )}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `linear-gradient(180deg, color-mix(in srgb, var(${MATIZ_VARS[i % 3]}) 22%, transparent) 0%, color-mix(in srgb, var(--d-text) 78%, transparent) 100%)`,
              }}
            />
            <div className="pointer-events-none absolute inset-x-6 bottom-6">
              <p
                data-demo-slot={`secoes.bairros.itens.${i}.titulo`}
                className="mb-2 font-[family-name:var(--d-display)] text-[44px] leading-none tracking-tight text-[var(--d-bg)]"
              >
                {bairro.titulo}
              </p>
              {bairro.subtitulo && (
                <p
                  data-demo-slot={`secoes.bairros.itens.${i}.subtitulo`}
                  className="text-sm font-medium text-[var(--d-bg)]/85"
                >
                  {bairro.subtitulo}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
