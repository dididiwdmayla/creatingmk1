/**
 * Preferências de LISTA por usuário (`/leads` e `/buscas`).
 *
 * Antes, o que dobrava um grupo vivia na querystring da página (`fechados=`
 * em /leads) — ou seja, era do NAVEGADOR e da NAVEGAÇÃO: recarregar a aba,
 * abrir o app no celular ou chegar em /leads por um deep link jogava o
 * operador de volta pra "tudo aberto". Como o ganho de espaço vertical só
 * existe se o estado sobreviver, a escolha passa a morar no doc do usuário
 * (`/usuarios/{id}.preferenciasListas`), no mesmo padrão self-service de
 * `tema`, `ultimoNivelIA` e `metaFaixaMinimizada`.
 *
 * Duas preferências INDEPENDENTES, porque são dois níveis de compactação
 * diferentes: dobrar grupos (o que some é o grupo inteiro) e o modo
 * compacto dos leads (o que some é o miolo de cada card).
 */

/** Telas que guardam grupos dobrados (chaves de grupo são por tela). */
export const LISTAS = ["leads", "buscas"] as const;

export type Lista = (typeof LISTAS)[number];

/**
 * Teto de chaves guardadas por tela. Um operador com centenas de buscas
 * dobradas não pode transformar o doc do usuário num acumulador infinito —
 * ao passar do teto, as chaves mais ANTIGAS caem (a ordem do array é a
 * ordem em que foram dobradas). Grupo cuja chave caiu simplesmente volta
 * a aparecer aberto, que é o padrão.
 */
export const MAX_GRUPOS_FECHADOS = 200;

export interface PreferenciasListas {
  /** Lista de leads em modo compacto (uma linha por lead). */
  leadsCompacto: boolean;
  /** Chaves dos grupos DOBRADOS, por tela (ausente/vazio = tudo aberto). */
  gruposFechados: Record<Lista, string[]>;
}

export const PREFERENCIAS_LISTAS_PADRAO: PreferenciasListas = {
  leadsCompacto: false,
  gruposFechados: { leads: [], buscas: [] },
};

function chavesValidas(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const chaves = valor.filter(
    (chave): chave is string => typeof chave === "string" && chave.length > 0,
  );
  // Dedup preservando a ordem, depois corta as mais antigas no teto.
  return [...new Set(chaves)].slice(-MAX_GRUPOS_FECHADOS);
}

/**
 * Normaliza o que veio do doc (ou do corpo de um PUT) para o formato
 * completo. Doc antigo — todo doc é antigo até o usuário mexer pela
 * primeira vez — cai no padrão sem nenhum caminho especial de migração.
 */
export function normalizaPreferenciasListas(valor: unknown): PreferenciasListas {
  const bruto = (valor ?? {}) as Partial<PreferenciasListas>;
  const fechados = (bruto.gruposFechados ?? {}) as Record<string, unknown>;
  return {
    leadsCompacto: bruto.leadsCompacto === true,
    gruposFechados: {
      leads: chavesValidas(fechados.leads),
      buscas: chavesValidas(fechados.buscas),
    },
  };
}

/** Alterna uma chave de grupo na tela dada, devolvendo o estado novo. */
export function alternarGrupo(
  preferencias: PreferenciasListas,
  lista: Lista,
  chave: string,
): PreferenciasListas {
  const atuais = preferencias.gruposFechados[lista];
  const proximas = atuais.includes(chave)
    ? atuais.filter((c) => c !== chave)
    : [...atuais, chave].slice(-MAX_GRUPOS_FECHADOS);
  return {
    ...preferencias,
    gruposFechados: { ...preferencias.gruposFechados, [lista]: proximas },
  };
}
