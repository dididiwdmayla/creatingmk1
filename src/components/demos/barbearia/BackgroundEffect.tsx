import type { Animacao, FundoEfeito } from "@/lib/demos/types";

/**
 * Efeito sutil de fundo do tema (Theme.fundoEfeito): overlay fixo,
 * pointer-events none, por cima do conteúdo com opacidade baixa — mesmo
 * padrão do noise-overlay da skin. CSS puro (keyframes em Skin.tsx),
 * animando só transform/opacity (GPU, custo baixo em mobile):
 *
 *   - "gradiente": dois radiais com as cores de acento, borrados, derivando
 *     devagar (um único elemento animado);
 *   - "particulas": 14 pontos subindo em loop, posições determinísticas
 *     (mesmo HTML no server e no client — nada de Math.random).
 *
 * `animacao: "nenhuma"` desliga o efeito por completo (nem entra no DOM);
 * prefers-reduced-motion esconde via CSS.
 */

const PARTICULAS = 14;

export function BackgroundEffect({
  efeito,
  animacao,
}: {
  efeito: FundoEfeito;
  animacao: Animacao;
}) {
  if (efeito === "nenhum" || animacao === "nenhuma") return null;

  if (efeito === "gradiente") {
    return <div className="d-bg-gradiente" aria-hidden="true" />;
  }

  return (
    <div className="d-bg-particulas" aria-hidden="true">
      {Array.from({ length: PARTICULAS }, (_, i) => (
        <span
          key={i}
          style={{
            // Pseudo-aleatório determinístico por índice: espalha posição,
            // duração e atraso sem quebrar a hidratação.
            left: `${(i * 37 + 11) % 100}%`,
            animationDuration: `${14 + ((i * 5) % 9)}s`,
            animationDelay: `${-((i * 3.7) % 14)}s`,
            width: i % 3 === 0 ? "3px" : "2px",
            height: i % 3 === 0 ? "3px" : "2px",
          }}
        />
      ))}
    </div>
  );
}
