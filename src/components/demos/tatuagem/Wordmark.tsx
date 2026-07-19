/**
 * Assinatura tipográfica do estúdio (Pirata One) com preenchimento em
 * gradiente que deriva devagar + contorno multicor (d-stroke-cycle) por
 * cima — mesma leitura visual do material bruto (nome em blackletter com
 * "tinta" se movendo dentro das letras + contorno multicor animado no
 * SVG), só que 100% CSS (gradiente + `background-clip: text` e
 * `-webkit-text-stroke`) em vez do vídeo com máscara SVG do original:
 * mantém a Forja de Demos livre de assets binários (todo o resto do
 * sistema usa só SVG local — ver ARCHITECTURE.md, "Imagens: placeholder
 * local"), sem herdar um vídeo de textura de tinta de terceiros.
 *
 * Server Component puro — as duas keyframes (drift do preenchimento +
 * ciclo de cor do contorno) já ficam definidas em Skin.tsx.
 */
export function Wordmark({ nome, className = "" }: { nome: string; className?: string }) {
  return (
    <span className={`d-wordmark ${className}`} aria-label={nome}>
      <span className="d-wordmark-fill" aria-hidden="true">
        {nome}
      </span>
      <span className="d-wordmark-stroke" aria-hidden="true">
        {nome}
      </span>
    </span>
  );
}
