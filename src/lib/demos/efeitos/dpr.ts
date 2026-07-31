/**
 * devicePixelRatio limitado a `max` (default 2) — todo efeito que
 * rasteriza (canvas) usa isto pra dimensionar o desenho, senão um celular
 * 3x/4x desperdiça memória/CPU numa textura que ninguém vê com mais
 * nitidez. `undefined`/servidor cai em 1 (sem rasterização nenhuma lá).
 */
export function devicePixelRatioClamped(max = 2): number {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, max);
}
