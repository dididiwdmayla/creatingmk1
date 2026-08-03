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

/** HSL → RGB em [0,1] por canal (fórmula padrão CSS Color 4). */
export function hslParaRgb({ h, s, l }: Hsl): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const setor = normalizarMatiz(h) / 60;
  const x = c * (1 - Math.abs((setor % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    setor < 1 ? [c, x, 0]
    : setor < 2 ? [x, c, 0]
    : setor < 3 ? [0, c, x]
    : setor < 4 ? [0, x, c]
    : setor < 5 ? [x, 0, c]
    : [c, 0, x];
  return [r + m, g + m, b + m];
}

/**
 * Luminância relativa (WCAG) de uma cor HSL — quanta LUZ ela põe na tela.
 *
 * Não confundir com o `l` do HSL: os dois medem coisas diferentes e a
 * distância entre eles é enorme justamente nos matizes que estouram.
 * `hsl(60 80% 60%)` (amarelo) e `hsl(240 80% 60%)` (azul) têm o MESMO `l` e
 * luminâncias de 0,64 e 0,09 — sete vezes. É por isso que um teto escrito
 * em `l` (o que o arco-íris tinha) não segura o amarelo: ele deixa passar
 * exatamente a cor que apaga o conteúdo por baixo da camada.
 */
export function luminanciaRelativa(cor: Hsl): number {
  const [r, g, b] = hslParaRgb(cor).map((canal) => {
    const v = Math.min(1, Math.max(0, canal));
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * A mesma cor (mesmo matiz, mesma saturação) com a luminosidade baixada só
 * o necessário pra luminância relativa caber no teto. Cor que já cabe volta
 * intacta — o teto nunca "achata" a paleta, só corta o pico.
 *
 * Busca binária em `l`: a luminância é monotônica em `l` com h/s fixos
 * (preto → cor → branco), então 24 passos dão precisão muito abaixo de um
 * nível de 255.
 */
export function limitarLuminancia(cor: Hsl, teto: number): Hsl {
  // A conta é feita sobre a cor COMO ELA SAI no CSS (`hslCss` imprime uma
  // casa decimal em cada componente): arredondar depois de cortar devolve
  // ao navegador uma cor um fio acima do teto — pouco na tela, mas o
  // suficiente pra o teto deixar de ser verdade sobre o valor entregue.
  if (luminanciaRelativa(comoCss(cor)) <= teto) return cor;
  let baixo = 0;
  let alto = cor.l;
  for (let i = 0; i < 24; i++) {
    const meio = (baixo + alto) / 2;
    if (luminanciaRelativa(comoCss({ ...cor, l: meio })) > teto) alto = meio;
    else baixo = meio;
  }
  return { ...cor, l: Math.floor(baixo * 1000) / 1000 };
}

/** A cor já na precisão em que `hslCss` a imprime (0,1° e 0,1%). */
function comoCss(cor: Hsl): Hsl {
  const pct = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
  return { h: Math.round(normalizarMatiz(cor.h) * 10) / 10, s: pct(cor.s), l: pct(cor.l) };
}
