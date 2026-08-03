"use client";

import { useEffect, useState, type CSSProperties } from "react";

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
 *     como `var(--d-efeito-cN, <cor do tema>)`.
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
  const animando = useAnimacaoDeCorAtiva(props.pausado);

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
    <div style={estilo} data-d-efeito-camada={id}>
      {coresCss && <style>{coresCss}</style>}
      <EfeitoDinamico id={id} {...props} />
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
