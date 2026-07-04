import { QuotaExceededError, reserveQuota, FIELD_MASKS, type Sku, type UsageCounts } from "@/lib/costs";
import type { UsageDb } from "@/lib/firestore-like";

/**
 * Cliente da Google Places API (New). Único ponto do app que fala com o
 * Google: toda chamada passa por reserveQuota() ANTES do fetch (se o Google
 * falhar depois, o contador fica 1 acima do real — o lado seguro do erro) e
 * usa exclusivamente os field masks de skus.ts, amarrados ao SKU contado.
 */

const BASE_URL = "https://places.googleapis.com/v1";

/** Página máxima do Text Search (New) e limite de resultados do app (2 páginas). */
const PAGE_SIZE_MAX = 20;
export const SEARCH_MAX_RESULTS = 40;

/** Google respondeu erro. A cota do SKU já foi consumida. Rotas → HTTP 502. */
export class PlacesError extends Error {
  readonly code = "places_error";

  constructor(
    readonly googleStatus: number,
    readonly detail: string,
  ) {
    super(`Google Places respondeu ${googleStatus}: ${detail}`);
    this.name = "PlacesError";
  }
}

export interface PlaceBasico {
  placeId: string;
  nome: string;
  endereco?: string;
  location?: { lat: number; lng: number };
  /** Só na busca qualificada: o websiteUri veio de graça no Text Search. */
  temSite?: boolean;
  siteUrl?: string;
}

export interface DetalhesLugar {
  telefone?: string;
  telefoneIntl?: string;
  site?: string;
  rating?: number;
  totalAvaliacoes?: number;
}

export interface SearchTextOptions {
  /** Resultados desejados (1–40). Acima de 20 pagina, cada página custa 1 request. */
  quantidade?: number;
  /** Busca qualificada: mask com places.websiteUri → SKU textSearchEnterprise. */
  qualificada?: boolean;
}

export interface SearchTextResult {
  places: PlaceBasico[];
  /** Páginas efetivamente buscadas — cada uma consumiu 1 de cota. */
  paginas: number;
  /** Preenchido quando a busca parou antes da quantidade pedida (teto/erro). */
  aviso?: string;
}

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new Error(
      "Variável de ambiente GOOGLE_PLACES_API_KEY não configurada (ver .env.example).",
    );
  }
  return key;
}

async function errorDetail(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return body.slice(0, 2000) || res.statusText || "sem detalhe";
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
}

function toPlaceBasico(place: GooglePlace, qualificada: boolean): PlaceBasico | undefined {
  if (!place.id) return undefined; // sem Place ID não vira doc em /leads
  return {
    placeId: place.id,
    nome: place.displayName?.text ?? "(sem nome)",
    endereco: place.formattedAddress,
    location:
      place.location?.latitude !== undefined && place.location?.longitude !== undefined
        ? { lat: place.location.latitude, lng: place.location.longitude }
        : undefined,
    ...(qualificada && {
      temSite: Boolean(place.websiteUri),
      siteUrl: place.websiteUri || undefined,
    }),
  };
}

/**
 * Text Search (New). SKU textSearch (tier Pro) ou, na busca qualificada,
 * textSearchEnterprise. Pagina via nextPageToken até `quantidade`
 * resultados (máx. 40 = 2 páginas), reservando cota ANTES de cada página.
 * Se o teto (ou o Google) falhar a partir da 2ª página, devolve o que já
 * foi obtido com `aviso` — a cota da 1ª página já foi consumida, então
 * jogar os resultados fora seria pagar sem receber.
 */
export async function searchText(
  db: UsageDb,
  textQuery: string,
  caps: UsageCounts,
  options: SearchTextOptions = {},
): Promise<SearchTextResult> {
  const key = apiKey();
  const quantidade = Math.min(
    Math.max(Math.floor(options.quantidade ?? PAGE_SIZE_MAX), 1),
    SEARCH_MAX_RESULTS,
  );
  const qualificada = options.qualificada ?? false;
  const sku: Sku = qualificada ? "textSearchEnterprise" : "textSearch";

  const places: PlaceBasico[] = [];
  let paginas = 0;
  let aviso: string | undefined;
  let pageToken: string | undefined;

  while (places.length < quantidade) {
    try {
      await reserveQuota(db, sku, caps);
    } catch (error) {
      // 1ª página: nada foi consumido, o erro sobe (rota → 429).
      if (paginas === 0 || !(error instanceof QuotaExceededError)) throw error;
      aviso = `teto mensal de "${sku}" atingido após ${paginas} página(s)`;
      break;
    }

    const res = await fetch(`${BASE_URL}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELD_MASKS[sku],
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "pt-BR",
        pageSize: Math.min(quantidade - places.length, PAGE_SIZE_MAX),
        ...(pageToken && { pageToken }),
      }),
    });
    if (!res.ok) {
      const detail = await errorDetail(res);
      if (paginas === 0) throw new PlacesError(res.status, detail);
      aviso = `Google falhou na página ${paginas + 1}: ${detail.slice(0, 200)}`;
      break;
    }

    paginas += 1;
    const data = (await res.json()) as { places?: GooglePlace[]; nextPageToken?: string };
    for (const raw of data.places ?? []) {
      const place = toPlaceBasico(raw, qualificada);
      if (place) places.push(place);
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return { places: places.slice(0, quantidade), paginas, aviso };
}

/** Place Details (New) com o field mask Enterprise, SKU detailsEnterprise. */
export async function placeDetails(
  db: UsageDb,
  placeId: string,
  caps: UsageCounts,
): Promise<DetalhesLugar> {
  const key = apiKey();
  await reserveQuota(db, "detailsEnterprise", caps);

  const url = `${BASE_URL}/places/${encodeURIComponent(placeId)}?languageCode=pt-BR`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELD_MASKS.detailsEnterprise,
    },
  });
  if (!res.ok) {
    throw new PlacesError(res.status, await errorDetail(res));
  }

  const place = (await res.json()) as GooglePlace;
  return {
    telefone: place.nationalPhoneNumber,
    telefoneIntl: place.internationalPhoneNumber,
    site: place.websiteUri,
    rating: place.rating,
    totalAvaliacoes: place.userRatingCount,
  };
}
