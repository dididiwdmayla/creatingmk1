import type { ComponentType } from "react";

import type { CorModo, ThemePaleta } from "../types";

/**
 * Contrato dos efeitos visuais (camada decorativa opcional por cima de uma
 * skin — bem diferente de skin/BackgroundEffect, que são fixos por
 * template). Um efeito é um componente PURO nos dados que recebe:
 *
 *   - intensidade: 0 desliga por completo (o componente não deve montar
 *     nada no DOM), 1–3 escala o efeito;
 *   - cores: a paleta do tema vigente (não hardcode cor nenhuma);
 *   - pausado: sinal externo opcional (ex.: o editor esconde o preview).
 *
 * Além do `pausado` explícito, todo efeito pausa sozinho quando sai da
 * viewport (IntersectionObserver) e quando a aba fica oculta
 * (visibilitychange) — ver ./useEfeitoAtivo. Renderiza estático (sem loop
 * de JS de movimento) quando `prefers-reduced-motion` está ativo. Nunca
 * anima a propriedade `filter` (blur é assado no elemento, só transform
 * anima). devicePixelRatio é sempre limitado a 2 em qualquer rasterização
 * (canvas). O componente é sempre carregado por import dinâmico sem SSR
 * (ver ./dynamicComponents) — nunca bloqueia o first paint da demo.
 */

/** 0 = desligado; 1–3 = intensidade crescente. */
export type EfeitoIntensidade = 0 | 1 | 2 | 3;

export const EFEITO_INTENSIDADES: readonly EfeitoIntensidade[] = [0, 1, 2, 3];

/** Props que TODO componente de efeito recebe. */
export interface EfeitoProps {
  intensidade: EfeitoIntensidade;
  /** Paleta do tema vigente da demo (skin + preset + ajustes do editor). */
  cores: ThemePaleta;
  /** Sinal de pausa externo (além das pausas automáticas por viewport/aba). */
  pausado?: boolean;
}

/** Entrada do registro de efeitos (ver ./registry.ts). Metadado puro — o
 * componente em si só é resolvido sob demanda (ver ./dynamicComponents.ts),
 * pra quem só precisa listar efeitos (ex.: um seletor no editor) nunca
 * pagar o custo de baixar o código de todos eles. */
export interface EfeitoDefinition {
  id: string;
  /** Nome legível (ex.: "Aura"). */
  nome: string;
  /** Nichos (ids de SkinDefinition.nicho) recomendados para este efeito. */
  nichosRecomendados: readonly string[];
  /**
   * MODOS DE COR REPROVADOS neste efeito (ver o portão de qualidade em
   * ARCHITECTURE.md, "fps em celular com CPU limitada"). O piso de 45 fps
   * é medido POR CÉLULA, efeito × modo de cor: quando um efeito só reprova
   * em alguns modos, quem sai é o MODO, não o efeito — a demo que já
   * escolheu esse par continua válida e simplesmente cai em `tema`
   * (`resolverCamadaEfeito`), e o editor mostra o modo desabilitado com o
   * motivo. Ausente = nenhum modo reprovado.
   */
  modosDeCorReprovados?: readonly CorModo[];
  /** Por que os modos acima reprovaram — texto curto, mostrado no editor. */
  motivoModosReprovados?: string;
}

/** Componente de efeito, já resolvido (ver getEfeitoComponenteDinamico). */
export type EfeitoComponente = ComponentType<EfeitoProps>;
