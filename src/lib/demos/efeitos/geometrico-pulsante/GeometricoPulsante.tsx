"use client";

import { useMemo, useRef, type CSSProperties } from "react";

import type { EfeitoProps } from "../types";
import { useEfeitoAtivo } from "../useEfeitoAtivo";
import { arcosGeometricoPulsante, opacidadeGeometricoPulsante } from "./estilo";

/**
 * Arcos soltos pulsando, nunca um polígono (ver ./estilo.ts para a
 * geometria e o histórico dos hexágonos fechados que existiam aqui).
 *
 * Três coisas garantem que nada leia como figura desenhada:
 *
 * 1. cada arco é uma FITA afilada (../fita.ts) — espessura zero nas duas
 *    pontas e variável no meio, então não existe topo reto de `stroke`
 *    nem espessura uniforme;
 * 2. o brilho varia AO LONGO do traço: cada arco recebe um
 *    `linearGradient` próprio, em `userSpaceOnUse`, alinhado com os
 *    extremos do arco (`de` → `ate`), com padrões de stop diferentes por
 *    arco — o mesmo traço acende e apaga em pontos distintos;
 * 3. o grupo inteiro é mascarado por um radial que termina em
 *    transparente, então nenhum arco encosta na borda da viewport com
 *    intensidade.
 *
 * A cor sai só de `cores.destaque` (mais uma mistura com branco pra banda
 * de brilho): a versão anterior usava `cores.textoSuave`, a tinta ESCURA
 * do tema, que num preset claro escurecia a página em vez de tingi-la.
 * O pulso segue em `transform: scale` + `opacity` — nunca `filter`, como
 * manda o contrato dos efeitos.
 */
export function GeometricoPulsante({ intensidade, cores, pausado }: EfeitoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ativo, reducedMotion } = useEfeitoAtivo(containerRef, pausado);

  const arcos = useMemo(
    () => (intensidade === 0 ? [] : arcosGeometricoPulsante(intensidade)),
    [intensidade],
  );

  if (intensidade === 0) return null;

  const opacidade = opacidadeGeometricoPulsante(intensidade);
  const brilho = `color-mix(in srgb, ${cores.destaque} 45%, white)`;
  // Perfis de brilho ao longo do traço — 4 padrões, escolhidos por arco.
  // Nenhum começa nem termina cheio: a fita já afina nas pontas e o alfa
  // acompanha, então o traço some em vez de ser cortado.
  const perfis = [
    [0.05, 0.95, 0.3, 1, 0.08],
    [0.1, 0.4, 1, 0.5, 0.05],
    [0.02, 0.7, 0.25, 0.9, 0.12],
    [0.12, 1, 0.45, 0.7, 0.03],
  ];
  const mascara =
    "radial-gradient(closest-side circle at 50% 50%, rgba(0,0,0,1) 40%, rgba(0,0,0,0.45) 72%, transparent 100%)";

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden="true"
      style={{ opacity: "var(--d-efeito-fade, 1)" }}
    >
      <style>{`
        @keyframes d-efeito-geometrico-pulso {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.6; }
        }
      `}</style>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        style={{ maskImage: mascara, WebkitMaskImage: mascara } as CSSProperties}
      >
        <defs>
          {arcos.map((arco, i) => (
            <linearGradient
              key={i}
              id={`d-efeito-geometrico-b${i}`}
              gradientUnits="userSpaceOnUse"
              x1={arco.de.x}
              y1={arco.de.y}
              x2={arco.ate.x}
              y2={arco.ate.y}
            >
              {perfis[arco.brilho].map((alfa, j, todos) => (
                <stop
                  key={j}
                  offset={`${(j / (todos.length - 1)) * 100}%`}
                  // `stop-color` no STYLE (não como atributo de
                  // apresentação, que não resolve `var(...)`): a cor pode
                  // chegar como custom property animada pelo modo de cor.
                  style={{ stopColor: j % 2 === 1 ? brilho : cores.destaque }}
                  stopOpacity={alfa}
                />
              ))}
            </linearGradient>
          ))}
        </defs>
        <g opacity={opacidade}>
          {arcos.map((arco, i) => (
            <path
              key={i}
              d={arco.d}
              fill={`url(#d-efeito-geometrico-b${i})`}
              style={{
                transformBox: "view-box",
                transformOrigin: "50px 50px",
                animationName: reducedMotion ? "none" : "d-efeito-geometrico-pulso",
                animationDuration: "4.4s",
                animationDelay: `${arco.atrasoSegundos}s`,
                animationTimingFunction: "ease-in-out",
                animationIterationCount: "infinite",
                animationPlayState: ativo ? "running" : "paused",
              }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
