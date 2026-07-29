"use client";

import { useRef, type ReactNode } from "react";

/**
 * Vitrine de bairros com arraste por mouse — fiel ao original: pointer
 * events puros (down/move/up/cancel), sem lib, `cursor:grab`→`grabbing`,
 * scrollbar escondida. Sem inércia/momentum extra (o original também não
 * tem: só arrasta `scrollLeft` 1:1 com o ponteiro).
 */
export function Carousel({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const estado = useRef({ down: false, startX: 0, startLeft: 0, moved: false });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    estado.current = { down: true, startX: e.clientX, startLeft: ref.current?.scrollLeft ?? 0, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = estado.current;
    if (!s.down || !ref.current) return;
    if (Math.abs(e.clientX - s.startX) > 6 && !s.moved) {
      s.moved = true;
      try {
        ref.current.setPointerCapture(e.pointerId);
      } catch {
        // pointer capture indisponível (ex.: alguns ambientes de teste) — arraste segue sem ela.
      }
    }
    if (s.moved) ref.current.scrollLeft = s.startLeft - (e.clientX - s.startX);
  };

  const onPointerUp = () => {
    estado.current.down = false;
  };

  return (
    <div
      ref={ref}
      className="scrollbar-hide flex cursor-grab select-none gap-6 overflow-x-auto px-5 pb-5 active:cursor-grabbing sm:px-10"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {children}
    </div>
  );
}
