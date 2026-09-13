// Extraído do export do Claude Design. Fonte da verdade dos números calibrados.
// alturaPx é o pixel medido do arquivo. NÃO existem alturaCm nem pesoG — removidos
// de propósito: nenhum dono de lancheria consegue preencher isso.

export type Camada = {
  slug: string
  arquivo: string
  /** Miniatura de trilho: recorte 256×256 no ponto de maior estrutura. Só o trilho usa. */
  ficha: string
  nome: string
  alt: string
  alturaPx: number
  afundamento: number
  precoCent: number
  ordem: number
  obrigatorio: boolean
  pao?: 'redondo' | 'prensado'
  firme?: boolean
}

export const CAMADAS: Camada[] = [
    { slug: 'pao-base', arquivo: 'camadas/pao-base.webp', ficha: '/fichas/pao-base.webp', nome: 'Pão de baixo', alt: 'Metade de baixo do pão redondo, vista de lado', alturaPx: 285, afundamento: 0, precoCent: 0, ordem: 1, obrigatorio: true, pao: 'redondo' },
    { slug: 'pao-prensado-base', arquivo: 'camadas/pao-prensado-base.webp', ficha: '/fichas/pao-prensado-base.webp', nome: 'Pão de baixo', alt: 'Metade de baixo do pão do prensado, marcada na chapa', alturaPx: 307, afundamento: 0, precoCent: 0, ordem: 1, obrigatorio: true, pao: 'prensado' },
    { slug: 'molho', arquivo: 'camadas/molho.webp', ficha: '/fichas/molho.webp', nome: 'Molho', alt: 'Faixa de molho da casa passada no pão', alturaPx: 108, afundamento: 0.92, precoCent: 200, ordem: 2, obrigatorio: false },
    { slug: 'alface', arquivo: 'camadas/alface.webp', ficha: '/fichas/alface.webp', nome: 'Alface', alt: 'Folhas de alface crespa', alturaPx: 467, afundamento: 0.55, precoCent: 150, ordem: 3, obrigatorio: false },
    { slug: 'tomate', arquivo: 'camadas/tomate.webp', ficha: '/fichas/tomate.webp', nome: 'Tomate', alt: 'Rodelas de tomate vistas de lado', alturaPx: 139, afundamento: 0.40, precoCent: 200, ordem: 4, obrigatorio: false },
    { slug: 'cebola', arquivo: 'camadas/cebola.webp', ficha: '/fichas/cebola.webp', nome: 'Cebola', alt: 'Cebola caramelizada em tiras', alturaPx: 399, afundamento: 0.55, precoCent: 350, ordem: 5, obrigatorio: false },
    { slug: 'carne', arquivo: 'camadas/carne.webp', ficha: '/fichas/carne.webp', nome: 'Carne', alt: 'Hambúrguer selado na chapa', alturaPx: 381, afundamento: 0.42, precoCent: 900, ordem: 6, obrigatorio: false, firme: true },
    { slug: 'calabresa', arquivo: 'camadas/calabresa.webp', ficha: '/fichas/calabresa.webp', nome: 'Calabresa', alt: 'Calabresa em rodelas marcadas na chapa', alturaPx: 224, afundamento: 0.50, precoCent: 500, ordem: 6.2, obrigatorio: false },
    { slug: 'salsicha', arquivo: 'camadas/salsicha.webp', ficha: '/fichas/salsicha.webp', nome: 'Salsicha', alt: 'Duas salsichas abertas ao meio', alturaPx: 330, afundamento: 0.50, precoCent: 450, ordem: 6.3, obrigatorio: false },
    { slug: 'frango-desfiado', arquivo: 'camadas/frango-desfiado.webp', ficha: '/fichas/frango-desfiado.webp', nome: 'Frango', alt: 'Frango desfiado na maionese temperada', alturaPx: 296, afundamento: 0.45, precoCent: 800, ordem: 6.4, obrigatorio: false },
    { slug: 'milho', arquivo: 'camadas/milho.webp', ficha: '/fichas/milho.webp', nome: 'Milho', alt: 'Camada de milho verde', alturaPx: 202, afundamento: 0.50, precoCent: 250, ordem: 6.8, obrigatorio: false },
    { slug: 'queijo', arquivo: 'camadas/queijo.webp', ficha: '/fichas/queijo.webp', nome: 'Queijo', alt: 'Fatia de queijo derretendo', alturaPx: 420, afundamento: 0.62, precoCent: 400, ordem: 7, obrigatorio: false },
    { slug: 'presunto', arquivo: 'camadas/presunto.webp', ficha: '/fichas/presunto.webp', nome: 'Presunto', alt: 'Fatia de presunto dobrada', alturaPx: 416, afundamento: 0.58, precoCent: 450, ordem: 8, obrigatorio: false },
    { slug: 'bacon', arquivo: 'camadas/bacon.webp', ficha: '/fichas/bacon.webp', nome: 'Bacon', alt: 'Duas fatias de bacon frito', alturaPx: 305, afundamento: 0.48, precoCent: 700, ordem: 9, obrigatorio: false },
    { slug: 'ovo', arquivo: 'camadas/ovo.webp', ficha: '/fichas/ovo.webp', nome: 'Ovo', alt: 'Ovo frito com gema inteira', alturaPx: 301, afundamento: 0.42, precoCent: 400, ordem: 10, obrigatorio: false },
    { slug: 'queijo-ralado', arquivo: 'camadas/queijo-ralado.webp', ficha: '/fichas/queijo-ralado.webp', nome: 'Queijo ralado', alt: 'Camada de queijo ralado grosso', alturaPx: 261, afundamento: 0.55, precoCent: 400, ordem: 10.5, obrigatorio: false },
    { slug: 'batata-palha', arquivo: 'camadas/batata-palha.webp', ficha: '/fichas/batata-palha.webp', nome: 'Batata palha', alt: 'Punhado de batata palha', alturaPx: 323, afundamento: 0.52, precoCent: 300, ordem: 11, obrigatorio: false },
    { slug: 'pao-topo', arquivo: 'camadas/pao-topo.webp', ficha: '/fichas/pao-topo.webp', nome: 'Pão de cima', alt: 'Metade de cima do pão redondo com gergelim', alturaPx: 456, afundamento: 0.30, precoCent: 0, ordem: 12, obrigatorio: true, pao: 'redondo' },
    { slug: 'pao-prensado-topo', arquivo: 'camadas/pao-prensado-topo.webp', ficha: '/fichas/pao-prensado-topo.webp', nome: 'Pão de cima', alt: 'Metade de cima do pão do prensado, marcada na chapa', alturaPx: 315, afundamento: 0.30, precoCent: 0, ordem: 12, obrigatorio: true, pao: 'prensado' }
]

/** Índice por slug. Derivado, não uma segunda fonte da verdade. */
export const MAPA_CAMADAS: Record<string, Camada> = Object.fromEntries(
  CAMADAS.map((c) => [c.slug, c]),
)

/** Os arquivos moram em /public. O campo `arquivo` é relativo, como no export. */
export function urlCamada(c: Camada): string {
  return `/${c.arquivo}`
}
