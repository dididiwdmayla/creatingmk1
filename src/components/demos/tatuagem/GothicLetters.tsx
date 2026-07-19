/**
 * Letras góticas gigantes espalhadas atrás do conteúdo — chrome FIXO da
 * skin (sempre ligado), fiel ao `<GothicBackground>` do material bruto:
 * lá é uma lista fixa de ~40 posições soletrando "VERTEBRA"; aqui as
 * posições nascem do índice do caractere sobre o NOME do negócio (dado),
 * determinístico (mesmo HTML no server e no client — nada de
 * Math.random, ao contrário do original que sorteava por render). Sem
 * animação (o original também não anima essas letras). `aria-hidden` e
 * `user-select: none` — puramente decorativo.
 */
const POSICOES = 40;

export function GothicLetters({ nome }: { nome: string }) {
  const letras = nome.replace(/[^\p{L}]/gu, "").toUpperCase() || "TATUAGEM";

  return (
    <div className="d-gothic-bg" aria-hidden="true">
      {Array.from({ length: POSICOES }, (_, i) => {
        const char = letras[i % letras.length];
        // Pseudo-aleatório determinístico por índice: espalha posição,
        // tamanho, rotação e opacidade sem depender de Math.random.
        const left = (i * 47 + 7) % 100;
        const top = (i * 29 + 11) % 100;
        const size = 3 + ((i * 13) % 15); // 3rem .. 17rem
        const rotate = ((i * 53) % 70) - 35; // -35deg .. 34deg
        const opacity = 0.03 + ((i * 7) % 15) / 100; // 0.03 .. 0.17
        return (
          <span
            key={i}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              fontSize: `${size}rem`,
              transform: `rotate(${rotate}deg)`,
              opacity,
            }}
          >
            {char}
          </span>
        );
      })}
    </div>
  );
}
