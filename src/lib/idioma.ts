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

/**
 * Países com idioma (e, pelo mesmo mapa de chaves, moeda) mapeados — em
 * capitalização de exibição, para o `datalist` do campo de país da demo
 * avulsa. É sugestão, não validação: o campo aceita qualquer texto e
 * país fora da lista cai no default, exatamente como um endereço de lead
 * de um país não mapeado. Brasil não está no mapa (é o próprio default),
 * mas entra na lista porque é o caso mais comum de todos.
 */
export const PAISES_COM_IDIOMA: readonly string[] = ["Brasil", ...Object.keys(IDIOMA_POR_PAIS)]
  .map((nome) => nome.replace(/(^|\s)\p{Ll}/gu, (letra) => letra.toUpperCase()))
  .sort((a, b) => a.localeCompare(b, "pt-BR"));

/** Minúsculas e sem diacríticos, pra casar "Genève"/"Genebra"/"geneve" com a mesma chave. */
const DIACRITICOS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function normalizarCidade(cidade: string): string {
  return cidade.normalize("NFD").replace(DIACRITICOS_RE, "").trim().toLowerCase();
}

/**
 * Suíça, Bélgica e Canadá são plurilíngues — o país sozinho não decide o
 * idioma do texto (Genebra não é alemão, Antuérpia não é francês, Quebec
 * não é inglês). Mapa cidade (normalizada) → variante regional, só para
 * cidades fora da variante DEFAULT do país (`IDIOMA_POR_PAIS`, que
 * continua sendo o fallback quando a cidade não bate com nada aqui: de-CH,
 * fr-BE, en-CA). Nomes em pt-BR (como a Places/Geocoding API devolvem,
 * `languageCode=pt-BR`) e nas variantes mais comuns em inglês/no idioma
 * local, para cobrir os dois formatos que aparecem nos endereços salvos.
 */
const IDIOMA_POR_CIDADE: Record<string, Record<string, string>> = {
  suíça: {
    // Romandia (francófona) — de-CH é o default do país, estas viram fr-CH.
    genebra: "fr-CH",
    geneve: "fr-CH",
    genf: "fr-CH",
    lausana: "fr-CH",
    lausanne: "fr-CH",
    neuchatel: "fr-CH",
    friburgo: "fr-CH",
    fribourg: "fr-CH",
    sion: "fr-CH",
    sitten: "fr-CH",
    montreux: "fr-CH",
    vevey: "fr-CH",
    nyon: "fr-CH",
    // Ticino (italófona).
    lugano: "it-CH",
    bellinzona: "it-CH",
    locarno: "it-CH",
    mendrisio: "it-CH",
    chiasso: "it-CH",
  },
  bélgica: {
    // Flandres (neerlandófona) — fr-BE é o default do país, estas viram nl-BE.
    antuerpia: "nl-BE",
    antwerpen: "nl-BE",
    antuérpia: "nl-BE",
    anvers: "nl-BE",
    antwerp: "nl-BE",
    gante: "nl-BE",
    gent: "nl-BE",
    ghent: "nl-BE",
    gand: "nl-BE",
    bruges: "nl-BE",
    brugge: "nl-BE",
    lovaina: "nl-BE",
    leuven: "nl-BE",
    louvain: "nl-BE",
    hasselt: "nl-BE",
    mechelen: "nl-BE",
    malinas: "nl-BE",
    kortrijk: "nl-BE",
    courtrai: "nl-BE",
  },
  canadá: {
    // Quebec (francófona) — en-CA é o default do país, estas viram fr-CA.
    montreal: "fr-CA",
    montréal: "fr-CA",
    quebec: "fr-CA",
    québec: "fr-CA",
    "cidade de quebec": "fr-CA",
    "quebec city": "fr-CA",
    laval: "fr-CA",
    gatineau: "fr-CA",
    sherbrooke: "fr-CA",
    "trois-rivieres": "fr-CA",
    "trois-rivières": "fr-CA",
    saguenay: "fr-CA",
    longueuil: "fr-CA",
  },
};

/**
 * Idioma-alvo a partir do país E da cidade do endereço — mais preciso que
 * `idiomaDoPais` sozinho nos três países plurilíngues do mapa acima
 * (Suíça/Bélgica/Canadá); qualquer outro país cai direto em `idiomaDoPais`
 * (cidade nunca consultada). Cidade não reconhecida dentro de um país
 * plurilíngue cai na variante DEFAULT do país, como sempre foi.
 */
export function idiomaDoPaisECidade(pais: string | undefined, cidade: string | undefined): string {
  if (!pais) return IDIOMA_PADRAO;
  const porCidade = IDIOMA_POR_CIDADE[pais.trim().toLowerCase()];
  if (porCidade && cidade) {
    const idiomaCidade = porCidade[normalizarCidade(cidade)];
    if (idiomaCidade) return idiomaCidade;
  }
  return idiomaDoPais(pais);
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
 * Variantes regionais que só existem por causa da derivação por CIDADE nos
 * países plurilíngues (`IDIOMA_POR_CIDADE` acima) — o idioma DEFAULT de
 * Suíça/Bélgica/Canadá já vem de `IDIOMA_POR_PAIS` (de-CH/fr-BE/en-CA); só
 * as demais variantes que uma cidade pode produzir precisam de entrada
 * própria aqui, pra `idiomaLabelRegional` rotular certo ("italiano
 * (Suíça)") e o seletor manual da aba Tema (`IDIOMAS_SUPORTADOS`) as
 * oferecer.
 */
const IDIOMA_REGIONAL_EXTRA: Record<string, string> = {
  "fr-CH": "suíça",
  "it-CH": "suíça",
  "nl-BE": "bélgica",
  "fr-CA": "canadá",
};

/**
 * País (em pt-BR) do idioma-alvo — o mapa acima invertido, sem lista nova a
 * manter, mais as variantes regionais extras. Dois países com o mesmo
 * idioma (Holanda/Países Baixos) resolvem pelo PRIMEIRO do mapa, que é o
 * que aparece nos rótulos.
 */
const PAIS_POR_IDIOMA: Record<string, string> = {
  ...Object.entries(IDIOMA_POR_PAIS).reduce(
    (acc, [pais, idioma]) => (idioma in acc ? acc : { ...acc, [idioma]: pais }),
    {} as Record<string, string>,
  ),
  ...IDIOMA_REGIONAL_EXTRA,
};

/** "estados unidos" → "Estados Unidos" (o mapa guarda tudo em minúsculas). */
function capitalizarPais(pais: string): string {
  return pais.replace(/(^|\s)(\p{L})/gu, (_, espaco: string, letra: string) => espaco + letra.toUpperCase());
}

/**
 * Rótulo do idioma COM a variante regional: "espanhol (Argentina)",
 * "inglês (Reino Unido)". A variante é o ponto — o que se escreve para um
 * lead argentino não é espanhol genérico —, então a UI e o prompt de
 * tradução usam este rótulo, não o `idiomaLabel` cru. Idioma sem país
 * conhecido cai no rótulo simples.
 */
export function idiomaLabelRegional(idioma: string): string {
  if (idioma === IDIOMA_PADRAO) return "português do Brasil";
  const pais = PAIS_POR_IDIOMA[idioma];
  return pais ? `${idiomaLabel(idioma)} (${capitalizarPais(pais)})` : idiomaLabel(idioma);
}

/**
 * Lista curada de idiomas-alvo oferecidos no seletor do editor: o default
 * + todo valor distinto do mapa país→idioma, ordenados por rótulo. Usada
 * também para validar o override manual salvo em `LeadDemo.idioma`.
 */
export const IDIOMAS_SUPORTADOS: readonly string[] = Array.from(
  new Set([
    IDIOMA_PADRAO,
    ...Object.values(IDIOMA_POR_PAIS),
    ...Object.keys(IDIOMA_REGIONAL_EXTRA),
  ]),
).sort((a, b) => idiomaLabel(a).localeCompare(idiomaLabel(b)) || a.localeCompare(b));
