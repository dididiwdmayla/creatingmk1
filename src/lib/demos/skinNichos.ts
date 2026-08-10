/**
 * skinId → nicho da skin, SEM importar os componentes das skins.
 *
 * Existe porque o desempate de nicho das frases de prospecção (quando a
 * busca do lead não tem nicho) roda também em /hoje, e importar
 * `SKINS` de lib/demos/registry.ts arrastaria as 8 skins inteiras — com
 * motion, efeitos e imagens — para o bundle daquela página só pra ler um
 * campo de texto.
 *
 * A cópia é mantida honesta por `__tests__/skinNichos.test.ts`, que compara
 * este mapa com o registro de verdade e falha se uma skin nova entrar sem
 * passar por aqui.
 */
export const NICHO_POR_SKIN: Record<string, string> = {
  "barbearia-editorial": "barbearia",
  "barbearia2-sul": "barbearia",
  "tatuagem-editorial": "tatuagem",
  "tatuagem-pigmento-vivo": "tatuagem",
  "lancheria-chapa-burger": "lancheria",
  "imobiliaria-curada": "imobiliaria",
  "multimarcas-vortice": "multimarcas",
  "petshop-focinho-feliz": "petshop",
};

/** Nicho da skin escolhida na demo — undefined para skin ausente/desconhecida. */
export function nichoDaSkin(skinId: string | undefined): string | undefined {
  return skinId ? NICHO_POR_SKIN[skinId] : undefined;
}
