import type { Sku } from "./skus";

/**
 * Teto mensal do SKU atingido. Lançado por reserveQuota ANTES de qualquer
 * chamada ao Google — quando este erro aparece, nenhum custo foi incorrido.
 * Rotas devem mapeá-lo para HTTP 429 com code "quota_exceeded".
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
