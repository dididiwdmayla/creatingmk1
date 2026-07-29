export const REGIOES_COLLECTION = "regioes";

export const CONFIANCAS = ["alta", "media", "baixa"] as const;
export type Confianca = (typeof CONFIANCAS)[number];

/**
 * Índice de mercado (precificação de sites) de UMA cidade/região
 * específica — não a média do país. Gerado por IA (ver ./ia), cacheado
 * PERMANENTEMENTE em /regioes/{slug}; o slug é a MESMA chave normalizada
 * do cache de geocoding (ver `regiaoCacheKey` em src/lib/geo/geocode.ts),
 * então uma região só é geocodificada uma vez na vida e o índice reaproveita
 * exatamente essa identidade.
 */
export interface RegiaoIndice {
  /** Igual ao ID do doc. */
  slug: string;
  /** Texto da região como o usuário/busca digitou (mesmo valor do geocache). */
  regiaoTexto: string;
  /** Cidade específica resolvida (não o país inteiro). */
  cidade: string;
  pais: string;
  /** Índice relativo do mercado local (cidade média do interior do Brasil = 1.0). */
  indice: number;
  /** Edição manual do admin na UI da região — quando presente, VENCE `indice`. */
  indiceAjustado?: number;
  /** Código/nome da moeda local (ex.: "CHF", "USD"). */
  moedaLocal: string;
  /** 1 unidade da moeda local ≈ N reais (estimativa) — ausente = sem câmbio confiável. */
  cambioAproxBRL?: number;
  /** Faixa típica local de um site simples, na moeda local (texto curto). */
  faixaMercadoLocal: string;
  /** 1-2 frases explicando o índice. */
  justificativa: string;
  confianca: Confianca;
  geradoEm: string;
}
