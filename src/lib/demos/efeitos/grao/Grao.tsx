"use client";

import { useMemo, useRef } from "react";

import { devicePixelRatioClamped } from "../dpr";
import type { EfeitoProps } from "../types";
import { useEfeitoAtivo } from "../useEfeitoAtivo";

/**
 * Textura de ruído em overlay, opacidade baixa, SEM loop de JS: um tile
 * de pixels aleatórios é desenhado num canvas UMA vez no mount (nunca de
 * novo), virado data URL e usado como `background-image` repetido — dali
 * pra frente é CSS puro, nenhum rAF. devicePixelRatio é limitado a 2 no
 * tamanho do canvas (celular 3x/4x não precisa de mais ruído, só
 * desperdiça memória). Pausa (fora da viewport/aba oculta/`pausado`) só
 * baixa a opacidade — não há loop pra cancelar.
 */
const TILE_PX = 128;
const OPACIDADE_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.025, 2: 0.045, 3: 0.07 };

function gerarTileRuido(dpr: number): string {
  const size = Math.round(TILE_PX * dpr);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const imageData = ctx.createImageData(size, size);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    imageData.data[i] = v;
    imageData.data[i + 1] = v;
    imageData.data[i + 2] = v;
    imageData.data[i + 3] = Math.floor(Math.random() * 255);
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export function Grao({ intensidade, pausado }: EfeitoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ativo, reducedMotion } = useEfeitoAtivo(containerRef, pausado);

  // Gerado no máximo uma vez (memo, não efeito) — nunca recalcula por
  // reintensidade 1↔2↔3 (só a opacidade muda), nunca de novo por frame.
  const ligado = intensidade > 0;
  const tile = useMemo(() => {
    if (typeof document === "undefined" || !ligado) return "";
    return gerarTileRuido(devicePixelRatioClamped(2));
  }, [ligado]);

  if (intensidade === 0) return null;

  return (
    <div
      ref={containerRef}
      // fixed cobre a viewport inteira em qualquer scroll. z-index POSITIVO
      // (mesma convenção de aura/gradiente/particulas): seções da demo têm
      // fundo sólido próprio cobrindo 100% da largura, então um z-index
      // negativo pintaria o efeito atrás desse fundo e ele nunca
      // apareceria — ver Aura.tsx e ARCHITECTURE.md. Opacidade baixíssima
      // (ver OPACIDADE_POR_INTENSIDADE) garante que não atrapalha a
      // legibilidade por cima do conteúdo.
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden="true"
      style={{
        backgroundImage: tile ? `url(${tile})` : undefined,
        backgroundRepeat: "repeat",
        backgroundSize: `${TILE_PX}px ${TILE_PX}px`,
        opacity: `calc(${ativo ? OPACIDADE_POR_INTENSIDADE[intensidade] : 0} * var(--d-efeito-fade, 1))`,
        transition: reducedMotion ? "none" : "opacity 300ms ease",
      }}
    />
  );
}
