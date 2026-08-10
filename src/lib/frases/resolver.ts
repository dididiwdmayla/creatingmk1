import { nichoDaSkin } from "@/lib/demos/skinNichos";
import type { Lead } from "@/lib/leads/types";
import { chaveNicho } from "./chave";
import { fraseAtual, frasesEfetivas, posicaoAtual } from "./rotacao";
import type { FrasesProspeccao } from "./types";

/**
 * Precedência da mensagem de WhatsApp de UM lead, em função pura — a mesma
 * regra na ficha e na fila do dia (antes cada tela tinha a sua cópia de
 * `mensagemParaLead`):
 *
 *   1. frases do NICHO do lead, se o nicho tiver alguma preenchida;
 *   2. frases GENÉRICAS de fallback, se tiverem alguma preenchida;
 *   3. mensagem do GRUPO (a busca mais recente do lead que tenha uma);
 *   4. mensagem GLOBAL da config — continua sendo o último caso, sempre.
 *
 * Nada é removido: um time que nunca preencher uma frase segue exatamente no
 * comportamento antigo (grupo, senão global).
 */

/** Forma mínima de busca que a precedência precisa (Busca inteira ou o resumo de /api/hoje). */
export interface MensagemBuscaRef {
  id: string;
  mensagemPadrao?: string;
}

export type OrigemMensagem = "nicho" | "genericas" | "grupo" | "global";

export interface MensagemResolvida {
  /** Texto vencedor, ainda COM os marcadores por substituir. */
  texto: string;
  origem: OrigemMensagem;
  /**
   * Presente só quando quem venceu foi um conjunto de frases — é este o
   * contador que o clique de enviar faz girar. `nicho: null` = o genérico.
   * `posicao` é 1-based, para leitura humana ("frase 2 de 3").
   */
  rotacao?: { nicho: string | null; posicao: number; total: number };
}

/**
 * Nicho do lead: o da BUSCA que o originou, que já está salvo no doc do lead
 * (mesma fonte que o card de precificação usa). A skin da demo só entra como
 * desempate quando o nicho da busca está vazio.
 */
export function nichoDoLead(lead: Pick<Lead, "busca" | "demo">): string | undefined {
  const daBusca = lead.busca?.nicho?.trim();
  if (daBusca) return daBusca;
  return nichoDaSkin(lead.demo?.skinId);
}

/** Conjunto salvo do nicho, casando pela chave normalizada (caixa/espaços). */
export function conjuntoDoNicho(
  nicho: string | undefined,
  conjuntos: FrasesProspeccao[],
): FrasesProspeccao | undefined {
  if (!nicho) return undefined;
  const alvo = chaveNicho(nicho);
  return conjuntos.find((conjunto) => chaveNicho(conjunto.nicho) === alvo);
}

function comoRotacao(
  conjunto: FrasesProspeccao,
  nicho: string | null,
): MensagemResolvida | undefined {
  const texto = fraseAtual(conjunto);
  const posicao = posicaoAtual(conjunto);
  if (texto === undefined || posicao === undefined) return undefined;
  return {
    texto,
    origem: nicho === null ? "genericas" : "nicho",
    rotacao: { nicho, posicao: posicao + 1, total: frasesEfetivas(conjunto).length },
  };
}

export function resolverMensagem({
  lead,
  buscas,
  conjuntos,
  genericas,
  global,
}: {
  lead: Pick<Lead, "busca" | "buscaId" | "demo">;
  buscas: MensagemBuscaRef[];
  conjuntos: FrasesProspeccao[];
  genericas?: FrasesProspeccao;
  global: string;
}): MensagemResolvida {
  const conjunto = conjuntoDoNicho(nichoDoLead(lead), conjuntos);
  if (conjunto) {
    const doNicho = comoRotacao(conjunto, conjunto.nicho);
    if (doNicho) return doNicho;
  }

  if (genericas) {
    const doGenerico = comoRotacao(genericas, null);
    if (doGenerico) return doGenerico;
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
export function comIndiceAtualizado<
  T extends { conjuntos: FrasesProspeccao[]; genericas: FrasesProspeccao },
>(frases: T | null, nicho: string | null, indice: number): T | null {
  if (!frases) return frases;
  if (nicho === null) return { ...frases, genericas: { ...frases.genericas, indice } };
  const alvo = chaveNicho(nicho);
  return {
    ...frases,
    conjuntos: frases.conjuntos.map((conjunto) =>
      chaveNicho(conjunto.nicho) === alvo ? { ...conjunto, indice } : conjunto,
    ),
  };
}

/** Rótulo curto da fonte, para a ficha dizer de onde veio o texto da caixa. */
export function rotuloOrigem(resolvida: MensagemResolvida): string {
  switch (resolvida.origem) {
    case "nicho":
      return `frases do nicho — frase ${resolvida.rotacao?.posicao} de ${resolvida.rotacao?.total}`;
    case "genericas":
      return `frases genéricas — frase ${resolvida.rotacao?.posicao} de ${resolvida.rotacao?.total}`;
    case "grupo":
      return "mensagem do grupo";
    case "global":
      return "mensagem padrão global";
  }
}
