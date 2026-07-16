import { QuotaExceededError, reserveQuota, FIELD_MASKS, type Sku, type UsageCounts } from "@/lib/costs";
import type { UsageDb } from "@/lib/firestore-like";
import { isSiteProprio } from "@/lib/site-proprio";

/**
 * Cliente da Google Places API (New). Único ponto do app que fala com o
 * endpoint places.googleapis.com: toda chamada passa por reserveQuota()
 * ANTES do fetch (se o Google falhar depois, o contador fica 1 acima do
 * real — o lado seguro do erro) e usa exclusivamente os field masks de
 * skus.ts, amarrados ao SKU contado.
 */

const BASE_URL = "https://places.googleapis.com/v1";

/** Página máxima do Text Search (New). */
const PAGE_SIZE_MAX = 20;
/** Máximo de resultados que o usuário pode pedir por busca. */
export const SEARCH_MAX_RESULTS = 40;
/** O Text Search (New) devolve no máximo 60 resultados = 3 páginas. */
export const SEARCH_MAX_PAGES = 3;

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

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Retângulo (viewport) usado no locationRestriction do Text Search. */
export interface LatLngRect {
  low: LatLng;
  high: LatLng;
}

export interface PlaceBasico {
  placeId: string;
  nome: string;
  endereco?: string;
  location?: { lat: number; lng: number };
  /** Só na busca qualificada: site/telefones vieram de graça no Text Search. */
  temSite?: boolean;
  siteUrl?: string;
  /** true = site próprio; false = sem URL ou URL de rede social/agregador. */
  siteProprio?: boolean;
  temTelefone?: boolean;
  telefone?: string;
  telefoneIntl?: string;
}

export interface DetalhesLugar {
  telefone?: string;
  telefoneIntl?: string;
  site?: string;
  rating?: number;
  totalAvaliacoes?: number;
}

export interface SearchTextOptions {
  /** Leads NOVOS desejados (1–40). Pagina até juntar, cada página = 1 request. */
  quantidade?: number;
  /** Busca qualificada: mask com websiteUri/telefones → SKU textSearchEnterprise. */
  qualificada?: boolean;
  /**
   * Só com qualificada: descarta (não entra em `places`, não conta pra
   * `novos`) todo resultado sem nationalPhoneNumber/internationalPhoneNumber.
   * Pagina até juntar `quantidade` leads NOVOS com telefone, respeitando a
   * mesma cota-por-página e o limite de 3 páginas do Google.
   */
  soComTelefone?: boolean;
  /** Localização dura: retângulo (viewport geocodificado) da região. */
  locationRestriction?: LatLngRect;
  /**
   * Diz se o placeId é inédito na base. Só inéditos contam para a
   * quantidade pedida ("20 = 20 novos"); sem o predicado, todo resultado
   * conta. Os já existentes continuam no retorno (o upsert anexa a busca).
   */
  isNovo?: (placeId: string) => Promise<boolean>;
}

export interface SearchTextResult {
  places: PlaceBasico[];
  /** Páginas efetivamente buscadas — cada uma consumiu 1 de cota. */
  paginas: number;
  /** Resultados inéditos segundo isNovo (sem o predicado, = places.length). */
  novos: number;
  /**
   * Presente só com `soComTelefone`: quantos resultados com telefone
   * sobraram depois do descarte (= places.length nesse modo).
   */
  validos?: number;
  /** Preenchido quando a busca parou antes da quantidade pedida (teto/erro/fim). */
  aviso?: string;
}

/** Chave da Google Maps Platform (Places + Geocoding), só em env var. */
export function requireApiKey(): string {
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
      // O mask pediu websiteUri, então a resposta é DEFINITIVA: sem URL =
      // temSite false, nunca "desconhecido". Instagram/WhatsApp/linktr.ee
      // não contam como site próprio — a URL fica guardada, mas o lead
      // segue quente (siteProprio false).
      temSite: Boolean(place.websiteUri),
      siteUrl: place.websiteUri || undefined,
      siteProprio: Boolean(place.websiteUri) && isSiteProprio(place.websiteUri ?? ""),
      temTelefone: Boolean(place.nationalPhoneNumber || place.internationalPhoneNumber),
      telefone: place.nationalPhoneNumber || undefined,
      telefoneIntl: place.internationalPhoneNumber || undefined,
    }),
  };
}

/**
 * Text Search (New). SKU textSearch (tier Pro) ou, na busca qualificada,
 * textSearchEnterprise. Pagina via nextPageToken até `quantidade`
 * resultados NOVOS (com isNovo; sem ele, resultados totais), reservando
 * cota ANTES de cada página, até o limite de 3 páginas do Google.
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
  const key = requireApiKey();
  const quantidade = Math.min(
    Math.max(Math.floor(options.quantidade ?? PAGE_SIZE_MAX), 1),
    SEARCH_MAX_RESULTS,
  );
  const qualificada = options.qualificada ?? false;
  const soComTelefone = options.soComTelefone ?? false;
  const sku: Sku = qualificada ? "textSearchEnterprise" : "textSearch";
  // pageSize constante entre as páginas: a API exige os mesmos parâmetros
  // (fora o pageToken) nas chamadas de continuação.
  const pageSize = Math.min(quantidade, PAGE_SIZE_MAX);

  const places: PlaceBasico[] = [];
  const vistos = new Set<string>();
  let novos = 0;
  let validos = 0;
  let paginas = 0;
  let aviso: string | undefined;
  let pageToken: string | undefined;

  while (paginas < SEARCH_MAX_PAGES) {
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
        pageSize,
        ...(options.locationRestriction && {
          locationRestriction: { rectangle: options.locationRestriction },
        }),
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
      if (!place || vistos.has(place.placeId)) continue;
      vistos.add(place.placeId);
      if (soComTelefone && !place.temTelefone) continue; // descarta sem telefone
      places.push(place);
      if (soComTelefone) validos += 1;
      if ((await options.isNovo?.(place.placeId)) ?? true) {
        novos += 1;
      }
    }

    pageToken = data.nextPageToken;
    if (novos >= quantidade || !pageToken) break;
  }

  if (!aviso && novos < quantidade) {
    aviso = pageToken
      ? `limite de ${SEARCH_MAX_PAGES} páginas do Google atingido: ${novos} novo(s)`
      : `resultados esgotados: ${novos} novo(s) em ${paginas} página(s)`;
  }

  return { places, paginas, novos, ...(soComTelefone && { validos }), aviso };
}

/** Place Details (New) com o field mask Enterprise, SKU detailsEnterprise. */
export async function placeDetails(
  db: UsageDb,
  placeId: string,
  caps: UsageCounts,
): Promise<DetalhesLugar> {
  const key = requireApiKey();
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
