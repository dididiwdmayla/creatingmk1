"use client";

import { useEffect, type RefObject } from "react";

/**
 * O vídeo do título desenhado num `<canvas>` do tamanho EXATO da caixa —
 * e não um `<video>` dentro do `<foreignObject>` mascarado.
 *
 * POR QUÊ (medido, não suposto): a `<mask>` do SVG é operação de PINTURA,
 * mas o `<video>` é o elemento que os navegadores entregam a uma
 * SUPERFÍCIE DE COMPOSIÇÃO própria. Na árvore de camadas do CDP (celular,
 * tatuagem com vídeo) o `<video>` aparecia com camadas próprias penduradas
 * na RAIZ — não aninhadas na camada mascarada —, e a de conteúdo media
 * `342×192` numa caixa de `342×152`: o `object-fit: cover` de um vídeo mais
 * alto que a caixa sobra 40px, 20 acima e 20 abaixo. A máscara não faz
 * parte do estado dessas camadas, então todo redesenho independente delas
 * (o repique da rolagem, no topo do hero) desenhava a sobra — a faixa clara
 * na borda superior do título. `overflow: hidden` no envelope NÃO resolve:
 * medido, a camada de conteúdo continua com os mesmos `342×192`.
 *
 * Um `<canvas>` não é superfície de vídeo: ele é pintado pelo caminho
 * normal de pintura, dentro do grupo mascarado, e tem exatamente o tamanho
 * que ESTE código escolhe. O recorte do `cover` é feito no `drawImage`, na
 * ORIGEM — então não existe sobra para vazar, com ou sem máscara. É a mesma
 * decisão que a "Regra de superfície" já impõe aos efeitos de fundo
 * ("quem pinta é o código, num bitmap do tamanho que ELE escolher").
 *
 * Custo: um `drawImage` por quadro do VÍDEO (`requestVideoFrameCallback`,
 * não `rAF` — não se desenha mais vezes do que o vídeo produz quadros),
 * num bitmap de no máximo 2× a caixa. Para a caixa de 342×152 do celular
 * isso é 0,21 Mpx por quadro, ~6 Mpx/s a 30 Hz — contra os 9,6 Mpx/s da
 * própria página e o limiar de marcação de +40 Mpx/s do portão.
 */

/** Teto de amostragem: acima de 2× ninguém enxerga, e o bitmap dobra de custo. */
const DPR_MAX = 2;

type VideoComFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

export function useVideoEmCanvas({
  videoRef,
  canvasRef,
  ativo,
  largura,
  altura,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Só desenha no nível `video`; nos outros nem o laço existe. */
  ativo: boolean;
  /** Caixa do wordmark em px CSS — o bitmap tem exatamente este tamanho. */
  largura: number;
  altura: number;
}) {
  useEffect(() => {
    const video = videoRef.current as VideoComFrameCallback | null;
    const canvas = canvasRef.current;
    if (!ativo || !video || !canvas || largura <= 0 || altura <= 0) return;

    const dpr = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, DPR_MAX);
    canvas.width = Math.max(1, Math.round(largura * dpr));
    canvas.height = Math.max(1, Math.round(altura * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let vivo = true;
    let pedido = 0;
    let porFrameDeVideo = false;

    const pintar = () => {
      if (!vivo) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw > 0 && vh > 0) {
        // `object-fit: cover` feito na ORIGEM: recorta o quadro do vídeo e
        // estica o recorte para o bitmap inteiro. O destino é sempre a
        // caixa exata — é isso que elimina a sobra que vazava.
        const escala = Math.max(canvas.width / vw, canvas.height / vh);
        const larguraFonte = canvas.width / escala;
        const alturaFonte = canvas.height / escala;
        ctx.drawImage(
          video,
          (vw - larguraFonte) / 2,
          (vh - alturaFonte) / 2,
          larguraFonte,
          alturaFonte,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      }
    };

    const desenharEAgendar = () => {
      pintar();
      agendar();
    };

    const agendar = () => {
      if (!vivo) return;
      if (typeof video.requestVideoFrameCallback === "function") {
        porFrameDeVideo = true;
        pedido = video.requestVideoFrameCallback(desenharEAgendar);
      } else {
        porFrameDeVideo = false;
        pedido = requestAnimationFrame(desenharEAgendar);
      }
    };

    // Uma pintura IMEDIATA antes de agendar: mexer em `canvas.width` limpa
    // o bitmap, e este efeito roda de novo a cada recontagem da caixa
    // (trocar alinhamento, escala, entre-letras…). Sem ela, o título
    // ficaria só com o contorno até o próximo quadro do vídeo — um título
    // sem preenchimento é pior que o defeito que se está corrigindo.
    pintar();
    // `loadeddata` cobre o outro lado: efeito montado antes de existir
    // qualquer quadro decodificado, onde `pintar()` acima não teve o que
    // desenhar e o `rAF` de fallback não sabe esperar por vídeo.
    video.addEventListener("loadeddata", pintar);
    agendar();
    return () => {
      vivo = false;
      video.removeEventListener("loadeddata", pintar);
      if (porFrameDeVideo) video.cancelVideoFrameCallback?.(pedido);
      else cancelAnimationFrame(pedido);
    };
  }, [ativo, largura, altura, videoRef, canvasRef]);
}
