import type { Sku } from "./skus";

/**
 * Teto mensal do SKU atingido. Lançado por reserveQuota ANTES de qualquer
 * chamada ao Google — quando este erro aparece, nenhum custo foi incorrido.
 * Rotas devem mapeá-lo para HTTP 429 com code "quota_exceeded".
 *
 * Não se aplica ao admin: reserveQuota pula essa checagem (mas continua
 * incrementando o contador) quando a reserva vem de uma sessão admin — o
 * teto global de fatura vira "vale para todo mundo, menos admin".
 */
export class QuotaExceededError extends Error {
  readonly code = "quota_exceeded";

  constructor(
    readonly sku: Sku,
    readonly used: number,
    readonly cap: number,
    readonly period: string,
  ) {
    super(
      `Teto mensal atingido para "${sku}" em ${period}: ${used}/${cap} requests usadas. ` +
        `Aumente o teto em /config/app (campo caps.${sku}) para continuar.`,
    );
    this.name = "QuotaExceededError";
  }
}

export type TipoCotaUsuario = "buscas" | "enriquecimentos" | "geracoesIA";
export type JanelaCotaUsuario = "dia" | "semana" | "mes";

const NOME_TIPO: Record<TipoCotaUsuario, string> = {
  buscas: "buscas",
  enriquecimentos: "enriquecimentos",
  geracoesIA: "gerações de IA",
};

const NOME_JANELA: Record<JanelaCotaUsuario, string> = {
  dia: "diário",
  semana: "semanal",
  mes: "mensal",
};

/**
 * Limite INDIVIDUAL (por usuário) de uma janela (dia/semana/mês) atingido.
 * Lançado por reserveQuota ANTES de qualquer chamada ao Google — mesma
 * garantia do QuotaExceededError global. Nunca se aplica ao admin.
 * Rotas devem mapeá-lo para HTTP 429 com code "user_quota_exceeded".
 */
export class UserQuotaExceededError extends Error {
  readonly code = "user_quota_exceeded";

  constructor(
    readonly tipo: TipoCotaUsuario,
    readonly janela: JanelaCotaUsuario,
    readonly used: number,
    readonly limite: number,
    readonly resetaEm: string,
  ) {
    super(
      `Limite ${NOME_JANELA[janela]} de ${NOME_TIPO[tipo]} atingido: ${used}/${limite}. ` +
        `Reseta em ${resetaEm}.`,
    );
    this.name = "UserQuotaExceededError";
  }
}
