// Distribui o topo de cada rótulo de chamada numa coluna, com espaçamento mínimo entre
// vizinhos e deslocamento total mínimo a partir das posições ideais — a mesma solução que
// desenho técnico usa há um século: quando o rótulo não cabe na altura exata da peça, ele
// desliza ao longo da coluna e ganha uma linha de chamada diagonal até a aresta real.
//
// A ordem nunca inverte: os `topos` chegam já ordenados de cima para baixo (a mesma ordem
// das camadas na pilha), e a saída preserva essa ordem — é isotônica por construção, não
// por checagem depois.
//
// Implementado como regressão isotônica (PAVA — pool adjacent violators): a solução de
// menor deslocamento ao quadrado que respeita "vizinho seguinte ≥ vizinho anterior + passo
// mínimo". É o mesmo algoritmo usado para distribuir rótulos em mapas e diagramas de metrô,
// e ele minimiza o deslocamento empurrando cada grupo de rótulos apertados para a MÉDIA das
// posições ideais dele, não para um extremo.
//
// Pura: sem DOM, sem estado. Testável isolada de `Camada.tsx`.

/** Espaço mínimo entre rótulos vizinhos, ponta a ponta (não centro a centro). */
export const ESPACO_MIN_ROTULO = 22

/**
 * `topos`: topo ideal de cada rótulo — antes de qualquer leque —, já na ordem de cima
 * para baixo (a mesma ordem física das camadas). `alturaRotulo`: altura fixa de cada
 * rótulo (o alvo de toque, 44px). Devolve o topo final de cada rótulo, mesma ordem, mesmo
 * tamanho: sempre `alturaRotulo + espacoMin` à frente do anterior, no mínimo.
 */
export function distribuirRotulos(
  topos: number[],
  alturaRotulo: number,
  espacoMin: number = ESPACO_MIN_ROTULO,
): number[] {
  const n = topos.length
  if (n <= 1) return topos.slice()

  const passo = alturaRotulo + espacoMin
  // Reduz para "sequência não decrescente" simples: subtrai i·passo de cada alvo, resolve
  // por PAVA, soma i·passo de volta no fim. Um bloco nivelado é a média (ponderada pelo
  // tamanho) dos alvos que ele engoliu — é essa média que minimiza o deslocamento total.
  const alvos = topos.map((t, i) => t - i * passo)

  type Bloco = { soma: number; peso: number; tamanho: number; valor: number }
  const blocos: Bloco[] = []
  for (let i = 0; i < n; i++) {
    let bloco: Bloco = { soma: alvos[i], peso: 1, tamanho: 1, valor: alvos[i] }
    while (blocos.length && blocos[blocos.length - 1].valor > bloco.valor) {
      const anterior = blocos.pop()!
      const soma = anterior.soma + bloco.soma
      const peso = anterior.peso + bloco.peso
      bloco = { soma, peso, tamanho: anterior.tamanho + bloco.tamanho, valor: soma / peso }
    }
    blocos.push(bloco)
  }

  const nivelado: number[] = []
  for (const bloco of blocos) {
    for (let k = 0; k < bloco.tamanho; k++) nivelado.push(bloco.valor)
  }
  return nivelado.map((v, i) => v + i * passo)
}
