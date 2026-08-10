"use client";

import { DENSIDADES, type Densidade } from "@/lib/usuarios/preferencias";

/**
 * Classes de grade por densidade, ESCRITAS POR EXTENSO de propósito: o
 * Tailwind gera utilities varrendo o texto dos arquivos, então
 * `grid-cols-${n}` montado em runtime não existiria no CSS final — a grade
 * simplesmente não sairia do lugar em produção.
 */
export const GRADE_DENSIDADE: Record<Densidade, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

/**
 * Seletor de DENSIDADE das listas longas: quantos cards cabem por linha, e
 * por tabela quanto de cada card sobra (a escada de conteúdo vive no
 * `LeadCard` e no `CabecalhoBusca`).
 *
 * Ele ocupa o lugar do antigo botão "≡ Compacto/Completo", que governava a
 * mesma coisa por outro nome — dois controles para "quanto do card
 * aparece" produziam estados que se contradizem (compacto ligado + 1
 * coluna, que é justamente o card inteiro). Saldo de controles na barra de
 * filtros: zero.
 *
 * O ícone é a própria grade (1 a 4 barras), não um número solto: o que se
 * escolhe é a FORMA da lista. Largura fixa por botão, senão alternar
 * empurraria a barra de filtros inteira — mesma razão de o rótulo do botão
 * antigo ser o MODO e não a ação.
 */
export function SeletorDensidade({
  valor,
  onEscolher,
  desabilitado,
}: {
  /** Densidade EFETIVA (escolha do usuário ou padrão da largura da tela). */
  valor: Densidade;
  onEscolher: (densidade: Densidade) => void;
  desabilitado?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Cards por linha"
      className="flex shrink-0 items-center gap-0.5 rounded border border-line bg-surface-2 p-0.5"
    >
      {DENSIDADES.map((densidade) => {
        const ativa = densidade === valor;
        return (
          <button
            key={densidade}
            type="button"
            onClick={() => onEscolher(densidade)}
            disabled={desabilitado}
            aria-pressed={ativa}
            title={`${densidade} card${densidade > 1 ? "s" : ""} por linha`}
            className={`flex h-6 w-7 items-center justify-center gap-px rounded-[3px] disabled:opacity-50 ${
              ativa ? "bg-accent/15 text-accent" : "text-ink-muted hover:text-foreground"
            }`}
          >
            <span className="sr-only">
              {densidade} card{densidade > 1 ? "s" : ""} por linha
            </span>
            {/* Barras com altura e largura explícitas: <span> inline ignora
                width/height e viraria caixa 0×0 (ver [data-ponto-busca]). */}
            {Array.from({ length: densidade }, (_, i) => (
              <span
                key={i}
                aria-hidden
                className="block h-3 w-0.5 rounded-[1px] bg-current"
              />
            ))}
          </button>
        );
      })}
    </div>
  );
}
