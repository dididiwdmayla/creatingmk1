import { custoIncrementalUSD, reserveQuota, FIELD_MASKS, type UsageCounts } from "@/lib/costs";
import type { AppConfig } from "@/lib/config";
import type { UsageDb } from "@/lib/firestore-like";
import type { LimitesUsuario } from "@/lib/usuarios/types";
import { PlacesError, requireApiKey } from "@/lib/places/client";

export const GOOGLE_MAPS_IMPORT_SKU = "textSearchEnterprise" as const;
export const GOOGLE_MAPS_IMPORT_CALLS = 1;

export interface ImportacaoMaps {
  placeId: string;
  nome: string;
  endereco?: string;
  cidade?: string;
  pais?: string;
  telefone?: string;
  whatsapp?: string;
  horarios?: string;
  instagram?: string;
}

interface SinalMaps {
  consulta: string;
  locationBias?: { circle: { center: { latitude: number; longitude: number }; radius: number } };
}

function hostGoogleMaps(hostname: string): boolean {
  return hostname === "maps.app.goo.gl" || hostname === "goo.gl" || hostname.endsWith(".google.com");
}

export function validarLinkMaps(valor: string): URL {
  let url: URL;
  try {
    url = new URL(valor.trim());
  } catch {
    throw new Error("Cole um link válido do Google Maps.");
  }
  if (url.protocol !== "https:" || !hostGoogleMaps(url.hostname.toLowerCase())) {
    throw new Error("Cole um link https do Google Maps (maps.app.goo.gl/…).");
  }
  return url;
}

export async function resolverLinkMaps(valor: string): Promise<URL> {
  let atual = validarLinkMaps(valor);
  for (let i = 0; i < 6; i += 1) {
    // URLs longas já contêm os sinais. Só os hosts encurtadores precisam
    // ser requisitados; não baixamos a página HTML final do Maps.
    if (atual.hostname.endsWith(".google.com")) return atual;
    const resposta = await fetch(atual, { method: "GET", redirect: "manual" });
    if (resposta.status < 300 || resposta.status >= 400) {
      if (!hostGoogleMaps(atual.hostname.toLowerCase())) throw new Error("O link saiu do Google Maps.");
      return atual;
    }
    const location = resposta.headers.get("location");
    if (!location) throw new Error("O link curto não informou seu destino.");
    atual = new URL(location, atual);
    if (atual.protocol !== "https:" || !hostGoogleMaps(atual.hostname.toLowerCase())) {
      throw new Error("O link curto não resolveu para o Google Maps.");
    }
  }
  throw new Error("O link curto excedeu o limite de redirecionamentos.");
}

export function sinaisDaUrlMaps(url: URL): SinalMaps {
  const place = url.pathname.match(/\/maps\/place\/([^/]+)/)?.[1];
  const query = url.searchParams.get("q") || url.searchParams.get("query");
  const consulta = decodeURIComponent((place || query || "").replace(/\+/g, " ")).trim();
  if (!consulta) throw new Error("Não foi possível identificar o estabelecimento nesse link.");
  const coords = `${url.pathname}${url.search}`.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  return {
    consulta,
    ...(coords && {
      locationBias: {
        circle: {
          center: { latitude: Number(coords[1]), longitude: Number(coords[2]) },
          radius: 500,
        },
      },
    }),
  };
}

interface GooglePlaceImportado {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: Array<{ longText?: string; types?: string[] }>;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
}

function componente(place: GooglePlaceImportado, tipo: string): string | undefined {
  return place.addressComponents?.find((item) => item.types?.includes(tipo))?.longText;
}

export function instagramDoSite(site?: string): string | undefined {
  if (!site) return undefined;
  try {
    const url = new URL(site);
    if (url.hostname !== "instagram.com" && url.hostname !== "www.instagram.com") return undefined;
    const usuario = url.pathname.split("/").filter(Boolean)[0];
    return usuario ? `@${usuario.replace(/^@/, "")}` : undefined;
  } catch {
    return undefined;
  }
}

export function normalizarPlaceImportado(place: GooglePlaceImportado): ImportacaoMaps {
  if (!place.id || !place.displayName?.text) {
    throw new Error("Estabelecimento não encontrado no Google Places.");
  }
  const telefone = place.nationalPhoneNumber || place.internationalPhoneNumber;
  return {
    placeId: place.id,
    nome: place.displayName.text,
    endereco: place.formattedAddress,
    cidade:
      componente(place, "locality") ||
      componente(place, "administrative_area_level_2") ||
      componente(place, "administrative_area_level_1"),
    pais: componente(place, "country"),
    telefone,
    whatsapp: place.internationalPhoneNumber || telefone,
    horarios: place.regularOpeningHours?.weekdayDescriptions?.join("\n"),
    instagram: instagramDoSite(place.websiteUri),
  };
}

export function cotacaoImportacaoMaps(config: AppConfig, usage: UsageCounts) {
  const preco = {
    usdPer1000: config.precos.usdPor1000[GOOGLE_MAPS_IMPORT_SKU],
    freeQuota: config.precos.cotaGratis[GOOGLE_MAPS_IMPORT_SKU],
  };
  const usd = custoIncrementalUSD(usage[GOOGLE_MAPS_IMPORT_SKU], GOOGLE_MAPS_IMPORT_CALLS, preco);
  return { chamadas: GOOGLE_MAPS_IMPORT_CALLS, sku: GOOGLE_MAPS_IMPORT_SKU, custo: { usd, brl: usd * config.precos.usdBrl } };
}

export async function importarDoGoogleMaps(
  db: UsageDb,
  link: string,
  caps: UsageCounts,
  usuario: { id: string; isAdmin: boolean; limites?: LimitesUsuario },
): Promise<ImportacaoMaps> {
  // Resolver redirects não usa Google Maps Platform e não tem SKU. A única
  // chamada paga começa abaixo, sempre depois da reserva atômica.
  const destino = await resolverLinkMaps(link);
  const sinais = sinaisDaUrlMaps(destino);
  await reserveQuota(db, GOOGLE_MAPS_IMPORT_SKU, caps, undefined, {
    userId: usuario.id,
    isAdmin: usuario.isAdmin,
    userQuota: { tipo: "enriquecimentos", limites: usuario.limites },
  });
  const resposta = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": requireApiKey(),
      "X-Goog-FieldMask": FIELD_MASKS[GOOGLE_MAPS_IMPORT_SKU],
    },
    body: JSON.stringify({ textQuery: sinais.consulta, languageCode: "pt-BR", pageSize: 1, ...sinais.locationBias }),
  });
  if (!resposta.ok) throw new PlacesError(resposta.status, (await resposta.text()).slice(0, 2000));
  const body = (await resposta.json()) as { places?: GooglePlaceImportado[] };
  return normalizarPlaceImportado(body.places?.[0] ?? {});
}
