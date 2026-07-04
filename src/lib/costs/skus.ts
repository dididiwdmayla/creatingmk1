/**
 * SKUs da Google Places API (New) usados pelo Radar.
 *
 * O Google cobra cada chamada pelo campo de tier mais alto presente no
 * X-Goog-FieldMask. Os field masks vivem SÓ aqui, amarrados ao SKU que
 * disparam: adicionar um campo a um mask exige conferir o tier dele na
 * tabela de preços vigente e, se mudar o tier, mudar o SKU contado.
 *
 * Tabela vigente (conferida em jul/2026, sempre sobrescrevível via config):
 * - displayName/formattedAddress/location no Text Search → tier PRO
 *   (US$32/1.000, 5.000 grátis/mês).
 * - websiteUri/telefones/rating/userRatingCount → tier ENTERPRISE
 *   (Text Search US$35/1.000; Place Details US$20/1.000; 1.000 grátis/mês).
 */

export const SKUS = [
  "textSearch",
  "textSearchEnterprise",
  "detailsEssentials",
  "detailsEnterprise",
] as const;

export type Sku = (typeof SKUS)[number];

export type UsageCounts = Record<Sku, number>;

/**
 * Migração suave da correção de tier (jul/2026): contadores de uso e
 * config antigos podem ainda usar o nome "detailsPro" — na leitura, o
 * valor legado vale quando o novo nome ainda não existe no doc.
 */
export const LEGACY_SKU_ALIASES: Partial<Record<Sku, string>> = {
  detailsEnterprise: "detailsPro",
};

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
  // Busca qualificada: + websiteUri (campo Enterprise) para saber quem já
  // tem site sem gastar um Place Details por lead.
  textSearchEnterprise:
    "places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,nextPageToken",
  // displayName em Place Details é tier Pro — fora do mask para o SKU
  // continuar Essentials de verdade.
  detailsEssentials: "id,formattedAddress,location",
  detailsEnterprise:
    "id,nationalPhoneNumber,internationalPhoneNumber,websiteUri,rating,userRatingCount",
};

/**
 * Defaults sobrescrevíveis via /config/app (campo "precos").
 * Conferir contra a tabela vigente do Google antes de confiar na projeção.
 */
export const DEFAULT_PRICING: PricingTable = {
  textSearch: { usdPer1000: 32, freeQuota: 5_000 },
  textSearchEnterprise: { usdPer1000: 35, freeQuota: 1_000 },
  detailsEssentials: { usdPer1000: 5, freeQuota: 10_000 },
  detailsEnterprise: { usdPer1000: 20, freeQuota: 1_000 },
};

/**
 * Teto default = cota grátis: sem configuração explícita o app nunca gasta.
 * Sobrescrevível via /config/app (campo "caps").
 */
export const DEFAULT_CAPS: UsageCounts = {
  textSearch: 5_000,
  textSearchEnterprise: 1_000,
  detailsEssentials: 10_000,
  detailsEnterprise: 1_000,
};

export const ZERO_USAGE: UsageCounts = {
  textSearch: 0,
  textSearchEnterprise: 0,
  detailsEssentials: 0,
  detailsEnterprise: 0,
};
