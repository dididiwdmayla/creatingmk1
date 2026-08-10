import { IDIOMA_PADRAO } from "@/lib/idioma";
import { normalizarSlots } from "./rotacao";
import { FRASES_SLOTS, type FrasesProspeccao, type TraducaoFrases } from "./types";

/**
 * Estado da tradução de UM slot, em funções PURAS (a ficha e a fila do dia
 * usam as mesmas). As frases são sempre escritas em português; a tradução é
 * um texto derivado, gravado por idioma e reusado — nunca refeita ao abrir
 * a ficha, porque cada refazer é uma chamada paga.
 *
 * - `nativa`: o lead é do Brasil (ou o idioma-alvo é pt-BR) — não há o que
 *   traduzir e nenhum botão aparece;
 * - `aplicada`: existe tradução gravada para aquele slot e ela foi feita a
 *   partir do português que está lá AGORA;
 * - `desatualizada`: existe tradução, mas o português do slot mudou depois
 *   — vale o português, e o botão volta a aparecer (traduzir de novo é uma
 *   decisão de gasto, então nunca acontece sozinho);
 * - `ausente`: nunca traduzido para aquele idioma.
 */
export type EstadoTraducao = "nativa" | "aplicada" | "desatualizada" | "ausente";

/** Normaliza para comparação: o que muda só em espaço não invalida a tradução. */
function mesmaOrigem(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "").trim() === (b ?? "").trim();
}

/** Estado da tradução do slot da vez daquele conjunto, naquele idioma. */
export function estadoTraducao(
  conjunto: Pick<FrasesProspeccao, "frases" | "traducoes">,
  idioma: string,
  slot: number,
): EstadoTraducao {
  if (idioma === IDIOMA_PADRAO) return "nativa";
  const traducao = conjunto.traducoes?.[idioma];
  if (!traducao) return "ausente";
  const slots = normalizarSlots(conjunto.frases);
  const traduzidas = normalizarSlots(traducao.frases);
  if (!traduzidas[slot]?.trim()) return "ausente";
  return mesmaOrigem(normalizarSlots(traducao.origem)[slot], slots[slot])
    ? "aplicada"
    : "desatualizada";
}

/**
 * O texto que vai para o WhatsApp: a tradução daquele slot quando ela está
 * aplicada, senão o português. Nunca devolve uma tradução desatualizada —
 * mandar a versão antiga de uma frase que o admin acabou de reescrever é
 * pior do que mandar em português.
 */
export function textoDoSlot(
  conjunto: Pick<FrasesProspeccao, "frases" | "traducoes">,
  idioma: string,
  slot: number,
): string {
  const portugues = normalizarSlots(conjunto.frases)[slot]?.trim() ?? "";
  if (estadoTraducao(conjunto, idioma, slot) !== "aplicada") return portugues;
  return normalizarSlots(conjunto.traducoes?.[idioma]?.frases)[slot].trim();
}

/**
 * A tradução PRONTA para gravar: os três slots (vazio onde o português é
 * vazio) mais a cópia da origem. Fica aqui, e não na camada de IA, porque é
 * a forma do dado — a IA só devolve os textos.
 */
export function montarTraducao(
  frasesPortugues: string[],
  traduzidas: string[],
  em: string,
): TraducaoFrases {
  const origem = normalizarSlots(frasesPortugues);
  const frases = normalizarSlots(traduzidas);
  return {
    frases: Array.from({ length: FRASES_SLOTS }, (_, i) => (origem[i].trim() ? frases[i] : "")),
    origem,
    em,
  };
}

/** Slots que precisam ir para a IA: os preenchidos em português. */
export function slotsATraduzir(conjunto: Pick<FrasesProspeccao, "frases">): number[] {
  return normalizarSlots(conjunto.frases)
    .map((frase, i) => (frase.trim() ? i : -1))
    .filter((i) => i >= 0);
}
