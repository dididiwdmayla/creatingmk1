// A física da pilha. Números extraídos do export — não estimados, não altere sem checar
// contra /export/lancheria-meia-noite.dc.html e o AGENTS.md.
//
// Tudo aqui é puro: entra composição e caixa, sai geometria. Nenhum DOM, nenhum estado.

import { CAMADAS, MAPA_CAMADAS } from '@/data/camadas'
import { larguraCaixa } from './sombra'

export type Forma = 'prensado' | 'redondo'

/** Espaço vazio entre camadas na pilha explodida, em pixels do arquivo. */
export const GAP = 46
/** Prensado: a chapa fecha até 30% do espaçamento explodido. */
export const PRENSA_ESPACAMENTO = 0.3
/** Redondo: só a gravidade assenta, e para em 40%. */
export const SELADO_ESPACAMENTO = 0.4
/** Fundo de escala da barra de altura, em unidades de pixel do arquivo. */
export const MEDIDA_MAX_U = 2200
export const PRENSA_MS = 340
/** Aceleração forte e parada seca. Sem mola: prensa de chapa não balança. */
export const PRENSA_CURVA = 'cubic-bezier(.14,.92,.24,1)'
/**
 * O recheio espalha para os lados. Sem isso sobra fresta entre os pães nas pontas.
 *
 * Um número fixo nunca cobre toda composição possível — um lanche cujo recheio mais largo
 * fosse mais estreito que o testado sempre pediria mais. Por isso o fator é derivado, não
 * escrito à mão: a razão entre a largura do pão e a do recheio mais largo da composição.
 *
 * Piso 1.16: preserva o espalhamento como gesto mesmo quando o recheio já cobria sozinho.
 * Teto 1.30: não estica um recheio estreito a ponto de distorcer a fotografia. Composição
 * estreita bate no teto e sobra vão nas pontas — aceitável, porque pilha estreita é pilha
 * baixa e os dois pães ficam quase encostados. Não precisa de tratamento.
 */
export const ESPALHA_X_MIN = 1.16
export const ESPALHA_X_MAX = 1.30
export const ESPALHA_Y = 0.8
/** Redondo: as camadas moles assentam, sem espalhar. */
export const ASSENTA_Y = 0.9
/** Afundamento da camada do topo, que não tem nada em cima para prensá-la. */
export const AFUNDAMENTO_TOPO_MAX = 0.65
/** Teto do afundamento como fração da camada de baixo. É este número que salva o tomate. */
export const TETO_SOBRE_A_DE_BAIXO = 0.55
/**
 * Ar entre a pilha e a borda da altura disponível — a altura do painel já descontada a
 * faixa flutuante de aviso/recado, quando ela aparece (ver `RaioX.tsx`). Puro respiro
 * visual agora que a faixa não mora mais dentro dessa conta: não é contrato, ajuste se a
 * pilha parecer apertada ou solta demais depois de escalar.
 */
export const FATOR_RESPIRO_ALTURA = 0.94
/**
 * Piso da escala pela altura, como fração da escala natural (a que a largura do painel já
 * permite, sem nenhum corte por altura). Abaixo disso as camadas finas somem e o desenho
 * perde sentido — aí a pilha para de encolher e o painel passa a rolar.
 *
 * É a SEGUNDA coisa a ceder quando a pilha não cabe — depois da folga (`PISO_FOLGA`), nunca
 * antes. Escala é conteúdo: encolher a pilha encolhe as camadas finas até o molho virar um
 * fio. Folga é leitura: ela separa as peças, e com mais peças cabe menos separação por
 * peça sem perder o desenho.
 */
export const PISO_ESCALA = 0.70
/**
 * Piso da folga entre camadas (`GAP`), como fração da folga base. É a PRIMEIRA coisa a
 * ceder quando a pilha não cabe na altura disponível — antes da escala. Abaixo deste piso
 * as linhas de chamada se encavalam e o desenho vira sanduíche em vez de diagrama.
 */
export const PISO_FOLGA = 0.40

function paesDe(forma: Forma): [string, string] {
  const p = CAMADAS.filter((c) => c.pao === forma).sort((a, b) => a.ordem - b.ordem)
  return [p[0].slug, p[p.length - 1].slug]
}

/** Os pães de cada forma, base → topo. Derivado dos dados, não uma segunda lista. */
export const PAES: Record<Forma, [string, string]> = {
  prensado: paesDe('prensado'),
  redondo: paesDe('redondo'),
}

export function ehPao(slug: string): boolean {
  return !!MAPA_CAMADAS[slug]?.pao
}

/**
 * Quanto a camada `i` afunda na de baixo, em pixels do arquivo.
 *
 * O `min` não é refinamento: sem ele camada grossa engole camada fina. A carne afunda
 * 160px e o tomate tem 139px de altura — o tomate sumia inteiro. Com o teto, a camada
 * de baixo sempre mostra pelo menos 45% de si.
 */
export function afundamentoPx(slugs: string[], i: number): number {
  if (i === 0) return 0
  const c = MAPA_CAMADAS[slugs[i]]
  const abaixo = MAPA_CAMADAS[slugs[i - 1]]
  if (!c || !abaixo) return 0
  const noTopo = i === slugs.length - 1
  const af = noTopo ? Math.min(c.afundamento, AFUNDAMENTO_TOPO_MAX) : c.afundamento
  return Math.min(c.alturaPx * af, abaixo.alturaPx * TETO_SOBRE_A_DE_BAIXO)
}

/** Quanto a camada `i` acrescenta à altura da pilha depois de afundar. */
export function visivelPx(slugs: string[], i: number): number {
  const c = MAPA_CAMADAS[slugs[i]]
  return c ? c.alturaPx - afundamentoPx(slugs, i) : 0
}

/**
 * Quanto da camada `i` sobra à vista, depois que a de cima afunda nela. É o número que
 * o QA compara com 45% da própria altura — o teste do teto de afundamento, sem imagem.
 */
export function expostoPx(slugs: string[], i: number): number {
  const c = MAPA_CAMADAS[slugs[i]]
  if (!c) return 0
  if (i === slugs.length - 1) return c.alturaPx
  return c.alturaPx - afundamentoPx(slugs, i + 1)
}

export function fatorFechado(forma: Forma): number {
  return forma === 'prensado' ? PRENSA_ESPACAMENTO : SELADO_ESPACAMENTO
}

/**
 * O fator de espalhamento daquela composição: largura do pão sobre a do recheio mais
 * largo, no piso `ESPALHA_X_MIN` e no teto `ESPALHA_X_MAX`. Ver o comentário de
 * `ESPALHA_X_MIN`. Sem pão ou sem recheio na lista, devolve o piso — não há razão pra
 * calcular.
 */
export function espalhaXDe(slugs: string[]): number {
  const paoSlug = slugs.find((s) => ehPao(s))
  const larguraPao = paoSlug ? larguraCaixa(paoSlug) : 0
  const maiorRecheio = slugs
    .filter((s) => !ehPao(s))
    .reduce((max, s) => Math.max(max, larguraCaixa(s)), 0)
  if (!larguraPao || !maiorRecheio) return ESPALHA_X_MIN
  return Math.min(ESPALHA_X_MAX, Math.max(ESPALHA_X_MIN, larguraPao / maiorRecheio))
}

/** Altura da pilha em unidades de pixel do arquivo — medida sem unidade exposta. */
export function unidadesPilha(slugs: string[], fator: number): number {
  const com = slugs.filter((s) => MAPA_CAMADAS[s] && MAPA_CAMADAS[s].alturaPx > 0)
  if (!com.length) return 0
  let u = MAPA_CAMADAS[com[0]].alturaPx
  for (let i = 1; i < com.length; i++) u += visivelPx(com, i) * fator
  return u
}

/**
 * O corte entre celular e desktop, em px. Abaixo dele as chamadas ficam ocultas e a pilha
 * ocupa a largura inteira; acima, a coluna de chamadas volta. Está aqui, e não numa media
 * query solta, porque a geometria da pilha depende dele: quem decide a largura da coluna
 * é a mesma conta que decide `k`.
 */
export const CORTE_AMPLO = 900

export type Geometria = {
  /** Largura da coluna das chamadas, à esquerda. Zero quando elas estão ocultas. */
  colW: number
  /** Onde a caixa da pilha começa, depois da coluna de chamadas. */
  x0: number
  larguraPilha: number
  /** Pixels de tela por pixel do arquivo. */
  k: number
  tops: number[]
  minTop: number
  offsetY: number
  prensa: boolean
  assenta: boolean
  /** Espalhamento do recheio nesta composição. Só importa quando `prensa` é true. */
  espalhaX: number
  /** A escala que a largura do painel sozinha permitiria, sem nenhum corte por altura. */
  escalaNatural: number
  /** `k` bateu no piso de `PISO_ESCALA`: a pilha não coube na altura mesmo com a folga no
   * piso e a escala no piso, e o painel precisa rolar para mostrar o resto. Ver `RaioX.tsx`. */
  estourou: boolean
  /** A folga entre camadas (fração de `GAP`) nesta pilha. Cede primeiro, até `PISO_FOLGA`,
   * antes de a escala ceder — ver o comentário de `PISO_FOLGA`. */
  folga: number
}

/**
 * Todas as 19 camadas são PNG de 2000×1200 com o objeto centralizado, e as larguras
 * relativas já estão no arquivo — o bacon já é mais largo que o pão. Por isso a pilha
 * inteira vai numa caixa só, centralizada, e nenhuma camada leva escala própria.
 */
export function geometria(opcoes: {
  slugs: string[]
  areaW: number
  areaH: number
  comprimido: boolean
  forma: Forma
  /** Coluna de chamadas à esquerda. Falsa no celular: lá a pilha usa a largura inteira. */
  chamadas: boolean
}): Geometria {
  const { slugs, areaW, areaH, comprimido, forma, chamadas } = opcoes
  const colW = chamadas ? Math.min(200, Math.max(80, areaW * 0.28)) : 0
  const x0 = chamadas ? colW + 18 : 0
  const larguraPilha = Math.max(130, areaW - x0 - (chamadas ? 10 : 0))
  const prensa = comprimido && forma === 'prensado'
  const assenta = comprimido && forma !== 'prensado'

  // k e a folga saem sempre do estado explodido: a pilha não muda de escala nem de folga
  // ao prensar, só a distância entre camadas encolhe (ver `fatorFechado`).
  //
  // Quando a pilha não cabe na altura disponível, quem cede primeiro é a folga entre
  // camadas — ela é separação de leitura, não conteúdo — até o piso `PISO_FOLGA`. Só
  // depois disso esgotado é que a escala cede, até `PISO_ESCALA`. Ver os comentários das
  // duas constantes.
  const somaAlturas = slugs.reduce((soma, s) => soma + (MAPA_CAMADAS[s]?.alturaPx ?? 0), 0)
  const gapsBase = Math.max(0, slugs.length - 1) * GAP
  // Escala natural: a que a largura sozinha permite, sem nenhum corte por altura — é o
  // teto que a pilha nunca ultrapassa, e a referência do piso de `PISO_ESCALA`.
  const escalaNatural = larguraPilha / 2000
  const alturaAlvo = areaH * FATOR_RESPIRO_ALTURA
  const cabeNaAltura = (folgaFracao: number, escala: number) =>
    escala * (somaAlturas + gapsBase * folgaFracao) <= alturaAlvo

  let folga = 1
  let k = escalaNatural
  let estourou = false

  if (!cabeNaAltura(1, escalaNatural)) {
    if (gapsBase > 0) {
      // A menor folga que, na escala natural, já basta para caber — nunca menos que o
      // piso, nunca mais do que a folga cheia.
      folga = Math.min(
        1,
        Math.max(PISO_FOLGA, (alturaAlvo / escalaNatural - somaAlturas) / gapsBase),
      )
    }
    if (!cabeNaAltura(folga, escalaNatural)) {
      // A folga já está no piso e ainda não coube: agora é a escala que cede.
      const unidadesComFolgaMin = somaAlturas + gapsBase * folga
      const kAltura = unidadesComFolgaMin ? alturaAlvo / unidadesComFolgaMin : escalaNatural
      const piso = escalaNatural * PISO_ESCALA
      estourou = kAltura < piso - 1e-3
      k = Math.max(piso, kAltura)
    }
  }

  const tops: number[] = []
  let cursor = 0
  slugs.forEach((s, i) => {
    const c = MAPA_CAMADAS[s]
    if (i === 0) cursor = -(c?.alturaPx ?? 0)
    else if (comprimido) cursor -= visivelPx(slugs, i) * fatorFechado(forma)
    else cursor -= (c?.alturaPx ?? 0) + GAP * folga
    tops.push(cursor)
  })
  const minTop = tops.length ? tops[tops.length - 1] : 0
  // Quando bate no piso a pilha não cabe mesmo no menor tamanho aceitável: em vez de
  // centralizar (que cortaria igualmente em cima e embaixo, sem jeito de rolar até o
  // topo), alinha o topo ao topo do painel — o painel rola para revelar o resto por baixo.
  const offsetY = estourou ? 0 : (areaH - -minTop * k) / 2
  // Calculado no momento de prensar: fora dele o valor não é usado, e computar sempre
  // gastaria a mesma volta pelas larguras à toa em cada render explodido.
  const espalhaX = prensa ? espalhaXDe(slugs) : ESPALHA_X_MIN

  return {
    colW,
    x0,
    larguraPilha,
    k,
    tops,
    minTop,
    offsetY,
    prensa,
    assenta,
    espalhaX,
    escalaNatural,
    estourou,
    folga,
  }
}
