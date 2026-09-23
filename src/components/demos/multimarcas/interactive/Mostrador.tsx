import type { Ref } from "react";

/**
 * O PAINEL DE INSTRUMENTOS da skin (docs/plano-multimarcas.md §3): o
 * velocímetro cuja agulha segue a velocidade com que se rola a página. É a
 * essência que existe nas quatro variantes, em escalas e lugares
 * diferentes — quem move a agulha é o `Hero` (um `ref` só, um mostrador
 * só por página); este componente só desenha.
 *
 *  - `selo`:      54px no canto da abertura tipográfica (material bruto);
 *  - `marcador`:  ao lado das faixas de preço da busca, com a legenda;
 *  - `mostrador`: grande, no pé da foto sangrada, com escala e zona
 *                 vermelha — o painel de um esportivo;
 *  - `canto`:     médio, no canto da moldura da foto dividida.
 *
 * Mesmo `viewBox` nas quatro (centro em 50,46): a rotação da agulha é a
 * mesma conta em qualquer tamanho, e o tamanho é CSS (`.mm-gauge-svg`).
 */
export type EscalaDoMostrador = "selo" | "marcador" | "mostrador" | "canto";

const CENTRO = { x: 50, y: 46 };

/** Ponto do arco no ângulo `graus` (0 = para cima), raio `r`. */
function ponto(graus: number, r: number): { x: number; y: number } {
  const rad = (graus * Math.PI) / 180;
  return { x: CENTRO.x + r * Math.sin(rad), y: CENTRO.y - r * Math.cos(rad) };
}

/** Marcas da escala: de -115° a 115°, uma a cada 23°; as três últimas na zona vermelha. */
const MARCAS = Array.from({ length: 11 }, (_, i) => -115 + i * 23);

export function Mostrador({
  escala,
  agulha,
  legenda,
}: {
  escala: EscalaDoMostrador;
  agulha: Ref<SVGGElement>;
  /** Legenda da escala ("RPM ×1000") — só nas escalas grandes. */
  legenda?: string;
}) {
  const detalhado = escala === "mostrador" || escala === "canto";
  return (
    <svg className="mm-gauge-svg" data-escala={escala} viewBox="0 0 100 78" fill="none" aria-hidden="true">
      {detalhado && <circle cx="50" cy="46" r="49" fill="var(--d-bg-elev)" opacity=".92" />}
      <path d="M14 70 A44 44 0 1 1 86 70" stroke="var(--d-border)" strokeWidth={detalhado ? 3 : 5} strokeLinecap="round" />
      <path d="M79 30 A44 44 0 0 1 86 70" stroke="var(--d-accent)" strokeWidth={detalhado ? 3 : 5} strokeLinecap="round" />
      {detalhado &&
        MARCAS.map((graus, i) => {
          const de = ponto(graus, 41);
          const ate = ponto(graus, i % 2 === 0 ? 34 : 37);
          return (
            <line
              key={graus}
              x1={de.x}
              y1={de.y}
              x2={ate.x}
              y2={ate.y}
              stroke={i >= MARCAS.length - 3 ? "var(--d-accent)" : "var(--d-muted)"}
              strokeWidth={i % 2 === 0 ? 1.8 : 1}
            />
          );
        })}
      {detalhado && legenda && (
        <text
          x="50"
          y="33"
          textAnchor="middle"
          fill="var(--d-muted)"
          style={{ font: "500 5px var(--d-mono)", letterSpacing: "1px" }}
        >
          {legenda}
        </text>
      )}
      <g ref={agulha} transform="rotate(-115 50 46)">
        <line x1="50" y1="46" x2="50" y2={detalhado ? 10 : 12} stroke="var(--d-text)" strokeWidth={detalhado ? 2.5 : 4} strokeLinecap="round" />
      </g>
      <circle cx="50" cy="46" r={detalhado ? 4 : 5} fill="var(--d-accent)" />
    </svg>
  );
}
