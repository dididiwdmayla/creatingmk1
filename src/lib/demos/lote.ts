/**
 * Motor genérico de processamento em lote com orçamento de tempo — usado
 * pela geração de demos em lote (grátis, Firestore) e pela geração de
 * textos por IA em lote (paga, SKU aiGeneration). Ver "Geração de demos em
 * lote" em ARCHITECTURE.md.
 *
 * Processa os itens SEQUENCIALMENTE a partir de `cursor`, um try/catch por
 * item (falha em um item nunca interrompe o resto), e para assim que o
 * orçamento de tempo estoura — nunca no meio de um item, sempre depois de
 * concluí-lo (sucesso ou erro), então o lote nunca deixa um item pela
 * metade. Quem chama volta a chamar com `proximoCursor` até ele vir `null`
 * (lote concluído), acumulando `resultados` do jeito que quiser — mesmo
 * espírito do laço do cron (`executarBuscasRecorrentes`), só que paginado
 * por tempo em vez de parar em erro de cota.
 */

/** Orçamento default de uma chamada — bem abaixo do limite de execução
 * serverless mais apertado (Vercel Hobby, 10s), com folga para I/O do
 * Firestore entre itens. */
export const LOTE_ORCAMENTO_MS_PADRAO = 8000;

export interface ResultadoLoteItem<T> {
  item: T;
  status: "ok" | "erro";
  /** Mensagem do erro (Error.message ou String(erro)) — só em status "erro". */
  erro?: string;
}

export interface ResultadoLote<T> {
  resultados: ResultadoLoteItem<T>[];
  /** Índice do próximo item a processar, ou `null` quando o lote terminou. */
  proximoCursor: number | null;
}

export async function processarLoteComOrcamento<T>(
  itens: readonly T[],
  cursor: number,
  processar: (item: T) => Promise<void>,
  opts: { orcamentoMs?: number; agora?: () => number } = {},
): Promise<ResultadoLote<T>> {
  const orcamentoMs = opts.orcamentoMs ?? LOTE_ORCAMENTO_MS_PADRAO;
  const agora = opts.agora ?? Date.now;
  const inicio = agora();

  const resultados: ResultadoLoteItem<T>[] = [];
  let i = Math.max(cursor, 0);

  while (i < itens.length) {
    const item = itens[i];
    try {
      await processar(item);
      resultados.push({ item, status: "ok" });
    } catch (error) {
      resultados.push({
        item,
        status: "erro",
        erro: error instanceof Error ? error.message : String(error),
      });
    }
    i++;

    // Checado DEPOIS de concluir o item — garante progresso mesmo com
    // orçamento minúsculo (≥1 item por chamada) e nunca corta um item ao
    // meio.
    if (i < itens.length && agora() - inicio >= orcamentoMs) {
      return { resultados, proximoCursor: i };
    }
  }

  return { resultados, proximoCursor: null };
}
