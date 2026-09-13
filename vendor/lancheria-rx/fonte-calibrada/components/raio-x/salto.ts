// O salto, 640ms. O lanche fechado agacha, pula e desmonta no ar, e as camadas caem na
// barra do pedido.
//
// Sem rastro, sem borrão, sem partícula. As camadas são fotografia — qualquer efeito por
// cima denuncia a montagem. Só `transform` e `opacity` são animados.

import { MAPA_CAMADAS, urlCamada } from '@/data/camadas'
import { pausarMovimento, prefersReducedMotion } from '@/lib/motion'
import { fatorFechado, visivelPx, type Forma } from './prensa'

/** De onde o lanche sai: centro e base da pilha na tela, e a escala em que ela foi desenhada. */
export type Origem = { centroX: number; baseY: number; kk: number }

const ANTECIPA_MS = 90
const IMPULSO_MS = 200
const QUEDA_MS = 360
/** Atraso entre uma camada e a seguinte. De baixo para cima: o pão de cima cai por último. */
const ESCADA_MS = 45
const CHEGADA_MS = 560

type Sorteio = { lado: number; itens: { rot: number; deriva: number }[] }

// Memorizado por lanche: o mesmo lanche cai igual sempre. Aleatório que muda a cada
// repetição não lê como física, lê como defeito.
const sorteios = new Map<string, Sorteio>()

function sortear(chave: string, n: number): Sorteio {
  const k = `${chave}:${n}`
  const guardado = sorteios.get(k)
  if (guardado) return guardado

  // FNV-1a sobre a chave: a semente é o próprio lanche, então não precisa ser guardada.
  let h = 2166136261
  for (let i = 0; i < k.length; i++) {
    h ^= k.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h ^= h >>> 13
    return ((h >>> 0) % 10000) / 10000
  }

  const itens = []
  for (let i = 0; i < n; i++) {
    itens.push({ rot: rnd() * 28 - 14, deriva: (i % 2 ? 1 : -1) * (8 + rnd() * 32) })
  }
  const dado: Sorteio = { lado: rnd() > 0.5 ? 1 : -1, itens }
  sorteios.set(k, dado)
  return dado
}

type Item = { chave: string; camadas: string[]; forma: Forma }

/**
 * Lança o item. Chama `aoChegar` quando a queda termina — é lá que a barra do pedido leva
 * o solavanco e o total sobe contando. Devolve um cancelador para a desmontagem.
 */
export function salto(item: Item, origem: Origem | null, aoChegar: () => void): () => void {
  const slugs = item.camadas.filter((s) => MAPA_CAMADAS[s] && MAPA_CAMADAS[s].alturaPx > 0)
  const cont = document.createElement('div')

  if (prefersReducedMotion() || !origem || !slugs.length || !cont.animate) {
    aoChegar()
    return () => {}
  }

  const retomar = pausarMovimento()
  const kk = origem.kk
  const largura = 2000 * kk
  const fator = fatorFechado(item.forma)
  cont.setAttribute('aria-hidden', 'true')
  cont.setAttribute('data-salto', '')
  cont.style.cssText =
    `position: fixed; left: ${origem.centroX - largura / 2}px; top: ${origem.baseY}px; ` +
    `width: ${largura}px; height: 0; z-index: 45; pointer-events: none; transform-origin: 50% 0;`

  const par = sortear(item.chave, slugs.length)
  const pecas: HTMLDivElement[] = []
  let topo = MAPA_CAMADAS[slugs[0]].alturaPx
  slugs.forEach((s, i) => {
    const c = MAPA_CAMADAS[s]
    if (i > 0) topo += visivelPx(slugs, i) * fator
    const el = document.createElement('div')
    el.style.cssText =
      `position: absolute; left: 0; width: 100%; height: ${1200 * kk}px; ` +
      `bottom: ${(topo - c.alturaPx / 2 - 600) * kk}px; z-index: ${i}; ` +
      `background: center/contain no-repeat url("${urlCamada(c)}"); will-change: transform;`
    cont.appendChild(el)
    pecas.push(el)
  })
  document.body.appendChild(cont)

  const subida = window.innerHeight * 0.12
  cont.animate(
    [
      { transform: 'translateY(0px) scale(1, 1) rotate(0deg)', easing: 'cubic-bezier(.25,.75,.4,1)' },
      // Antecipação: agacha antes de subir.
      {
        transform: 'translateY(8px) scale(1.04, 0.86) rotate(0deg)',
        offset: ANTECIPA_MS / IMPULSO_MS,
        easing: 'cubic-bezier(.16,.84,.44,1)',
      },
      { transform: `translateY(${-subida}px) scale(0.97, 1.08) rotate(${par.lado * 4}deg)` },
    ],
    { duration: IMPULSO_MS, fill: 'forwards' },
  )

  const queda = window.innerHeight - origem.baseY + subida + 1200 * kk + 80
  pecas.forEach((el, i) => {
    const p = par.itens[i]
    const animacao = el.animate(
      [
        { transform: 'translate(0px, 0px) rotate(0deg)' },
        { transform: `translate(${p.deriva.toFixed(1)}px, ${queda.toFixed(0)}px) rotate(${p.rot.toFixed(1)}deg)` },
      ],
      {
        duration: QUEDA_MS + 20,
        delay: IMPULSO_MS + i * ESCADA_MS,
        // Aceleração de gravidade: sai devagar, chega rápido.
        easing: 'cubic-bezier(.36,0,.86,.36)',
        fill: 'forwards',
      },
    )
    void animacao.finished.then(() => el.style.removeProperty('will-change'), () => el.style.removeProperty('will-change'))
  })

  const timers = [
    window.setTimeout(aoChegar, CHEGADA_MS),
    window.setTimeout(() => { cont.remove(); retomar() }, IMPULSO_MS + pecas.length * ESCADA_MS + QUEDA_MS + 100),
  ]

  return () => {
    timers.forEach(window.clearTimeout)
    cont.remove()
    retomar()
  }
}
