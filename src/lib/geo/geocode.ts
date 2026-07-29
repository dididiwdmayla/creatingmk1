import { reserveQuota, type UsageCounts } from "@/lib/costs";
import { ValidationError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import { PlacesError, requireApiKey, type LatLngRect } from "@/lib/places/client";

/**
 * Geocodificação da região da busca (Geocoding API), com cache permanente
 * em /geocache — cada região só custa 1 request na vida (SKU geocoding,
 * Essentials). O viewport devolvido vira o locationRestriction do Text
 * Search: localização dura, sem resultados de fora da região.
 */

export const GEOCACHE_COLLECTION = "geocache";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

export interface RegiaoGeo {
  /** Texto da região como o usuário digitou (primeira vez que resolveu). */
  regiao: string;
  /** Endereço resolvido pelo Google ("Sarandi, PR, Brasil"). */
  endereco: string;
  location: { lat: number; lng: number };
  /** Viewport (retângulo) da região — vira locationRestriction. */
  viewport: LatLngRect;
  /**
   * Idioma-alvo (BCP-47) derivado do país da região — ver "Idioma da IA na
   * demo": a sugestão de tema/textos do Gemini usa este idioma para o lead
   * (default "pt-BR"). Docs de cache antigos (sem o campo) são derivados na
   * leitura, sem regravar.
   */
  idioma: string;
  criadoEm: string;
}

/**
 * Último trecho do endereço formatado (mesma heurística de
 * src/lib/regioes/ia.ts#parseCidadePais) — o país, em português (a
 * Geocoding API é chamada com language=pt-BR).
 */
function paisDoEndereco(endereco: string): string {
  const partes = endereco
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);
  return partes.length > 0 ? partes[partes.length - 1] : "";
}

/**
 * Mapa país (nome em pt-BR, como o Google devolve) → idioma BCP-47 dos
 * textos gerados pela IA na demo. Só os países mais prováveis de aparecer
 * numa busca de prospecção; qualquer país fora da lista (incluindo Brasil)
 * cai no default pt-BR.
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

/** Default do idioma-alvo — Brasil e qualquer país não mapeado acima. */
export const IDIOMA_PADRAO = "pt-BR";

/** Default "pt-BR" — inclui Brasil e qualquer país não mapeado acima. */
export function idiomaDoEndereco(endereco: string): string {
  const pais = paisDoEndereco(endereco).toLowerCase();
  return IDIOMA_POR_PAIS[pais] ?? IDIOMA_PADRAO;
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

/** ID do doc de cache: minúsculas, espaços colapsados, URL-encoded (sem "/"). */
export function regiaoCacheKey(regiao: string): string {
  return encodeURIComponent(regiao.trim().toLowerCase().replace(/\s+/g, " "));
}

interface GeocodeResponse {
  status?: string;
  error_message?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: {
      location?: { lat?: number; lng?: number };
      viewport?: {
        northeast?: { lat?: number; lng?: number };
        southwest?: { lat?: number; lng?: number };
      };
    };
  }>;
}

function asRegiaoGeo(data: Record<string, unknown>): RegiaoGeo {
  return data as unknown as RegiaoGeo;
}

/**
 * Resolve a região: cache primeiro (sem custo), senão 1 request de
 * geocoding (reserva de cota antes, como todo request pago). Região que o
 * Google não encontra → ValidationError (400); erro do Google → PlacesError
 * (502, cota já consumida).
 */
export async function geocodeRegion(
  db: AppDb,
  regiao: string,
  caps: UsageCounts,
  ctx: { userId?: string; isAdmin?: boolean } = {},
): Promise<RegiaoGeo & { cached: boolean }> {
  const texto = regiao.trim();
  if (!texto) {
    throw new ValidationError(["regiao não pode ser vazia"]);
  }

  const ref = db.collection(GEOCACHE_COLLECTION).doc(regiaoCacheKey(texto));
  const snap = await ref.get();
  const cachedData = snap.exists ? snap.data() : undefined;
  if (cachedData) {
    const cacheado = asRegiaoGeo(cachedData);
    // Migração de leitura: cache antigo (antes do campo idioma) deriva do
    // endereço já resolvido, sem regravar o doc.
    return {
      ...cacheado,
      idioma: cacheado.idioma ?? idiomaDoEndereco(cacheado.endereco),
      cached: true,
    };
  }

  const key = requireApiKey();
  await reserveQuota(db, "geocoding", caps, undefined, { userId: ctx.userId, isAdmin: ctx.isAdmin });

  const url =
    `${GEOCODE_URL}?address=${encodeURIComponent(texto)}` +
    `&language=pt-BR&region=br&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 2000);
    throw new PlacesError(res.status, detail || res.statusText || "sem detalhe");
  }

  const data = (await res.json()) as GeocodeResponse;
  if (data.status === "ZERO_RESULTS") {
    throw new ValidationError([
      `região "${texto}" não encontrada — confira a grafia (ex.: "Sarandi PR")`,
    ]);
  }
  const primeiro = data.results?.[0];
  const location = primeiro?.geometry?.location;
  const viewport = primeiro?.geometry?.viewport;
  if (
    data.status !== "OK" ||
    !primeiro ||
    location?.lat === undefined ||
    location?.lng === undefined ||
    viewport?.northeast?.lat === undefined ||
    viewport?.northeast?.lng === undefined ||
    viewport?.southwest?.lat === undefined ||
    viewport?.southwest?.lng === undefined
  ) {
    throw new PlacesError(
      res.status,
      `geocoding respondeu ${data.status ?? "sem status"}: ${data.error_message ?? "sem detalhe"}`,
    );
  }

  const endereco = primeiro.formatted_address ?? texto;
  const resolvida: RegiaoGeo = {
    regiao: texto,
    endereco,
    location: { lat: location.lat, lng: location.lng },
    viewport: {
      low: { latitude: viewport.southwest.lat, longitude: viewport.southwest.lng },
      high: { latitude: viewport.northeast.lat, longitude: viewport.northeast.lng },
    },
    idioma: idiomaDoEndereco(endereco),
    criadoEm: new Date().toISOString(),
  };
  await ref.set(resolvida as unknown as Record<string, unknown>);
  return { ...resolvida, cached: false };
}
