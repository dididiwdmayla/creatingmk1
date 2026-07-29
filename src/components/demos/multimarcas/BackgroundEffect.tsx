import type { Animacao, FundoEfeito } from "@/lib/demos/types";

/**
 * Efeito sutil de fundo do tema (Theme.fundoEfeito) — idêntico ao das
 * demais skins (mesmo padrão, mesmas classes `.d-bg-gradiente`/
 * `.d-bg-particulas` definidas no `<style>` de Skin.tsx). Ver
 * src/components/demos/barbearia/BackgroundEffect.tsx para os detalhes.
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
