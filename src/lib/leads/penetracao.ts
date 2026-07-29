import type { Lead } from "./types";

/**
 * Penetração de site próprio: agregado 100% sobre dados já salvos (nenhum
 * request ao Google) usando a classificação `siteProprio` já existente.
 * "Conhecidos" = com site próprio + só rede social + sem nada; leads
 * `siteProprio` indefinido (nunca enriquecidos nem vindos de busca
 * qualificada) ficam de fora do percentual e são reportados à parte.
 */

/** Base mínima de leads conhecidos para o percentual não sugerir precisão que não existe. */
export const PENETRACAO_BASE_MINIMA = 5;

export interface PenetracaoSite {
  /** Leads com siteProprio conhecido (comSiteProprio + soRedeSocial + semNada). */
  total: number;
  comSiteProprio: number;
  /** Sem site próprio, mas com alguma URL (rede social/agregador). */
  soRedeSocial: number;
  /** Sem site próprio e sem URL nenhuma. */
  semNada: number;
  /** siteProprio indefinido — fora do percentual, reportado à parte. */
  desconhecidos: number;
  /** Ausente quando `total < PENETRACAO_BASE_MINIMA` — base pequena demais para percentual. */
  percentuais?: { comSiteProprio: number; soRedeSocial: number; semNada: number };
}

/** Rede social/agregador: siteProprio false MAS o Google retornou alguma URL (temSite true). */
function soRedeSocial(lead: Lead): boolean {
  return lead.siteProprio === false && lead.temSite === true;
}

/** Agrega a penetração de site próprio sobre um conjunto de leads já filtrado pelo chamador. */
export function calcularPenetracaoSite(leads: Lead[]): PenetracaoSite {
  let comSiteProprio = 0;
  let redeSocial = 0;
  let semNada = 0;
  let desconhecidos = 0;

  for (const lead of leads) {
    if (lead.siteProprio === undefined) {
      desconhecidos += 1;
    } else if (lead.siteProprio) {
      comSiteProprio += 1;
    } else if (soRedeSocial(lead)) {
      redeSocial += 1;
    } else {
      semNada += 1;
    }
  }

  const total = comSiteProprio + redeSocial + semNada;
  const percentuais =
    total >= PENETRACAO_BASE_MINIMA
      ? {
          comSiteProprio: Math.round((comSiteProprio / total) * 100),
          soRedeSocial: Math.round((redeSocial / total) * 100),
          semNada: Math.round((semNada / total) * 100),
        }
      : undefined;

  return { total, comSiteProprio, soRedeSocial: redeSocial, semNada, desconhecidos, percentuais };
}

/** >60% de penetração de site próprio = argumento forte (badge em /hoje e no card do lead). */
export function argumentoForte(penetracao: PenetracaoSite): boolean {
  return (penetracao.percentuais?.comSiteProprio ?? 0) > 60;
}

/**
 * Linha de argumento pronta para a ficha do lead sem site próprio, ex.:
 * "72% das barbearias de Maringá que mapeamos já têm site — a Corte & Estilo
 * está entre as que ainda não têm." Evita flexão de gênero/plural do nicho
 * (texto livre, imprevisível) com "estabelecimentos de {nicho}" — indefinido
 * quando a base é pequena demais para percentual (ver PENETRACAO_BASE_MINIMA).
 */
export function argumentoPenetracao(
  nicho: string,
  regiao: string,
  penetracao: PenetracaoSite,
  nomeLead: string,
): string | undefined {
  if (!penetracao.percentuais) return undefined;
  return (
    `${penetracao.percentuais.comSiteProprio}% dos estabelecimentos de ${nicho} em ${regiao} ` +
    `que mapeamos já têm site — a ${nomeLead} está entre os que ainda não têm.`
  );
}
