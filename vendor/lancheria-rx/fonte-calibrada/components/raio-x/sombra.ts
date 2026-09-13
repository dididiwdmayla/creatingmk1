// Sombra de contato: a mancha que a camada deixa na de baixo quando a pilha fecha.
//
// A silhueta não é lida da foto em runtime. `data/baselines.json` traz, para cada uma das
// 19 camadas, a caixa do objeto no arquivo e a linha de baixo já amostrada. A curva é
// redesenhada num canvas pequeno e vira um data URL.
//
// Duas proibições, as duas por motivo medido:
//   - Nunca `getImageData`. Ler pixel de volta força sincronização com a GPU e trava o
//     quadro; e o dado já existe no baselines.json.
//   - Nunca `drop-shadow` da silhueta inteira. A silhueta cheia borrada vira mancha suja
//     sobre a camada de baixo. O que se quer é só a linha de contato.

import baselines from '@/data/baselines.json'

/** Borrão da sombra, em pixels de tela. */
const BORRAO_PX = 10
/** Quanto a sombra desce em relação à base da camada. */
export const DESLOCAMENTO_PX = 14
/** Opacidade da sombra sobre a camada de baixo. */
export const OPACIDADE = 0.37
/** Folga acima e abaixo da curva no canvas, para o borrão não ser cortado na borda. */
const FOLGA_PX = 16

type Baseline = { caixa: [number, number, number, number]; base: number[] }
const BASELINES = baselines as unknown as Record<string, Baseline>

export type Sombra = {
  url: string
  w: number
  h: number
  /** Onde, dentro do canvas, fica a linha de base da camada. */
  baseY: number
  /** Deslocamento horizontal da caixa do objeto dentro do arquivo, já em pixels de tela. */
  x0Caixa: number
}

/** Onde a caixa do objeto começa, em pixels do arquivo. Também posiciona a chamada. */
export function caixaX0(slug: string): number {
  return BASELINES[slug]?.caixa[0] ?? 0
}

/** Largura da caixa do objeto no arquivo. Mesma fonte que a sombra de contato usa. */
export function larguraCaixa(slug: string): number {
  const b = BASELINES[slug]
  return b ? b.caixa[2] - b.caixa[0] : 0
}

// Memo de uma função pura: mesma camada, mesma escala, mesmo data URL. A chave inclui a
// escala porque redimensionar a janela troca `k` e a sombra antiga não serve mais.
const cache = new Map<string, Sombra>()

/** Reconstrói a sombra de uma camada na escala `k`. */
export function sombraDe(slug: string, k: number): Sombra | null {
  const b = BASELINES[slug]
  if (!b || typeof document === 'undefined') return null

  const chave = `${slug}:${k.toFixed(4)}`
  const guardada = cache.get(chave)
  if (guardada) return guardada

  const caixa = b.caixa
  const w = Math.max(8, Math.round((caixa[2] - caixa[0]) * k))
  const alturaCaixa = (caixa[3] - caixa[1]) * k
  const minBase = b.base.reduce((m, v) => (v < m ? v : m), 1)
  const amplitude = Math.max(6, (1 - minBase) * alturaCaixa)
  const h = Math.round(amplitude + FOLGA_PX * 2 + 2)

  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')
  if (!ctx) return null

  const baseY = h - FOLGA_PX
  ctx.filter = `blur(${BORRAO_PX}px)`
  ctx.fillStyle = '#120D0B'
  ctx.beginPath()
  ctx.moveTo(0, h)
  b.base.forEach((v, j) => {
    ctx.lineTo((j / (b.base.length - 1)) * w, baseY - (1 - v) * alturaCaixa)
  })
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()

  const dado: Sombra = { url: cv.toDataURL(), w, h, baseY, x0Caixa: caixa[0] * k }
  cache.set(chave, dado)
  return dado
}
