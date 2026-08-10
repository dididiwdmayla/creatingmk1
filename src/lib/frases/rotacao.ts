import { FRASES_SLOTS, type FrasesProspeccao } from "./types";

/**
 * Rotação das frases de abordagem — funções PURAS sobre um conjunto já
 * carregado (nada aqui toca Firestore). O contador é único por SKIN e
 * compartilhado entre leads e membros; quem o faz avançar é o clique de
 * enviar pro WhatsApp (ver `useWhatsAppContato`).
 */

/**
 * Normaliza os slots para exatamente `FRASES_SLOTS` posições de string —
 * docs antigos, curtos ou com lixo (número, null) entram no formato certo em
 * vez de derrubar a tela.
 */
export function normalizarSlots(frases: unknown): string[] {
  const lista = Array.isArray(frases) ? frases : [];
  return Array.from({ length: FRASES_SLOTS }, (_, i) =>
    typeof lista[i] === "string" ? (lista[i] as string) : "",
  );
}

/**
 * Índices dos slots preenchidos, na ordem dos campos da tela. É a ponte
 * entre a rotação (que anda sobre as frases EFETIVAS) e o slot de origem —
 * a tradução é gravada slot a slot, então a posição na rotação não basta.
 */
function slotsPreenchidos(conjunto: Pick<FrasesProspeccao, "frases">): number[] {
  const slots = normalizarSlots(conjunto.frases);
  const indices: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].trim().length > 0) indices.push(i);
  }
  return indices;
}

/**
 * As frases que de fato participam da rotação: slots preenchidos, na ordem
 * dos campos da tela. Conjunto sem nenhuma frase preenchida devolve lista
 * vazia — e é assim que uma skin "não participa da precedência".
 */
export function frasesEfetivas(conjunto: Pick<FrasesProspeccao, "frases">): string[] {
  const slots = normalizarSlots(conjunto.frases);
  return slotsPreenchidos(conjunto).map((i) => slots[i].trim());
}

/**
 * Posição atual dentro das frases EFETIVAS. O módulo é aplicado na leitura
 * (e não só na escrita) de propósito: o admin pode apagar uma frase depois
 * do contador já ter passado dela, e o índice guardado ficaria fora da
 * faixa. Conjunto vazio → undefined.
 */
export function posicaoAtual(conjunto: Pick<FrasesProspeccao, "frases" | "indice">): number | undefined {
  const efetivas = frasesEfetivas(conjunto);
  if (efetivas.length === 0) return undefined;
  const indice = Number.isInteger(conjunto.indice) && conjunto.indice >= 0 ? conjunto.indice : 0;
  return indice % efetivas.length;
}

/**
 * SLOT (0..FRASES_SLOTS-1) da frase da vez — diferente de `posicaoAtual`,
 * que é a posição entre as preenchidas. Com o slot 1 vazio, a segunda frase
 * da rotação mora no slot 2, e é o slot que a tradução usa como chave.
 */
export function slotAtual(
  conjunto: Pick<FrasesProspeccao, "frases" | "indice">,
): number | undefined {
  const posicao = posicaoAtual(conjunto);
  if (posicao === undefined) return undefined;
  return slotsPreenchidos(conjunto)[posicao];
}

/** Frase da vez, ainda com os marcadores por substituir. undefined = conjunto vazio. */
export function fraseAtual(
  conjunto: Pick<FrasesProspeccao, "frases" | "indice">,
): string | undefined {
  const posicao = posicaoAtual(conjunto);
  if (posicao === undefined) return undefined;
  return frasesEfetivas(conjunto)[posicao];
}

/**
 * Próximo índice depois de um envio: 1→2→3→1 sobre as frases EFETIVAS (com
 * duas preenchidas, alterna entre as duas — não fica pulando um slot vazio).
 * Conjunto vazio nunca é enviado, então o contador fica em 0.
 */
export function proximoIndice(conjunto: Pick<FrasesProspeccao, "frases" | "indice">): number {
  const posicao = posicaoAtual(conjunto);
  if (posicao === undefined) return 0;
  return (posicao + 1) % frasesEfetivas(conjunto).length;
}
