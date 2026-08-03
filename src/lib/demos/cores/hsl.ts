/**
 * Conversão de cor mínima para os MODOS DE COR da camada decorativa (ver
 * ./modos.ts): matiz é a única coisa que os modos "iridescente" e
 * "arco-íris" precisam manipular, e manipular matiz exige sair do hex.
 *
 * Puro e sem DOM de propósito (testado em __tests__/hsl.test.ts): a
 * resolução dos modos roda no SERVIDOR (rota pública) e no cliente
 * (preview do editor) com o mesmo resultado — nenhuma leitura de
 * `getComputedStyle` no meio.
 *
 * Não confundir com `lib/demos/tema.ts#luminancia/inkPara`, que resolve
 * CONTRASTE (WCAG) sobre a cor de destaque — outro problema, outra
 * matemática, e nada aqui deve ser usado pra decidir legibilidade.
 */

/** Matiz em graus [0,360), saturação e luminosidade em [0,1]. */
export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** #rgb ou #rrggbb (mesma tolerância de leitura do HEX_RE de tema.ts). */
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function ehHex(valor: string | undefined): valor is string {
  return typeof valor === "string" && HEX_RE.test(valor);
}

/**
 * `undefined` quando a cor não é hex — é o sinal que faz os modos de cor
 * caírem no comportamento do tema em vez de inventar um matiz. Uma paleta
 * pode, em tese, trazer `rgba()`/`color-mix()` (a borda de vários presets
 * já traz), e nenhum modo pode quebrar por causa disso.
 */
export function hexParaHsl(hex: string | undefined): Hsl | undefined {
  if (!ehHex(hex)) return undefined;
  const puro = hex.slice(1);
  const cheio = puro.length === 3 ? puro.split("").map((c) => c + c).join("") : puro;
  const r = parseInt(cheio.slice(0, 2), 16) / 255;
  const g = parseInt(cheio.slice(2, 4), 16) / 255;
  const b = parseInt(cheio.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };

  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

/** Normaliza o matiz para [0,360) — usado depois de somar deslocamentos. */
export function normalizarMatiz(graus: number): number {
  const resto = graus % 360;
  return resto < 0 ? resto + 360 : resto;
}

/**
 * Cor CSS a partir de HSL. Sintaxe moderna (`hsl(H S% L%)`): registrada
 * como `<color>` por `@property`, ela interpola normalmente entre quadros
 * de `@keyframes` — que é o mecanismo inteiro dos modos animados.
 */
export function hslCss({ h, s, l }: Hsl): string {
  const pct = (v: number) => `${(Math.min(1, Math.max(0, v)) * 100).toFixed(1)}%`;
  return `hsl(${normalizarMatiz(h).toFixed(1)} ${pct(s)} ${pct(l)})`;
}

/** Mesma cor com o matiz deslocado (saturação/luminosidade intactas). */
export function deslocarMatiz(cor: Hsl, graus: number): Hsl {
  return { ...cor, h: normalizarMatiz(cor.h + graus) };
}
