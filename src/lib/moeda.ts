/**
 * Moeda (ISO 4217) do PAÍS do endereço — mesmo padrão do mapa país→idioma
 * de `@/lib/idioma` (mesmas chaves de país, pt-BR, como o Google Places/
 * Geocoding devolvem). Módulo neutro, sem dependência de Firestore/
 * lib/leads/lib/demos, para ser importado tanto por `lib/demos/precos.ts`
 * (moeda do preço na demo) quanto por qualquer outro cálculo que precise
 * da moeda local de um país — determinístico, sem IA.
 */

/** Default — Brasil e qualquer país não mapeado abaixo. */
export const MOEDA_PADRAO = "BRL";

/**
 * Mesmas chaves de país de `IDIOMA_POR_PAIS` (`@/lib/idioma`) → código
 * ISO 4217 da moeda local. Só os países mais prováveis de aparecer numa
 * prospecção; país fora da lista (incluindo Brasil) cai no default.
 */
const MOEDA_POR_PAIS: Record<string, string> = {
  portugal: "EUR",
  angola: "AOA",
  moçambique: "MZN",
  "estados unidos": "USD",
  "reino unido": "GBP",
  irlanda: "EUR",
  austrália: "AUD",
  "nova zelândia": "NZD",
  canadá: "CAD",
  espanha: "EUR",
  méxico: "MXN",
  argentina: "ARS",
  chile: "CLP",
  colômbia: "COP",
  peru: "PEN",
  uruguai: "UYU",
  paraguai: "PYG",
  bolívia: "BOB",
  equador: "USD",
  venezuela: "VES",
  "costa rica": "CRC",
  panamá: "USD",
  guatemala: "GTQ",
  honduras: "HNL",
  nicarágua: "NIO",
  "el salvador": "USD",
  "república dominicana": "DOP",
  frança: "EUR",
  bélgica: "EUR",
  suíça: "CHF",
  alemanha: "EUR",
  áustria: "EUR",
  itália: "EUR",
  holanda: "EUR",
  "países baixos": "EUR",
};

/** Moeda a partir do NOME do país (pt-BR, case-insensitive). Sem país reconhecido → default. */
export function moedaDoPais(pais: string | undefined): string {
  if (!pais) return MOEDA_PADRAO;
  return MOEDA_POR_PAIS[pais.trim().toLowerCase()] ?? MOEDA_PADRAO;
}
