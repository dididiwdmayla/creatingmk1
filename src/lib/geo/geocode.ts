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
  criadoEm: string;
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
  userId?: string,
): Promise<RegiaoGeo & { cached: boolean }> {
  const texto = regiao.trim();
  if (!texto) {
    throw new ValidationError(["regiao não pode ser vazia"]);
  }

  const ref = db.collection(GEOCACHE_COLLECTION).doc(regiaoCacheKey(texto));
  const snap = await ref.get();
  const cachedData = snap.exists ? snap.data() : undefined;
  if (cachedData) {
    return { ...asRegiaoGeo(cachedData), cached: true };
  }

  const key = requireApiKey();
  await reserveQuota(db, "geocoding", caps, undefined, userId);

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

  const resolvida: RegiaoGeo = {
    regiao: texto,
    endereco: primeiro.formatted_address ?? texto,
    location: { lat: location.lat, lng: location.lng },
    viewport: {
      low: { latitude: viewport.southwest.lat, longitude: viewport.southwest.lng },
      high: { latitude: viewport.northeast.lat, longitude: viewport.northeast.lng },
    },
    criadoEm: new Date().toISOString(),
  };
  await ref.set(resolvida as unknown as Record<string, unknown>);
  return { ...resolvida, cached: false };
}
