export const TRADUCOES_NICHO_COLLECTION = "traducoesNicho";

/**
 * Tradução de um termo de nicho para um idioma-alvo (ver "Sugestão de termo
 * local na busca") — cacheada PERMANENTEMENTE em /traducoesNicho/{chave},
 * um par nicho+idioma só é traduzido uma vez na vida (mesmo espírito do
 * /geocache e do /regioes: 1 chamada Gemini, cache pra sempre).
 */
export interface TraducaoNicho {
  /** Texto original do nicho, como o usuário digitou (não normalizado). */
  nicho: string;
  /** Idioma-alvo (BCP-47) — o mesmo derivado em src/lib/geo/geocode.ts. */
  idioma: string;
  /** Termo traduzido, pronto pra substituir o campo de nicho na busca. */
  termo: string;
  geradoEm: string;
}
