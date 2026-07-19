import { VideoNoTitulo } from "./interactive/VideoNoTitulo";

/**
 * Assinatura tipográfica do estúdio (Pirata One). Base SEMPRE presente,
 * 100% CSS (gradiente que deriva devagar + contorno multicor animado via
 * `background-clip: text`/`-webkit-text-stroke`) — cor sólida fiel ao
 * espírito do original sem depender de asset nenhum.
 *
 * Vídeo-no-título é opt-in por skin (SkinDefinition.videoSlots — ver
 * registry.ts) e vem por cima como camada progressiva (VideoNoTitulo,
 * "use client"): com `videoSrc` configurado (upload em
 * /api/leads/[id]/demo/videos) e conexão/motion permitindo, o vídeo do
 * lead roda mascarado pelas letras — fiel ao efeito do material bruto
 * (vídeo com máscara SVG do wordmark original). Sem vídeo, com erro, ou
 * em conexão lenta/prefers-reduced-motion, cai pra `imagemFallback`
 * (mesma técnica, foto estática) e, na falta dela também, fica só a base
 * CSS abaixo — nunca quebra, nunca pisca em branco.
 *
 * Wordmark continua Server Component puro (o overlay é quem é client).
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
  return (
    <span className={`d-wordmark ${className}`} data-demo-slot={slot} aria-label={nome}>
      {/* Preenchimento em gradiente + contorno multicor NO MESMO elemento
          (background-clip:text + -webkit-text-stroke): duas camadas irmãs
          seguindo o mesmo texto, cada uma com sua própria animação CSS
          infinita, podiam ser promovidas a compositor layers independentes
          e se dessincronizar por 1 frame sob carga (scroll rápido) — o
          "ghosting" ficava visível como contorno/sombra se descolando do
          preenchimento. Um elemento só = uma camada, sem essa divergência. */}
      <span className="d-wordmark-text" aria-hidden="true">
        {nome}
      </span>
      {(videoSrc || imagemFallback) && (
        <VideoNoTitulo nome={nome} videoSrc={videoSrc} imagemFallback={imagemFallback} />
      )}
    </span>
  );
}
