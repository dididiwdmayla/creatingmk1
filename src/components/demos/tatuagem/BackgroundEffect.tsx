import type { Animacao } from "@/lib/demos/types";

/**
 * Efeito sutil de fundo do tema (Theme.fundoEfeito): overlay fixo,
 * pointer-events none, CSS puro (keyframes em Skin.tsx). O material bruto
 * não tem nada parecido — chrome sempre ligado dele (grão + letras góticas
 * gigantes) vive fora deste componente (ver Skin.tsx e GothicLetters.tsx);
 * isto aqui é a camada OPCIONAL extra que o editor liga por cima:
 *
 *   - "gradiente": dois radiais sangue/violeta borrados, derivando devagar;
 *   - "particulas": cinzas subindo em loop, posições determinísticas
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
  efeito: string;
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
            left: `${(i * 37 + 11) % 100}%`,
            animationDuration: `${16 + ((i * 5) % 9)}s`,
            animationDelay: `${-((i * 3.7) % 16)}s`,
            width: i % 3 === 0 ? "3px" : "2px",
            height: i % 3 === 0 ? "3px" : "2px",
          }}
        />
      ))}
    </div>
  );
}
