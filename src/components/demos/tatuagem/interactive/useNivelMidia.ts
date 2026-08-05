"use client";

import { useEffect, useState } from "react";

/**
 * Nível de mídia do título hero, do mais rico ao mais seguro:
 *
 *   1. `video`  — há `dados.videos.titulo`, a conexão não é lenta
 *      (`navigator.connection`, quando suportado) e `prefers-reduced-motion`
 *      não está ativo;
 *   2. `imagem` — sem vídeo, com vídeo que falhou, em conexão lenta ou com
 *      motion reduzido, desde que haja `imagemFallback`;
 *   3. `nenhum` — nem uma coisa nem outra: a base da skin.
 *
 * O estado INICIAL é função pura das props (mesmo valor no servidor e no
 * primeiro render do cliente, sem divergência de hidratação): sem vídeo
 * configurado, o nível de imagem já sai pronto no HTML — que é o caso da
 * quase totalidade das demos — e o título nunca pisca de gradiente pra
 * foto. Só quando há vídeo é que a decisão precisa esperar o cliente, e aí
 * ela roda num `useEffect` deferido (`setTimeout(…, 0)`, mesmo padrão de
 * `CustomCursor.tsx`) pra não chamar `setState` sincronamente no corpo do
 * efeito.
 */
export type NivelMidia = "nenhum" | "imagem" | "video";

type ConnectionLike = { saveData?: boolean; effectiveType?: string };

function conexaoLenta(): boolean {
  const conexao = (navigator as Navigator & { connection?: ConnectionLike }).connection;
  if (!conexao) return false;
  if (conexao.saveData) return true;
  return conexao.effectiveType === "slow-2g" || conexao.effectiveType === "2g";
}

export function useNivelMidia({
  videoSrc,
  imagemFallback,
}: {
  videoSrc?: string;
  imagemFallback?: string;
}): NivelMidia {
  const [nivel, setNivel] = useState<NivelMidia>(() =>
    videoSrc ? "nenhum" : imagemFallback ? "imagem" : "nenhum",
  );

  useEffect(() => {
    const t = setTimeout(() => {
      const reduzida = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (videoSrc && !reduzida && !conexaoLenta()) setNivel("video");
      else if (imagemFallback) setNivel("imagem");
      else setNivel("nenhum");
    }, 0);
    return () => clearTimeout(t);
  }, [videoSrc, imagemFallback]);

  return nivel;
}
