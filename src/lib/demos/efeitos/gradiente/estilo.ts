import type { EfeitoIntensidade } from "../types";

/**
 * Estilo do overlay do efeito "gradiente", separado do componente pra ser
 * testável sem DOM (ver __tests__/estilo.test.ts) — mesma convenção do
 * resto do repo (lógica pura extraída, componente fica fino).
 *
 * **Sem `filter` NENHUM** (nem fixo — ver "A queda do blur" abaixo): só a
 * opacidade escala com a intensidade; a animação em si (transform, via
 * @keyframes d-efeito-gradiente-drift) só liga sem `reducedMotion`, e só
 * corre (`animationPlayState`) quando `ativo`.
 *
 * ## A queda do blur (medido, não estimado)
 *
 * Até esta correção o overlay pintava duas manchas radiais de contorno
 * curto e jogava `filter: blur(80px)` por cima. O contrato dos efeitos já
 * proibia ANIMAR `filter`, e ele não era animado — mas isso não basta: o
 * elemento é 150% da viewport (`inset: -25%`) e tem uma animação de
 * `transform` infinita. Um elemento com `filter` não composita a
 * transformação — o navegador re-rasteriza E re-borra a superfície INTEIRA
 * a cada quadro. Medido no preview do editor (1400×900, Chromium
 * headless), com o efeito ocioso, sem LED e sem modo de cor animado:
 *
 *   - como estava (blur + animação de transform): **10 fps**
 *   - tirando só o `filter`, mantendo a animação:  **55 fps**
 *   - mantendo o `filter`, parando a animação:     **59 fps**
 *
 * Ou seja: nenhum dos dois sozinho custa nada, e a combinação derruba a
 * página a 1/6 do quadro. Nenhum outro efeito do registro chegava perto
 * (grão/faíscas/partículas/varredura ficam em 60 fps), o que bate com o
 * relato de que os efeitos em canvas não travavam.
 *
 * A suavidade não se perdeu: blur gaussiano de uma mancha radial é, para
 * esta forma, a MESMA coisa que alargar a rampa de stops — e rampa de
 * gradiente é repintura barata, não re-rasterização de superfície filtrada
 * (ver `PARADAS_*` em ./Gradiente.tsx, que ganharam stops intermediários e
 * uma cauda mais longa exatamente pra isso).
 */

/**
 * Teto de 6% (era 0.06/0.10/0.15). O efeito é renderizado POR CIMA do
 * conteúdo (ver ARCHITECTURE.md, "Cobertura de viewport"), então a
 * opacidade é a única coisa entre a mancha e a legibilidade do texto.
 */
const OPACIDADE_POR_INTENSIDADE: Record<1 | 2 | 3, number> = { 1: 0.025, 2: 0.04, 3: 0.06 };

export interface EstiloGradiente {
  /**
   * Sempre `"none"`. Existe como campo (em vez de sumir do contrato) pra
   * que o teste de regressão consiga cobrar a ausência do filtro em toda
   * combinação de intensidade/reduced-motion/pausa, e não só na leitura
   * do componente.
   */
  filter: "none";
  opacity: number;
  animationName: string;
  animationPlayState: "running" | "paused";
}

export function estiloGradiente(
  intensidade: Exclude<EfeitoIntensidade, 0>,
  reducedMotion: boolean,
  ativo: boolean,
): EstiloGradiente {
  return {
    filter: "none",
    opacity: OPACIDADE_POR_INTENSIDADE[intensidade],
    // reducedMotion = estático: nenhum @keyframes ligado, não só pausado.
    animationName: reducedMotion ? "none" : "d-efeito-gradiente-drift",
    animationPlayState: ativo ? "running" : "paused",
  };
}
