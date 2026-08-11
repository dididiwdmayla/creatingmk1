"use client";

import { useRef, useState } from "react";

import { MascaraDoTexto, useMedidaDoTexto } from "./MascaraDoTexto";
import { useNivelMidia, type NivelMidia } from "./useNivelMidia";
import { useVideoEmCanvas } from "./videoEmCanvas";

/**
 * MECANISMO COMPARTILHADO do vídeo-no-título — não é da tatuagem. Vive
 * aqui (e não em `components/demos/<skin>/`) porque mais de uma skin o
 * usa; cada skin reexporta numa linha, do mesmo jeito que
 * `interactive/LedEdges.tsx` reexporta `lib/demos/led/LedEdges`.
 *
 * O que a SKIN deve fornecer (o contrato deste componente):
 *   - `.d-wordmark` — o bloco, `position: relative`, com a `font-family`
 *     e o `font-size` do título (a máscara os herda por CSS normal, é o
 *     que dispensa casar métricas na mão);
 *   - `.d-wordmark-text` — a caixa de texto, com `background-clip: text`
 *     e as regras de `[data-d-midia="imagem"|"video"]`.
 *
 * UMA caixa de texto, sempre — `.d-wordmark-text`, com `background-clip:
 * text` recortando o preenchimento nos glifos e `-webkit-text-stroke`
 * desenhando o contorno multicor animado. A mídia do vídeo-no-título
 * (opt-in por skin, ver `SkinDefinition.videoSlots`) é o PREENCHIMENTO
 * dessa caixa, nunca uma segunda cópia do texto:
 *
 *   1. `video`  — o vídeo do lead recortado por uma máscara DERIVADA das
 *      linhas dessa caixa (ver MascaraDoTexto); o preenchimento próprio da
 *      caixa desliga e o contorno fica;
 *   2. `imagem` — `dados.imagens.hero` entra como `background-image` da
 *      PRÓPRIA caixa: a foto sai recortada pelos glifos por construção,
 *      com a quebra de linha do CSS, sem SVG e sem nada pra alinhar;
 *   3. `nenhum` — o gradiente que deriva devagar, a base da skin.
 *
 * Antes, o overlay de vídeo montava POR CIMA e desenhava a própria cópia
 * do texto num `<text>` de SVG: como `<text>` não quebra linha sozinho, um
 * nome longo saía com quebra diferente da caixa de baixo (que continuava
 * pintando o gradiente) e o título aparecia duplicado e desalinhado — ver
 * "Título hero: uma caixa de texto, a mídia como máscara" em
 * ARCHITECTURE.md.
 */
export function Wordmark({
  nome,
  className = "",
  slot,
  videoSrc,
  imagemFallback,
}: {
  nome: string;
  className?: string;
  /** Marca o slot editável no preview (ver data-demo-slot nas demais skins). */
  slot?: string;
  /** URL do Storage (dados.videos["titulo"]); ausente = sem tentativa de vídeo. */
  videoSrc?: string;
  /** Fallback estático (ex.: dados.imagens.hero) pra quando o vídeo não roda. */
  imagemFallback?: string;
}) {
  const caixaRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Guarda a URL que falhou, não um "falhou?": um vídeo que erra/estola
  // cai pro nível de imagem e não volta a tentar, e trocar a URL (upload
  // novo no editor) rearma sozinho, sem efeito de reset.
  const [videoComErro, setVideoComErro] = useState<string | null>(null);

  const nivel = useNivelMidia({
    videoSrc: videoSrc && videoSrc !== videoComErro ? videoSrc : undefined,
    imagemFallback,
  });
  const metrica = useMedidaDoTexto(caixaRef, nivel === "video");

  // Sem medida da caixa não há máscara — e sem máscara o vídeo cobriria o
  // título inteiro. Nesse caso o nível cai um degrau, nunca pra um título
  // sem preenchimento.
  const midia: NivelMidia =
    nivel === "video" && !metrica ? (imagemFallback ? "imagem" : "nenhum") : nivel;

  // O bitmap tem o tamanho da caixa MEDIDA — então a mesma recontagem que
  // realinha a máscara também redimensiona o vídeo, sem um segundo caminho.
  useVideoEmCanvas({
    videoRef,
    canvasRef,
    ativo: midia === "video",
    largura: metrica?.caixa.largura ?? 0,
    altura: metrica?.caixa.altura ?? 0,
  });

  return (
    <span className={`d-wordmark ${className}`} data-demo-slot={slot} aria-label={nome}>
      {/* Preenchimento e contorno NO MESMO elemento (background-clip:text +
          -webkit-text-stroke): duas camadas irmãs seguindo o mesmo texto,
          cada uma com sua própria animação CSS infinita, podiam ser
          promovidas a compositor layers independentes e se dessincronizar
          por 1 frame sob carga (scroll rápido) — o "ghosting" ficava
          visível como contorno/sombra se descolando do preenchimento. Um
          elemento só = uma camada, sem essa divergência. */}
      <span
        ref={caixaRef}
        className="d-wordmark-text"
        aria-hidden="true"
        data-d-midia={midia}
        style={
          midia === "imagem" && imagemFallback
            ? { backgroundImage: `url("${imagemFallback}")` }
            : undefined
        }
      >
        {nome}
      </span>
      {midia === "video" && metrica && videoSrc && (
        <>
          {/* O <video> fica FORA do grupo mascarado, reduzido a 1px e
              transparente: ele é só o decodificador. Quem entra na máscara
              é o <canvas>, do tamanho exato da caixa — ver videoEmCanvas.ts
              para a medição que levou a isso (o <video> ganhava camada de
              composição própria, de 342×192 numa caixa de 342×152, e a
              máscara é operação de pintura que não vale nessa camada).
              Nada de `mix-blend-mode`: ele multiplica a superfície
              repintada por ~25× (ver "Custo por quadro dos efeitos"). */}
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: "none",
            }}
            onError={() => setVideoComErro(videoSrc)}
            onStalled={() => setVideoComErro(videoSrc)}
          />
          <MascaraDoTexto metrica={metrica}>
            {(maskId) => (
              <foreignObject x="0" y="0" width="100%" height="100%" mask={`url(#${maskId})`}>
                <canvas
                  ref={canvasRef}
                  style={{ display: "block", width: "100%", height: "100%" }}
                />
              </foreignObject>
            )}
          </MascaraDoTexto>
        </>
      )}
    </span>
  );
}
