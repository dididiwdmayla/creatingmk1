import { FIELD_MASKS, reserveQuota, type UsageCounts } from "@/lib/costs";
import type { UsageDb } from "@/lib/firestore-like";

/**
 * Cliente da Google Places API (New). Único ponto do app que fala com o
 * Google: toda chamada passa por reserveQuota() ANTES do fetch (se o Google
 * falhar depois, o contador fica 1 acima do real — o lado seguro do erro) e
 * usa exclusivamente os field masks de skus.ts, amarrados ao SKU contado.
 */

const BASE_URL = "https://places.googleapis.com/v1";

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
}

export interface DetalhesLugar {
  telefone?: string;
  telefoneIntl?: string;
  site?: string;
  rating?: number;
  totalAvaliacoes?: number;
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

/**
 * Text Search (New), SKU textSearch. Busca SÓ a 1ª página (até 20
 * resultados) — cada página seria uma request cobrada.
 */
export async function searchText(
  db: UsageDb,
  textQuery: string,
  caps: UsageCounts,
): Promise<PlaceBasico[]> {
  const key = apiKey();
  await reserveQuota(db, "textSearch", caps);

  const res = await fetch(`${BASE_URL}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELD_MASKS.textSearch,
    },
    body: JSON.stringify({ textQuery, languageCode: "pt-BR", pageSize: 20 }),
  });
  if (!res.ok) {
    throw new PlacesError(res.status, await errorDetail(res));
  }

  const data = (await res.json()) as { places?: GooglePlace[] };
  const places: PlaceBasico[] = [];
  for (const place of data.places ?? []) {
    if (!place.id) continue; // sem Place ID não vira doc em /leads
    places.push({
      placeId: place.id,
      nome: place.displayName?.text ?? "(sem nome)",
      endereco: place.formattedAddress,
      location:
        place.location?.latitude !== undefined &&
        place.location?.longitude !== undefined
          ? { lat: place.location.latitude, lng: place.location.longitude }
          : undefined,
    });
  }
  return places;
}

/** Place Details (New) com o field mask Pro, SKU detailsPro. */
export async function placeDetails(
  db: UsageDb,
  placeId: string,
  caps: UsageCounts,
): Promise<DetalhesLugar> {
  const key = apiKey();
  await reserveQuota(db, "detailsPro", caps);

  const url = `${BASE_URL}/places/${encodeURIComponent(placeId)}?languageCode=pt-BR`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELD_MASKS.detailsPro,
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
