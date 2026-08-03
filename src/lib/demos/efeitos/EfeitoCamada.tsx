"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { useCoberturaAnimada } from "../animacao/medirCobertura";
import type { ModoCoresResolvido } from "../cores/modos";
import { EfeitoDinamico } from "./dynamicComponents";
import type { EfeitoProps } from "./types";

/**
 * Camada que envolve o efeito de fundo. O efeito em si continua sendo o
 * componente puro de sempre (`EfeitoProps`); esta camada só carrega o que
 * é COMUM a todos e não caberia dentro de nenhum:
 *
 *   - o `<style>` do MODO DE COR (`@property` + `@keyframes` — ver
 *     ../cores/modos.ts) e a animação que gira as custom properties, que
 *     o efeito consome sem saber, porque as cores que ele recebe já vêm
 *     como `var(--d-efeito-cN, <cor do tema>)`;
 *   - o `--d-efeito-fade` (0–1), a opacidade da camada conforme as seções
 *     com animação LIGADA entram e saem da viewport (ver
 *     ../animacao/cobertura.ts). Todo efeito multiplica essa var na
 *     opacidade do próprio elemento-raiz — é uma custom property, e não
 *     opacidade nesta div, justamente porque `opacity < 1` criaria um
 *     stacking context (o mesmo motivo do parágrafo abaixo).
 *
 * Chegando a zero, o efeito recebe `pausado`: o motor CONGELA (o
 * `animation-play-state` dos @keyframes e o rAF de quem tem loop), nunca
 * desmonta. É o que garante que partículas e traços voltem de onde
 * pararam quando a próxima seção animada aparecer, em vez de reiniciarem
 * embaralhados.
 *
 * O elemento desta camada é um `<div>` DELIBERADAMENTE sem estilo de
 * posicionamento, opacidade ou transform: qualquer um dos três criaria um
 * stacking context, e um stacking context novo em volta dos efeitos
 * mudaria como o `mix-blend-mode` de aura/faíscas/varredura se compõe com
 * a página (o efeito deixaria de somar luz sobre o conteúdo). Ele existe
 * só pra HERDAR as custom properties aos filhos; os efeitos continuam se
 * posicionando sozinhos (`position: fixed; inset: 0; z-index: 40`), então
 * a caixa desta div é vazia e não ocupa altura nenhuma no fluxo.
 *
 * A animação de cor não usa `useEfeitoAtivo` (o IntersectionObserver de
 * lá observaria justamente esta div de área zero, que fica no fim do
 * documento — daria "fora da viewport" quase sempre). Ela pausa pelas
 * duas fontes que fazem sentido aqui: aba oculta e o `pausado` externo;
 * `prefers-reduced-motion` não anima cor nenhuma (fica na cor inicial,
 * que é o primeiro quadro do ciclo).
 */
export function EfeitoCamada({
  id,
  coresCss,
  coresAnimacao,
  ...props
}: {
  id: string;
  /** Bloco `@property`/`@keyframes` do modo de cor ("" = modo "tema"). */
  coresCss: string;
  coresAnimacao?: ModoCoresResolvido["animacao"];
} & EfeitoProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Fora de toda seção animada: o efeito para de gastar quadro, mas
  // continua montado e com o estado dele intacto.
  const [foraDeSecaoAnimada, setForaDeSecaoAnimada] = useState(false);
  const aoMudarCobertura = useCallback((valor: number) => {
    ref.current?.style.setProperty("--d-efeito-fade", String(valor));
    setForaDeSecaoAnimada(valor === 0);
  }, []);
  useCoberturaAnimada(aoMudarCobertura);

  const pausado = props.pausado || foraDeSecaoAnimada;
  const animando = useAnimacaoDeCorAtiva(pausado);

  const estilo: CSSProperties | undefined = coresAnimacao
    ? {
        animationName: animando.reducedMotion ? "none" : coresAnimacao.nome,
        animationDuration: `${coresAnimacao.duracaoSegundos}s`,
        animationTimingFunction: coresAnimacao.timing,
        animationIterationCount: "infinite",
        animationPlayState: animando.rodando ? "running" : "paused",
      }
    : undefined;

  return (
    <div ref={ref} style={estilo} data-d-efeito-camada={id}>
      {coresCss && <style>{coresCss}</style>}
      <EfeitoDinamico id={id} {...props} pausado={pausado} />
    </div>
  );
}

function useAnimacaoDeCorAtiva(pausado = false) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [abaVisivel, setAbaVisivel] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onVisibility = () => setAbaVisivel(document.visibilityState === "visible");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return { rodando: abaVisivel && !pausado, reducedMotion };
}
