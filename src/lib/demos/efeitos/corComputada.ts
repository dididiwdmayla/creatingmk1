/**
 * Leitura da cor da camada por um efeito que pinta em CANVAS.
 *
 * Um efeito recebe `cores: ThemePaleta` como STRINGS CSS, e nos modos de cor
 * animados essa string é um `var(--d-efeito-cN, #hex)` que o navegador
 * interpola a 60 Hz (ver ../cores/modos.ts). Quem desenha em CSS
 * simplesmente interpola a string no `background` — e paga o repinte da
 * superfície inteira a cada quadro. Quem desenha em canvas faz o contrário:
 * põe a string no `color` do próprio canvas, LÊ o valor computado de vez em
 * quando e desenha com números. É assim que `ondas` e `aura` respeitam os
 * cinco modos de cor sem saber que eles existem.
 *
 * Compartilhado porque a conversão é a mesma nos dois — e um dia em que ela
 * divergisse (um formato novo de `getComputedStyle().color`, por exemplo)
 * um dos dois efeitos ficaria sem cor sem ninguém perceber.
 */

export type Rgb = [number, number, number];

/**
 * `color` computado → RGB. O navegador sempre devolve `rgb()`/`rgba()`
 * (inclusive resolvendo o `var()` animado); o ramo do hex existe só como
 * rede pra ambiente que não computa estilo (SSR/jsdom).
 */
export function corParaRgb(valor: string): Rgb | undefined {
  const rgb = valor.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const hex = valor.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hex) return undefined;
  const cheio = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
  return [
    parseInt(cheio.slice(0, 2), 16),
    parseInt(cheio.slice(2, 4), 16),
    parseInt(cheio.slice(4, 6), 16),
  ];
}

export function rgba([r, g, b]: Rgb, alfa: number): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alfa})`;
}
