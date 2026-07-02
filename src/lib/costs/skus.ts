/**
 * SKUs da Google Places API (New) usados pelo Radar.
 *
 * O Google cobra cada chamada pelo campo de tier mais alto presente no
 * X-Goog-FieldMask. Os field masks vivem SÓ aqui, amarrados ao SKU que
 * disparam: adicionar um campo a um mask exige conferir o tier dele na
 * tabela de preços vigente e, se mudar o tier, mudar o SKU contado.
 */

export const SKUS = ["textSearch", "detailsEssentials", "detailsPro"] as const;

export type Sku = (typeof SKUS)[number];

export type UsageCounts = Record<Sku, number>;

export interface SkuPricing {
  /** Preço em USD por 1.000 requests, além da cota grátis. */
  usdPer1000: number;
  /** Requests grátis por mês para este SKU. */
  freeQuota: number;
}

export type PricingTable = Record<Sku, SkuPricing>;

/** Field mask enviado em X-Goog-FieldMask, por SKU. */
export const FIELD_MASKS: Record<Sku, string> = {
  textSearch:
    "places.id,places.displayName,places.formattedAddress,places.location,nextPageToken",
  detailsEssentials: "id,displayName,formattedAddress,location",
  detailsPro:
    "id,nationalPhoneNumber,internationalPhoneNumber,websiteUri,rating,userRatingCount",
};

/**
 * Defaults sobrescrevíveis via /config/app (campo "precos").
 * Conferir contra a tabela vigente do Google antes de confiar na projeção.
 */
export const DEFAULT_PRICING: PricingTable = {
  textSearch: { usdPer1000: 32, freeQuota: 10_000 },
  detailsEssentials: { usdPer1000: 5, freeQuota: 10_000 },
  detailsPro: { usdPer1000: 17, freeQuota: 5_000 },
};

/**
 * Teto default = cota grátis: sem configuração explícita o app nunca gasta.
 * Sobrescrevível via /config/app (campo "caps").
 */
export const DEFAULT_CAPS: UsageCounts = {
  textSearch: 10_000,
  detailsEssentials: 10_000,
  detailsPro: 5_000,
};

export const ZERO_USAGE: UsageCounts = {
  textSearch: 0,
  detailsEssentials: 0,
  detailsPro: 0,
};
