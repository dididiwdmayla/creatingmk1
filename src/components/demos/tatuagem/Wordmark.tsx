"use client";

import { useRef, useState } from "react";

import { MascaraDoTexto, useMedidaDoTexto } from "./interactive/MascaraDoTexto";
import { useNivelMidia, type NivelMidia } from "./interactive/useNivelMidia";

/**
 * Assinatura tipográfica do estúdio (Pirata One). UMA caixa de texto,
 * sempre — `.d-wordmark-text`, com `background-clip: text` recortando o
 * preenchimento nos glifos e `-webkit-text-stroke` desenhando o contorno
 * multicor animado. A mídia do vídeo-no-título (opt-in por skin, ver
 * `SkinDefinition.videoSlots`) é o PREENCHIMENTO dessa caixa, nunca uma
 * segunda cópia do texto:
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
  // Guarda a URL que falhou, não um "falhou?": um vídeo que erra/estola
  // cai pro nível de imagem e não volta a tentar, e trocar a URL (upload
  // novo no editor) rearma sozinho, sem efeito de reset.
  const [videoComErro, setVideoComErro] = useState<string | null>(null);

  const nivel = useNivelMidia({
    videoSrc: videoSrc && videoSrc !== videoComErro ? videoSrc : undefined,
    imagemFallback,
  });
  const metrica = useMedidaDoTexto(caixaRef, nome, nivel === "video");

  // Sem medida da caixa não há máscara — e sem máscara o vídeo cobriria o
  // título inteiro. Nesse caso o nível cai um degrau, nunca pra um título
  // sem preenchimento.
  const midia: NivelMidia =
    nivel === "video" && !metrica ? (imagemFallback ? "imagem" : "nenhum") : nivel;

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
        <MascaraDoTexto metrica={metrica}>
          {(maskId) => (
            <foreignObject x="0" y="0" width="100%" height="100%" mask={`url(#${maskId})`}>
              <video
                src={videoSrc}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={() => setVideoComErro(videoSrc)}
                onStalled={() => setVideoComErro(videoSrc)}
              />
            </foreignObject>
          )}
        </MascaraDoTexto>
      )}
    </span>
  );
}
