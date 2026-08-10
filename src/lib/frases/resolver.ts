import { idiomaEfetivoDemo } from "@/lib/demos/idioma";
import { IDIOMA_PADRAO } from "@/lib/idioma";
import type { Lead } from "@/lib/leads/types";
import { frasesEfetivas, posicaoAtual, slotAtual } from "./rotacao";
import { estadoTraducao, textoDoSlot, type EstadoTraducao } from "./traducao";
import type { FrasesProspeccao } from "./types";

/**
 * Precedência da mensagem de WhatsApp de UM lead, em função pura — a mesma
 * regra na ficha e na fila do dia (antes cada tela tinha a sua cópia de
 * `mensagemParaLead`):
 *
 *   1. frases da SKIN da demo do lead, se a skin tiver alguma preenchida;
 *   2. mensagem do GRUPO (a busca mais recente do lead que tenha uma);
 *   3. mensagem GLOBAL da config — continua sendo o último caso, sempre.
 *
 * **Lead sem demo cai direto no passo 2**, exatamente no comportamento que
 * já existia antes das frases: não há conjunto genérico nem conjunto por
 * família de skins para adivinhar por ele. Por consequência, a frase
 * mostrada muda SOZINHA quando o lead ganha demo — antes dela, a do grupo
 * ou a global; depois, a da skin escolhida.
 *
 * Vencendo a frase da skin e o lead sendo de fora do Brasil, o texto sai na
 * TRADUÇÃO já gravada para o idioma dele (ver ./traducao.ts). Sem tradução
 * gravada — ou com o português editado depois dela — sai em português e a
 * ficha oferece o botão: traduzir é chamada paga, nunca acontece sozinho.
 */

/** Forma mínima de busca que a precedência precisa (Busca inteira ou o resumo de /api/hoje). */
export interface MensagemBuscaRef {
  id: string;
  mensagemPadrao?: string;
}

export type OrigemMensagem = "skin" | "grupo" | "global";

/** O lead como a precedência o enxerga: demo (skin + idioma) e endereço (país). */
export type LeadParaMensagem = Pick<Lead, "buscaId" | "demo" | "endereco">;

export interface MensagemResolvida {
  /** Texto vencedor, ainda COM os marcadores por substituir. */
  texto: string;
  origem: OrigemMensagem;
  /**
   * Presente só quando quem venceu foi um conjunto de frases — é este o
   * contador que o clique de enviar faz girar. `posicao` é 1-based, para
   * leitura humana ("frase 2 de 3"); `slot` é o campo de origem (0..2), que
   * é como a tradução é endereçada.
   */
  rotacao?: { skinId: string; posicao: number; total: number; slot: number };
  /**
   * Presente só quando venceu a frase da skin E o lead é estrangeiro. É o
   * que a ficha usa para mostrar o botão de traduzir (ou dizer que já está
   * traduzida).
   */
  traducao?: { idioma: string; estado: EstadoTraducao };
}

/** Conjunto salvo da skin da demo do lead — undefined se o lead não tem demo. */
export function conjuntoDaSkin(
  skinId: string | undefined,
  conjuntos: FrasesProspeccao[],
): FrasesProspeccao | undefined {
  if (!skinId) return undefined;
  return conjuntos.find((conjunto) => conjunto.skinId === skinId);
}

/**
 * Idioma-alvo das frases daquele lead: a MESMA derivação da demo
 * (`idiomaEfetivoDemo` — sobrescrita salva no editor, senão o país do
 * endereço do próprio lead). Nada de mapa paralelo aqui.
 */
export function idiomaDoLead(lead: LeadParaMensagem): string {
  return idiomaEfetivoDemo(lead as Lead);
}

export function resolverMensagem({
  lead,
  buscas,
  conjuntos,
  global,
}: {
  lead: LeadParaMensagem;
  buscas: MensagemBuscaRef[];
  conjuntos: FrasesProspeccao[];
  global: string;
}): MensagemResolvida {
  const conjunto = conjuntoDaSkin(lead.demo?.skinId, conjuntos);
  if (conjunto) {
    const posicao = posicaoAtual(conjunto);
    const slot = slotAtual(conjunto);
    if (posicao !== undefined && slot !== undefined) {
      const idioma = idiomaDoLead(lead);
      return {
        texto: textoDoSlot(conjunto, idioma, slot),
        origem: "skin",
        rotacao: {
          skinId: conjunto.skinId,
          posicao: posicao + 1,
          total: frasesEfetivas(conjunto).length,
          slot,
        },
        ...(idioma !== IDIOMA_PADRAO && {
          traducao: { idioma, estado: estadoTraducao(conjunto, idioma, slot) },
        }),
      };
    }
  }

  // Mensagem do grupo: a busca MAIS RECENTE do lead que tenha uma própria
  // (regra que já valia antes das frases existirem).
  const porId = new Map(buscas.map((busca) => [busca.id, busca]));
  for (const id of [...(lead.buscaId ?? [])].reverse()) {
    const propria = porId.get(id)?.mensagemPadrao;
    if (propria) return { texto: propria, origem: "grupo" };
  }

  return { texto: global, origem: "global" };
}

/**
 * Aplica no estado local do cliente o índice que o servidor devolveu ao
 * girar a rotação — a ficha e a fila do dia usam a mesma função para não
 * precisarem recarregar tudo depois de um envio. Genérica na forma para não
 * amarrar a lib ao tipo da resposta HTTP.
 */
export function comIndiceAtualizado<T extends { conjuntos: FrasesProspeccao[] }>(
  frases: T | null,
  skinId: string,
  indice: number,
): T | null {
  if (!frases) return frases;
  return {
    ...frases,
    conjuntos: frases.conjuntos.map((conjunto) =>
      conjunto.skinId === skinId ? { ...conjunto, indice } : conjunto,
    ),
  };
}

/** Mesma ideia, para a tradução que o servidor acabou de gravar. */
export function comConjuntoAtualizado<T extends { conjuntos: FrasesProspeccao[] }>(
  frases: T | null,
  conjunto: FrasesProspeccao,
): T | null {
  if (!frases) return frases;
  return {
    ...frases,
    conjuntos: frases.conjuntos.map((atual) =>
      atual.skinId === conjunto.skinId ? { ...atual, ...conjunto } : atual,
    ),
  };
}

/** Rótulo curto da fonte, para a ficha dizer de onde veio o texto da caixa. */
export function rotuloOrigem(resolvida: MensagemResolvida): string {
  switch (resolvida.origem) {
    case "skin":
      return `frases da skin — frase ${resolvida.rotacao?.posicao} de ${resolvida.rotacao?.total}`;
    case "grupo":
      return "mensagem do grupo";
    case "global":
      return "mensagem padrão global";
  }
}
