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
 * diferentes: dobrar grupos (o que some é o grupo inteiro) e a DENSIDADE
 * da grade (o que some é o miolo de cada card).
 */

/** Telas que guardam grupos dobrados (chaves de grupo são por tela). */
export const LISTAS = ["leads", "buscas"] as const;

export type Lista = (typeof LISTAS)[number];

/** Cards por linha na grade. Também é o nível de conteúdo do card. */
export const DENSIDADES = [1, 2, 3, 4] as const;

export type Densidade = (typeof DENSIDADES)[number];

/**
 * Larguras de corte do padrão AUTOMÁTICO (`densidade: null`). O celular
 * cai em 1 de propósito: densidade é escolha de quem já conhece a fila, e
 * o padrão de quem abre o app pela primeira vez tem que ser o card que se
 * lê inteiro. Os degraus seguintes acompanham os breakpoints do Tailwind
 * (sm/lg/xl), então a grade automática nunca discorda do resto do layout.
 */
const CORTES: Array<{ minimo: number; densidade: Densidade }> = [
  { minimo: 1280, densidade: 4 },
  { minimo: 1024, densidade: 3 },
  { minimo: 640, densidade: 2 },
];

export function densidadePadrao(larguraPx: number): Densidade {
  return CORTES.find((corte) => larguraPx >= corte.minimo)?.densidade ?? 1;
}

export function densidadeValida(valor: unknown): valor is Densidade {
  return (DENSIDADES as readonly unknown[]).includes(valor);
}

/**
 * Teto de chaves guardadas por tela. Um operador com centenas de buscas
 * dobradas não pode transformar o doc do usuário num acumulador infinito —
 * ao passar do teto, as chaves mais ANTIGAS caem (a ordem do array é a
 * ordem em que foram dobradas). Grupo cuja chave caiu simplesmente volta
 * a aparecer aberto, que é o padrão.
 */
export const MAX_GRUPOS_FECHADOS = 200;

export interface PreferenciasListas {
  /**
   * Cards por linha, POR TELA — `null` é o padrão AUTOMÁTICO (sai da
   * largura da tela, ver `densidadePadrao`). Guardar `null` em vez de já
   * resolver o número é o que faz a escolha do usuário SOBREPOR o padrão
   * sem congelá-lo: quem nunca escolheu continua acompanhando a largura ao
   * trocar de aparelho, quem escolheu leva a escolha para todos eles.
   *
   * É por tela porque as duas listam coisas diferentes: 3 buscas por linha
   * cabem onde 3 leads não caberiam, e vice-versa.
   */
  densidade: Record<Lista, Densidade | null>;
  /** Chaves dos grupos DOBRADOS, por tela (ausente/vazio = tudo aberto). */
  gruposFechados: Record<Lista, string[]>;
}

export const PREFERENCIAS_LISTAS_PADRAO: PreferenciasListas = {
  densidade: { leads: null, buscas: null },
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
 * O modo compacto de `/leads` que existia antes da densidade — uma linha
 * por lead, ligado por um botão próprio na barra de filtros. Ele virou o
 * DEGRAU 2 da densidade (a partir dele o card larga endereço e a faixa de
 * "já contatou"), então o botão saiu da tela e o campo saiu do tipo: só a
 * normalização ainda o conhece, para traduzir doc antigo.
 */
interface PreferenciasListasLegado {
  leadsCompacto?: unknown;
}

/**
 * Densidade guardada, ou o degrau em que o modo compacto legado aterrissa.
 *
 * 2 e não 3: quem ligou o compacto pediu MAIS leads por tela, não a fila
 * mínima — o degrau 2 dobra a contagem por linha e ainda mantém site/tel e
 * score, que é o que aquele card decidia. Cair em 3 ou 4 seria escolher
 * pelo usuário um salto que ele nunca deu.
 */
function densidadeGuardada(valor: unknown, legadoCompacto: boolean): Densidade | null {
  if (densidadeValida(valor)) return valor;
  return legadoCompacto ? 2 : null;
}

/**
 * Normaliza o que veio do doc (ou do corpo de um PUT) para o formato
 * completo. Doc antigo — todo doc é antigo até o usuário mexer pela
 * primeira vez — cai no padrão pelo MESMO caminho, sem código de migração
 * à parte: `leadsCompacto` é lido aqui e some do doc no primeiro PUT.
 */
export function normalizaPreferenciasListas(valor: unknown): PreferenciasListas {
  const bruto = (valor ?? {}) as Partial<PreferenciasListas> & PreferenciasListasLegado;
  const fechados = (bruto.gruposFechados ?? {}) as Record<string, unknown>;
  const densidade = (bruto.densidade ?? {}) as Record<string, unknown>;
  const legadoCompacto = bruto.leadsCompacto === true;
  return {
    densidade: {
      leads: densidadeGuardada(densidade.leads, legadoCompacto),
      // O compacto legado era só de /leads — /buscas nunca teve o botão,
      // então nada a herdar aqui: segue no automático.
      buscas: densidadeGuardada(densidade.buscas, false),
    },
    gruposFechados: {
      leads: chavesValidas(fechados.leads),
      buscas: chavesValidas(fechados.buscas),
    },
  };
}

/** Troca a densidade de uma tela, devolvendo o estado novo. */
export function definirDensidade(
  preferencias: PreferenciasListas,
  lista: Lista,
  densidade: Densidade | null,
): PreferenciasListas {
  return {
    ...preferencias,
    densidade: { ...preferencias.densidade, [lista]: densidade },
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
