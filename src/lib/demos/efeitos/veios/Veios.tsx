"use client";

import { useMemo, useRef, type CSSProperties } from "react";

import type { EfeitoProps } from "../types";
import { useEfeitoAtivo } from "../useEfeitoAtivo";
import { opacidadeBase, opacidadePulso, veiosTracos } from "./geometria";

const BRILHO_ID = "d-efeito-veios-brilho";

/**
 * Veios: traços orgânicos com um brilho viajando por dentro de cada um.
 *
 * A forma vem de ./geometria.ts — fita afilada sobre uma cúbica, sem
 * `stroke` nenhum, então nada tem espessura constante nem ponta reta.
 * Este componente cuida da LUZ, que a revisão visual também reprovou (o
 * pulso era um tracinho de `stroke-dasharray` com tamanho fixo e opacidade
 * cheia, lendo como um risco brilhante deslizando):
 *
 * - **base**: cada veio é preenchido por um `linearGradient` próprio,
 *   alinhado com os extremos do traço, com alfa diferente em cada stop —
 *   o traço acende e apaga ao longo de si mesmo, nunca uniforme;
 * - **pulso**: uma mancha de gradiente RADIAL (sem borda: o alfa cai a
 *   zero antes do raio acabar) atravessa o traço recortada pelo próprio
 *   contorno da fita (`clipPath`), então ela só existe dentro do veio e
 *   some sozinha nas pontas afiladas. O trajeto de cada mancha entra por
 *   custom property (`--d-veio-x0/y0` → `--d-veio-x1/y1`), o que deixa o
 *   `@keyframes` único e compartilhado — CSS puro, sem rAF nem JS por
 *   frame, como manda o contrato dos efeitos.
 *
 * O SVG inteiro ainda é mascarado por um radial até transparente, então
 * nenhum traço encosta na borda da viewport com intensidade.
 */
export function Veios({ intensidade, cores, pausado }: EfeitoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ativo, reducedMotion } = useEfeitoAtivo(containerRef, pausado);

  const tracos = useMemo(() => (intensidade === 0 ? [] : veiosTracos(intensidade)), [intensidade]);

  if (intensidade === 0) return null;

  const mascara =
    "radial-gradient(circle at 50% 45%, rgba(0,0,0,1) 30%, rgba(0,0,0,0.5) 66%, transparent 92%)";
  const claro = `color-mix(in srgb, ${cores.destaque} 55%, white)`;
  // Alfa por stop: a base do traço nunca é chapada de ponta a ponta.
  const perfis = [
    [0.08, 1, 0.35, 0.8, 0.06],
    [0.05, 0.5, 1, 0.4, 0.1],
    [0.12, 0.85, 0.25, 1, 0.04],
  ];

  return (
    <div
      ref={containerRef}
      // fixed + z-index positivo: mesma convenção dos demais efeitos (ver
      // ARCHITECTURE.md, "Cobertura de viewport" / bug histórico do
      // z-index negativo).
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        style={{ maskImage: mascara, WebkitMaskImage: mascara } as CSSProperties}
      >
        <style>{`
          @keyframes d-efeito-veios-pulso {
            0%   { transform: translate(var(--d-veio-x0), var(--d-veio-y0)); opacity: 0; }
            18%  { opacity: 1; }
            82%  { opacity: 1; }
            100% { transform: translate(var(--d-veio-x1), var(--d-veio-y1)); opacity: 0; }
          }
        `}</style>
        <defs>
          <radialGradient id={BRILHO_ID}>
            <stop offset="0%" stopColor={claro} stopOpacity={1} />
            <stop offset="45%" stopColor={cores.destaque} stopOpacity={0.55} />
            <stop offset="100%" stopColor={cores.destaque} stopOpacity={0} />
          </radialGradient>
          {tracos.map((traco, i) => (
            <linearGradient
              key={i}
              id={`d-efeito-veios-b${i}`}
              gradientUnits="userSpaceOnUse"
              x1={traco.de.x}
              y1={traco.de.y}
              x2={traco.ate.x}
              y2={traco.ate.y}
            >
              {perfis[i % perfis.length].map((alfa, j, todos) => (
                <stop
                  key={j}
                  offset={`${(j / (todos.length - 1)) * 100}%`}
                  stopColor={j % 2 === 1 ? claro : cores.destaque}
                  stopOpacity={alfa}
                />
              ))}
            </linearGradient>
          ))}
          {tracos.map((traco, i) => (
            <clipPath key={i} id={`d-efeito-veios-c${i}`}>
              <path d={traco.d} />
            </clipPath>
          ))}
        </defs>
        {tracos.map((traco, i) => (
          <g key={i}>
            <path d={traco.d} fill={`url(#d-efeito-veios-b${i})`} opacity={opacidadeBase(intensidade)} />
            <g clipPath={`url(#d-efeito-veios-c${i})`} opacity={opacidadePulso(intensidade)}>
              <circle
                r={13}
                fill={`url(#${BRILHO_ID})`}
                style={
                  {
                    transformBox: "view-box",
                    transformOrigin: "0 0",
                    "--d-veio-x0": `${traco.de.x}px`,
                    "--d-veio-y0": `${traco.de.y}px`,
                    "--d-veio-x1": `${traco.ate.x}px`,
                    "--d-veio-y1": `${traco.ate.y}px`,
                    // reducedMotion = estático: sem @keyframes ligado, a
                    // mancha para no meio do trajeto (visível) em vez de
                    // ficar parada na ponta com opacidade 0.
                    ...(reducedMotion
                      ? {
                          transform: `translate(${(traco.de.x + traco.ate.x) / 2}px, ${
                            (traco.de.y + traco.ate.y) / 2
                          }px)`,
                        }
                      : null),
                    animationName: reducedMotion ? "none" : "d-efeito-veios-pulso",
                    animationDuration: `${traco.duracaoSegundos}s`,
                    animationDelay: `${traco.atrasoSegundos}s`,
                    animationTimingFunction: "ease-in-out",
                    animationIterationCount: "infinite",
                    animationPlayState: ativo ? "running" : "paused",
                  } as CSSProperties
                }
              />
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}
