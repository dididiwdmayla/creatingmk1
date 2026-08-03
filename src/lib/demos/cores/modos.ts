import { COR_MODOS, type CorModo, type CoresModoValor } from "../types";
import { deslocarMatiz, ehHex, hexParaHsl, hslCss, limitarLuminancia, type Hsl } from "./hsl";

/**
 * MODOS DE COR da camada decorativa — valem para QUALQUER efeito do
 * registro (`lib/demos/efeitos`) e para qualquer estilo de LED
 * (`lib/demos/led`), sem que efeito ou LED precisem saber que isto existe.
 *
 * O truque que torna isso possível: efeito e LED nunca leem cor de um
 * arquivo de tema — o efeito recebe `cores: ThemePaleta` (strings CSS que
 * ele interpola em `background`/`stop-color`) e o LED lê `var(--d-accent)`.
 * Então basta entregar, no lugar do hex do tema, uma referência a uma
 * custom property ANIMADA (`var(--d-efeito-c1)`) e declarar essa property
 * com `@property … syntax:"<color>"` — registrada, ela INTERPOLA entre
 * quadros de `@keyframes` (sem registro, custom property anima em degrau).
 * Nenhum `filter: hue-rotate` animado: o contrato dos efeitos proíbe
 * animar `filter`, e uma camada que cobre a viewport inteira é o pior
 * lugar possível pra isso.
 *
 * Cinco modos (ver CorModo em ../types.ts):
 *
 *   - `tema` (default, e o que toda demo já publicada tem): devolve a
 *     paleta como está, sem CSS extra e sem animação nenhuma;
 *   - `fixa`: uma cor escolhida ocupa os três papéis — estática;
 *   - `transicao`: 2 ou 3 cores escolhidas girando LENTAMENTE entre os
 *     papéis (cada papel recebe a próxima cor da lista a cada volta);
 *   - `iridescente`: as cores do TEMA com um deslocamento de matiz sutil
 *     (±16°) indo e voltando — a paleta continua reconhecível;
 *   - `arco-iris`: percurso completo de matiz (0→360°) e saturação
 *     elevada — o modo deliberadamente chamativo.
 *
 * Puro e sem DOM: a mesma função resolve no Server Component da rota
 * pública, no preview do editor (client) e no harness `/interno/demo-qa`.
 */

/** Os três papéis de cor que a camada decorativa consome. */
export type CoresTrio = [string, string, string];

export interface ModoCoresResolvido {
  /**
   * Modo EFETIVO — "tema" também quando o pedido caiu de volta nele por
   * dado insuficiente (modo desconhecido, cor faltando, base sem matiz).
   * Quem chama usa isto pra saber se o controle antigo da aura ainda vale
   * (ver ../efeitos/camada.ts), em vez de comparar cores.
   */
  efetivo: CorModo;
  /** Valores CSS prontos para os três papéis (podem ser `var(...)`). */
  cores: CoresTrio;
  /** `@property` + `@keyframes` a injetar; "" quando não há animação. */
  css: string;
  /** Animação a aplicar no elemento que CARREGA as custom properties. */
  animacao?: { nome: string; duracaoSegundos: number; timing: string };
}

/** Segundos por cor no modo "transicao" — lento por pedido de projeto. */
const TRANSICAO_SEGUNDOS_POR_COR = 14;
/** Ida e volta do matiz no modo "iridescente". */
const IRIDESCENTE_GRAUS = 16;
const IRIDESCENTE_SEGUNDOS = 20;
/**
 * Passo do percurso de matiz do "arco-iris". Quadros a cada 45° (não um
 * salto de 0→360, que o CSS interpolaria pelo caminho mais curto — ou
 * seja, ficaria parado): a interpolação entre dois quadros acontece em
 * sRGB, e passos maiores que isso passariam por tons acinzentados no meio.
 */
const ARCO_IRIS_PASSO_GRAUS = 45;
const ARCO_IRIS_SEGUNDOS = 28;
/** Saturação mínima do arco-íris ("mais saturado" é parte do pedido). */
const ARCO_IRIS_SATURACAO_MIN = 0.62;
/** Luminosidade recortada: matiz só é legível como cor fora dos extremos. */
const ARCO_IRIS_L_MIN = 0.38;
const ARCO_IRIS_L_MAX = 0.72;

/**
 * TETO DE LUMINÂNCIA dos dois modos que giram o matiz da paleta
 * (`iridescente` e `arco-iris`) — em luminância RELATIVA (WCAG), não no
 * `l` do HSL (ver `limitarLuminancia` em ./hsl.ts, e por que o `l` não
 * serve).
 *
 * O que ele impede, medido: a camada decorativa é desenhada POR CIMA do
 * conteúdo, e a aura chega a 37% de alfa no ápice. Girando o matiz sem
 * teto, o ciclo passa pelos amarelos/verdes — os matizes de luminância
 * alta — e a tela inteira sobe de brilho junto: no preset escuro a
 * luminância média da viewport ia de 0,031 (sem efeito) a 0,054 e o
 * contraste (desvio da luminância) caía de 0,106 pra 0,088, com o pico de
 * cor batendo em 0,55 no arco-íris. É esse pico que o teto corta.
 *
 * 0,45 foi escolhido por medição, não por gosto: é onde o amarelo ainda é
 * amarelo saturado (a cor continua VIVA, que é o pedido) e a passagem por
 * ele deixa de ser um clarão. Vale pros dois modos e, por tabela, pro LED
 * e pra todo efeito do registro — nenhum precisa saber que isto existe.
 */
export const TETO_LUMINANCIA_MATIZ = 0.45;

export function modoValido(modo: string | undefined): modo is CorModo {
  return typeof modo === "string" && (COR_MODOS as readonly string[]).includes(modo);
}

/** Cores hex válidas do valor persistido, na ordem — o resto é descartado. */
export function coresEscolhidas(valor: CoresModoValor | undefined): string[] {
  return (valor?.cores ?? []).filter(ehHex).slice(0, 3);
}

function trio(cor: string): CoresTrio {
  return [cor, cor, cor];
}

/** Um quadro do @keyframes: a cor de cada um dos três papéis. */
type Quadro = CoresTrio;

function quadrosTransicao(lista: string[]): Quadro[] {
  const n = lista.length;
  // Um quadro por cor + o quadro de volta ao início (senão o ciclo salta
  // do último pro primeiro sem interpolar).
  return Array.from({ length: n + 1 }, (_, j) => [
    lista[j % n],
    lista[(j + 1) % n],
    lista[(j + 2) % n],
  ] as Quadro);
}

function quadrosDeslocamento(
  base: [Hsl, Hsl, Hsl],
  deltas: number[],
  ajuste?: (cor: Hsl) => Hsl,
): Quadro[] {
  return deltas.map(
    (delta) =>
      base.map((cor) => hslCss(ajuste ? ajuste(deslocarMatiz(cor, delta)) : deslocarMatiz(cor, delta))) as Quadro,
  );
}

function saturar(cor: Hsl): Hsl {
  return limitarLuminancia(
    {
      h: cor.h,
      s: Math.max(ARCO_IRIS_SATURACAO_MIN, Math.min(0.95, cor.s * 1.3)),
      l: Math.min(ARCO_IRIS_L_MAX, Math.max(ARCO_IRIS_L_MIN, cor.l)),
    },
    TETO_LUMINANCIA_MATIZ,
  );
}

/** O iridescente mantém a cor DO TEMA — só o pico de luminância é cortado. */
function conterBrilho(cor: Hsl): Hsl {
  return limitarLuminancia(cor, TETO_LUMINANCIA_MATIZ);
}

function bloco(prefixo: string, quadros: Quadro[]): { css: string; nome: string } {
  const nome = `d-cores-${prefixo}`;
  const propriedades = [0, 1, 2]
    .map(
      (i) => `@property --d-${prefixo}-c${i + 1} {
  syntax: "<color>";
  inherits: true;
  initial-value: ${quadros[0][i]};
}`,
    )
    .join("\n");
  const passos = quadros
    .map((quadro, j) => {
      const pct = ((j / (quadros.length - 1)) * 100).toFixed(3).replace(/\.?0+$/, "");
      const decls = quadro.map((cor, i) => `--d-${prefixo}-c${i + 1}: ${cor};`).join(" ");
      return `  ${pct}% { ${decls} }`;
    })
    .join("\n");
  return { css: `${propriedades}\n@keyframes ${nome} {\n${passos}\n}`, nome };
}

/**
 * Resolve o modo de cor num trio de valores CSS + o CSS que os anima.
 *
 * `base` são as cores que o tema já daria (destaque / acento secundário /
 * acento terciário para efeitos; a cor de destaque três vezes para o LED,
 * que só usa uma). `prefixo` separa os namespaces de efeito e LED, que
 * podem estar em modos diferentes na mesma página.
 *
 * Qualquer entrada inválida (modo desconhecido, cor faltando, base que não
 * é hex e portanto não tem matiz manipulável) cai no comportamento de
 * `tema` — a camada decorativa nunca some nem quebra por dado ruim.
 */
export function resolverModoCores(
  valor: CoresModoValor | undefined,
  base: CoresTrio,
  prefixo: string,
): ModoCoresResolvido {
  const semModo: ModoCoresResolvido = { efetivo: "tema", cores: base, css: "" };
  if (!valor || !modoValido(valor.modo) || valor.modo === "tema") return semModo;

  const escolhidas = coresEscolhidas(valor);

  if (valor.modo === "fixa") {
    return escolhidas[0] ? { efetivo: "fixa", cores: trio(escolhidas[0]), css: "" } : semModo;
  }

  let quadros: Quadro[];
  let duracaoSegundos: number;
  let timing: string;

  if (valor.modo === "transicao") {
    // Uma cor só não tem transição nenhuma — é o modo "fixa" escrito de
    // outro jeito; nenhuma cor válida volta pro tema.
    if (escolhidas.length === 0) return semModo;
    if (escolhidas.length === 1) return { efetivo: "fixa", cores: trio(escolhidas[0]), css: "" };
    quadros = quadrosTransicao(escolhidas);
    duracaoSegundos = TRANSICAO_SEGUNDOS_POR_COR * escolhidas.length;
    timing = "ease-in-out";
  } else {
    const hsl = base.map(hexParaHsl);
    // Sem matiz manipulável (paleta com rgba()/color-mix() no papel), não
    // há iridescência nem arco-íris possível — segue o tema.
    if (hsl.some((cor) => cor === undefined)) return semModo;
    const baseHsl = hsl as [Hsl, Hsl, Hsl];

    if (valor.modo === "iridescente") {
      quadros = quadrosDeslocamento(
        baseHsl,
        [0, IRIDESCENTE_GRAUS, 0, -IRIDESCENTE_GRAUS, 0],
        conterBrilho,
      );
      duracaoSegundos = IRIDESCENTE_SEGUNDOS;
      timing = "ease-in-out";
    } else {
      const passos = Math.round(360 / ARCO_IRIS_PASSO_GRAUS);
      quadros = quadrosDeslocamento(
        baseHsl,
        Array.from({ length: passos + 1 }, (_, j) => j * ARCO_IRIS_PASSO_GRAUS),
        saturar,
      );
      duracaoSegundos = ARCO_IRIS_SEGUNDOS;
      timing = "linear"; // percurso de matiz em velocidade constante
    }
  }

  const { css, nome } = bloco(prefixo, quadros);
  return {
    efetivo: valor.modo,
    // O fallback do var() é a cor do tema: navegador sem @property (ou
    // antes do primeiro frame da animação) mostra a demo como sempre foi,
    // nunca sem cor.
    cores: [
      `var(--d-${prefixo}-c1, ${base[0]})`,
      `var(--d-${prefixo}-c2, ${base[1]})`,
      `var(--d-${prefixo}-c3, ${base[2]})`,
    ],
    css,
    animacao: { nome, duracaoSegundos, timing },
  };
}
