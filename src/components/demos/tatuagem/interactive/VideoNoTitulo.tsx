"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Vídeo rodando DENTRO das letras do título — fiel ao efeito do material
 * bruto (vídeo com máscara SVG do wordmark original; ver Wordmark.tsx).
 * Técnica: `<mask>` de SVG com um `<text>` (herda fonte/tamanho do
 * `.d-wordmark` via CSS normal, já que o SVG é inline no DOM) recortando
 * um `<foreignObject>` com o `<video>` — sem canvas, sem libs.
 *
 * Camada de cima do wordmark em CSS puro (ver Wordmark.tsx), que continua
 * sendo a base SEMPRE renderizada: esta camada só aparece por cima quando
 * o vídeo (ou, na falta/erro dele, a imagem) realmente carrega. Três
 * níveis, do mais rico ao mais seguro:
 *
 *   1. vídeo no texto (se houver, conexão não for lenta e motion não for
 *      reduzido);
 *   2. imagem estática no texto (sem vídeo, erro de vídeo, conexão lenta
 *      ou prefers-reduced-motion);
 *   3. nada — o CSS puro de Wordmark.tsx (gradiente + contorno) continua
 *      visível por baixo (cor sólida, sem overlay).
 */

type ConnectionLike = { saveData?: boolean; effectiveType?: string };

function conexaoLenta(): boolean {
  const conexao = (navigator as Navigator & { connection?: ConnectionLike }).connection;
  if (!conexao) return false;
  if (conexao.saveData) return true;
  return conexao.effectiveType === "slow-2g" || conexao.effectiveType === "2g";
}

export function VideoNoTitulo({
  nome,
  videoSrc,
  imagemFallback,
}: {
  nome: string;
  videoSrc?: string;
  imagemFallback?: string;
}) {
  const maskId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [nivel, setNivel] = useState<"video" | "imagem" | "nenhum">("nenhum");

  useEffect(() => {
    // Deferido (setTimeout 0): mesmo padrão de CustomCursor.tsx pra decidir
    // a partir de uma API só disponível no client sem disparar setState
    // sincronamente dentro do corpo do efeito.
    const t = setTimeout(() => {
      const reduzida = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (videoSrc && !reduzida && !conexaoLenta()) {
        setNivel("video");
      } else if (imagemFallback) {
        setNivel("imagem");
      }
    }, 0);
    return () => clearTimeout(t);
  }, [videoSrc, imagemFallback]);

  if (nivel === "nenhum") return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <mask id={maskId} maskUnits="objectBoundingBox">
          <rect x="0" y="0" width="100%" height="100%" fill="black" />
          <text
            x="50%"
            y="52%"
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            className="uppercase"
            style={{
              fontFamily: "inherit",
              fontWeight: "inherit",
              letterSpacing: "0.04em",
            }}
          >
            {nome}
          </text>
        </mask>
      </defs>
      {nivel === "video" && videoSrc && (
        <foreignObject x="0" y="0" width="100%" height="100%" mask={`url(#${maskId})`}>
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setNivel(imagemFallback ? "imagem" : "nenhum")}
            onStalled={() => setNivel(imagemFallback ? "imagem" : "nenhum")}
          />
        </foreignObject>
      )}
      {nivel === "imagem" && imagemFallback && (
        <image
          href={imagemFallback}
          x="0"
          y="0"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
          mask={`url(#${maskId})`}
          onError={() => setNivel("nenhum")}
        />
      )}
    </svg>
  );
}
