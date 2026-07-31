/**
 * Idioma-alvo (BCP-47) dos textos gerados pela IA na Forja de Demos — ver
 * "Idioma da IA na demo" em ARCHITECTURE.md. Módulo neutro (sem
 * dependência de Firestore/lib/leads/lib/demos) para poder ser importado
 * tanto por `lib/geo/geocode.ts` (idioma da REGIÃO buscada) quanto por
 * `lib/demos/idioma.ts` (idioma do LEAD, a partir do endereço específico
 * do negócio — ver `lib/leads/cidade.ts#cidadeDoEndereco`).
 */

/** Default do idioma-alvo — Brasil e qualquer país não mapeado abaixo. */
export const IDIOMA_PADRAO = "pt-BR";

/**
 * Mapa país (nome em pt-BR, como o Google Places/Geocoding devolvem — as
 * duas APIs são sempre chamadas com `language=pt-BR`) → idioma BCP-47 dos
 * textos gerados pela IA. Só os países mais prováveis de aparecer numa
 * prospecção; qualquer país fora da lista (incluindo Brasil) cai no
 * default `IDIOMA_PADRAO`.
 */
const IDIOMA_POR_PAIS: Record<string, string> = {
  portugal: "pt-PT",
  angola: "pt-AO",
  moçambique: "pt-MZ",
  "estados unidos": "en-US",
  "reino unido": "en-GB",
  irlanda: "en-IE",
  austrália: "en-AU",
  "nova zelândia": "en-NZ",
  canadá: "en-CA",
  espanha: "es-ES",
  méxico: "es-MX",
  argentina: "es-AR",
  chile: "es-CL",
  colômbia: "es-CO",
  peru: "es-PE",
  uruguai: "es-UY",
  paraguai: "es-PY",
  bolívia: "es-BO",
  equador: "es-EC",
  venezuela: "es-VE",
  "costa rica": "es-CR",
  panamá: "es-PA",
  guatemala: "es-GT",
  honduras: "es-HN",
  nicarágua: "es-NI",
  "el salvador": "es-SV",
  "república dominicana": "es-DO",
  frança: "fr-FR",
  bélgica: "fr-BE",
  suíça: "de-CH",
  alemanha: "de-DE",
  áustria: "de-AT",
  itália: "it-IT",
  holanda: "nl-NL",
  "países baixos": "nl-NL",
};

/** Idioma-alvo a partir do NOME do país (pt-BR, case-insensitive). Sem país reconhecido → default. */
export function idiomaDoPais(pais: string | undefined): string {
  if (!pais) return IDIOMA_PADRAO;
  return IDIOMA_POR_PAIS[pais.trim().toLowerCase()] ?? IDIOMA_PADRAO;
}

/** true para pt-BR/pt-PT/pt-AO/pt-MZ — a busca não ganha dicas de idioma pra esses. */
export function idiomaEhLusofono(idioma: string): boolean {
  return idioma.startsWith("pt");
}

/** Rótulo em português do idioma-alvo (raiz do BCP-47; pt-BR tem rótulo próprio). */
const IDIOMA_RAIZ_LABEL: Record<string, string> = {
  pt: "português",
  en: "inglês",
  es: "espanhol",
  fr: "francês",
  de: "alemão",
  it: "italiano",
  nl: "holandês",
};

/** "português do Brasil" / "inglês" / "espanhol" etc. — usado nos prompts de IA e na UI. */
export function idiomaLabel(idioma: string): string {
  if (idioma === IDIOMA_PADRAO) return "português do Brasil";
  const raiz = idioma.split("-")[0];
  return IDIOMA_RAIZ_LABEL[raiz] ?? idioma;
}

/**
 * Lista curada de idiomas-alvo oferecidos no seletor do editor: o default
 * + todo valor distinto do mapa país→idioma, ordenados por rótulo. Usada
 * também para validar o override manual salvo em `LeadDemo.idioma`.
 */
export const IDIOMAS_SUPORTADOS: readonly string[] = Array.from(
  new Set([IDIOMA_PADRAO, ...Object.values(IDIOMA_POR_PAIS)]),
).sort((a, b) => idiomaLabel(a).localeCompare(idiomaLabel(b)) || a.localeCompare(b));
