/**
 * Leitura e MISTURA de cor para a barra do navegador (ver ./README no
 * cabeçalho de ./BarraNavegador.tsx). Puro e sem DOM — testado em
 * __tests__/srgb.test.ts.
 *
 * Por que não reaproveitar `lib/demos/cores/hsl.ts`: aquele módulo existe
 * para MANIPULAR MATIZ (os modos iridescente/arco-íris), e HSL é o espaço
 * errado para interpolar duas cores — o caminho entre dois matizes passa
 * por cores que não estão em nenhuma das pontas. Aqui a operação é uma
 * média ponderada entre cores que já existem, e o requisito é só que ela
 * não escureça no meio do caminho.
 *
 * A mistura é feita em LUZ LINEAR, não nos bytes do sRGB, e essa é a
 * única decisão de acabamento deste arquivo: a média byte a byte entre
 * `#1A1411` e `#F5F0E8` dá um cinza visivelmente mais escuro do que a
 * cor a meio caminho de verdade, porque o byte do sRGB é uma codificação
 * com gama ~2,2 e a média de duas potências não é a potência da média.
 * Numa barra de navegador que atravessa a transição em ~meia tela de
 * rolagem, esse afundamento aparece como um "escurece e clareia" no
 * meio, que é exatamente o defeito que a interpolação deveria evitar.
 * Decodificar → media → recodificar custa duas potências por canal, uma
 * vez por quadro de scroll, e some com o problema.
 */

/** Cor em bytes sRGB (0–255 por canal), do jeito que a meta tag a escreve. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
/** `rgb(1 2 3)`, `rgb(1, 2, 3)`, `rgba(1,2,3,0.5)` — o que getComputedStyle devolve. */
const RGB_RE = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i;

/**
 * Cor CSS → bytes, ou `undefined` quando a cor não é opaca ou não é de
 * uma sintaxe que este módulo entende.
 *
 * `undefined` é um resultado ÚTIL, não um erro: é o sinal de "esta
 * superfície não pinta fundo próprio", que é como uma seção transparente
 * herda a cor do plano da página em vez de puxar a barra pro preto. Por
 * isso `rgba(0,0,0,0)` — o valor que `getComputedStyle` devolve pra todo
 * elemento sem fundo — cai aqui, e não em "preto".
 *
 * Também cai aqui a sintaxe `color(srgb …)`/`oklch(…)` que um navegador
 * moderno pode devolver quando a folha declara a cor num espaço amplo.
 * Nenhuma paleta de skin faz isso hoje (todas são hex), e adivinhar a
 * conversão sairia pior que herdar o plano da página.
 */
export function lerCor(valor: string | undefined | null): Rgb | undefined {
  if (typeof valor !== "string") return undefined;
  const texto = valor.trim();
  if (HEX_RE.test(texto)) {
    const puro = texto.slice(1);
    const cheio = puro.length === 3 ? puro.split("").map((c) => c + c).join("") : puro;
    return {
      r: parseInt(cheio.slice(0, 2), 16),
      g: parseInt(cheio.slice(2, 4), 16),
      b: parseInt(cheio.slice(4, 6), 16),
    };
  }
  const m = RGB_RE.exec(texto);
  if (!m) return undefined;
  // Alfa ausente = opaco. Qualquer transparência (inclusive parcial) é
  // tratada como "não pinta": uma superfície semitransparente compõe com
  // o que está atrás dela, e este módulo não tem como saber com o quê.
  if (m[4] !== undefined) {
    const alfa = m[4].endsWith("%") ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
    if (!(alfa >= 0.999)) return undefined;
  }
  const canais = [m[1], m[2], m[3]].map(Number);
  if (canais.some((c) => !Number.isFinite(c))) return undefined;
  const [r, g, b] = canais;
  return { r, g, b };
}

/** Bytes → `#rrggbb` (o formato que a meta tag recebe). */
export function corHex({ r, g, b }: Rgb): string {
  const byte = (v: number) =>
    Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/** Byte sRGB → luz linear (a transferência padrão do sRGB). */
function paraLinear(byte: number): number {
  const s = Math.min(1, Math.max(0, byte / 255));
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luz linear → byte sRGB. */
function paraByte(linear: number): number {
  const v = Math.min(1, Math.max(0, linear));
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return s * 255;
}

/**
 * Média ponderada em luz linear. Pesos não precisam somar 1 — são
 * normalizados aqui, que é o que permite a quem chama passar só as
 * seções que pesam AGORA e deixar o resto de fora (ver ./foco.ts).
 * Lista vazia (ou de peso total zero) devolve `undefined`.
 */
export function misturar(partes: readonly { cor: Rgb; peso: number }[]): Rgb | undefined {
  let total = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const { cor, peso } of partes) {
    if (!(peso > 0)) continue;
    total += peso;
    r += paraLinear(cor.r) * peso;
    g += paraLinear(cor.g) * peso;
    b += paraLinear(cor.b) * peso;
  }
  if (total <= 0) return undefined;
  return { r: paraByte(r / total), g: paraByte(g / total), b: paraByte(b / total) };
}
