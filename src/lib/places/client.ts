import {
  QuotaExceededError,
  UserQuotaExceededError,
  reserveQuota,
  FIELD_MASKS,
  type Sku,
  type UsageCounts,
} from "@/lib/costs";
import type { UsageDb } from "@/lib/firestore-like";
import { isSiteProprio } from "@/lib/site-proprio";
import type { LimitesUsuario } from "@/lib/usuarios/types";

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

/**
 * Uma faixa de funcionamento, no formato bruto do Google (dia/hora/minuto
 * de abertura e fechamento, em hora LOCAL do lugar — 0=domingo…6=sábado).
 * `diaFecha`/`horaFecha`/`minFecha` podem cair no dia seguinte (faixa que
 * cruza a meia-noite) — é por isso que a faixa carrega os dois lados
 * completos em vez de só duração.
 */
export interface FaixaHorario {
  diaAbre: number;
  horaAbre: number;
  minAbre: number;
  diaFecha: number;
  horaFecha: number;
  minFecha: number;
}

export interface HorariosLugar {
  faixas: FaixaHorario[];
  /** Deslocamento UTC do lugar em minutos (Google utcOffsetMinutes). */
  utcOffsetMinutes?: number;
}

export interface SearchTextOptions {
  /** Leads NOVOS desejados (1–40). Pagina até juntar, cada página = 1 request. */
  quantidade?: number;
  /** Busca qualificada: mask com websiteUri/telefones → SKU textSearchEnterprise. */
  qualificada?: boolean;
  /**
   * "Só sem site": filtro pós-resposta que descarta (nem entra no
   * resultado) quem tem siteProprio true — implica qualificada (precisa do
   * mask com websiteUri para classificar). Continua paginando até juntar
   * `quantidade` leads que passem no filtro, ou os limites de sempre.
   */
  soSemSite?: boolean;
  /** Localização dura: retângulo (viewport geocodificado) da região. */
  locationRestriction?: LatLngRect;
  /**
   * Diz se o placeId é inédito na base. Só inéditos contam para a
   * quantidade pedida ("20 = 20 novos"); sem o predicado, todo resultado
   * conta. Os já existentes continuam no retorno (o upsert anexa a busca).
   */
  isNovo?: (placeId: string) => Promise<boolean>;
  /** Usuário logado — cada reserva de cota registra a quebra por usuário. */
  userId?: string;
  /** Sessão admin: ignora o teto global E a cota individual de "buscas". */
  isAdmin?: boolean;
  /** Limites individuais do dono da busca — cota "buscas" (dia/semana/mês). */
  limitesUsuario?: LimitesUsuario;
}

export interface SearchTextResult {
  places: PlaceBasico[];
  /** Páginas efetivamente buscadas — cada uma consumiu 1 de cota. */
  paginas: number;
  /** Resultados inéditos segundo isNovo (sem o predicado, = places.length). */
  novos: number;
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

interface GoogleHorarioPonto {
  day?: number;
  hour?: number;
  minute?: number;
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
  utcOffsetMinutes?: number;
  regularOpeningHours?: {
    periods?: Array<{ open?: GoogleHorarioPonto; close?: GoogleHorarioPonto }>;
  };
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
 *
 * Guarda "N = N": o `places` devolvido NUNCA passa de `quantidade`, mesmo
 * que a caçada por inéditos tenha varrido 3 páginas cheias de duplicados
 * (repetidos de buscas anteriores). Inéditos têm prioridade pelas vagas;
 * duplicados só preenchem o que sobrar — se os inéditos já fecham a
 * quantidade, nenhum duplicado entra (não ocupam vaga do N).
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
  const soSemSite = options.soSemSite ?? false;
  // "Só sem site" precisa classificar siteProprio pra filtrar → força o mask qualificado.
  const qualificada = (options.qualificada ?? false) || soSemSite;
  const sku: Sku = qualificada ? "textSearchEnterprise" : "textSearch";
  // pageSize constante entre as páginas: a API exige os mesmos parâmetros
  // (fora o pageToken) nas chamadas de continuação.
  const pageSize = Math.min(quantidade, PAGE_SIZE_MAX);

  const entradas: Array<{ place: PlaceBasico; novo: boolean }> = [];
  const vistos = new Set<string>();
  let novos = 0;
  let paginas = 0;
  let aviso: string | undefined;
  let pageToken: string | undefined;

  while (paginas < SEARCH_MAX_PAGES) {
    try {
      await reserveQuota(db, sku, caps, undefined, {
        userId: options.userId,
        isAdmin: options.isAdmin,
        userQuota: { tipo: "buscas", limites: options.limitesUsuario },
      });
    } catch (error) {
      const estourouCota =
        error instanceof QuotaExceededError || error instanceof UserQuotaExceededError;
      // 1ª página: nada foi consumido, o erro sobe (rota → 429).
      if (paginas === 0 || !estourouCota) throw error;
      aviso =
        error instanceof UserQuotaExceededError
          ? `limite individual de "${sku}" atingido após ${paginas} página(s)`
          : `teto mensal de "${sku}" atingido após ${paginas} página(s)`;
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
      // Filtro pós-resposta do "só sem site": quem tem site próprio nem
      // entra no resultado da busca qualificada (pode existir na base de
      // outra busca, mas não é resultado desta).
      if (soSemSite && place.siteProprio === true) continue;
      const novo = (await options.isNovo?.(place.placeId)) ?? true;
      if (novo) novos += 1;
      entradas.push({ place, novo });
    }

    pageToken = data.nextPageToken;
    if (novos >= quantidade || !pageToken) break;
  }

  if (!aviso && novos < quantidade) {
    aviso = pageToken
      ? `limite de ${SEARCH_MAX_PAGES} páginas do Google atingido: ${novos} novo(s)`
      : `resultados esgotados: ${novos} novo(s) em ${paginas} página(s)`;
  }

  // Inéditos primeiro (as vagas do N são deles); duplicados só preenchem
  // sobra. slice(0, quantidade) é a guarda dura: o resultado desta execução
  // nunca passa do N pedido, nem quando 3 páginas cheias de duplicados
  // foram varridas atrás dos inéditos.
  const places = [
    ...entradas.filter((e) => e.novo).map((e) => e.place),
    ...entradas.filter((e) => !e.novo).map((e) => e.place),
  ].slice(0, quantidade);

  return { places, paginas, novos, aviso };
}

export interface PlaceDetailsCtx {
  userId?: string;
  /** Sessão admin: ignora o teto global E a cota individual de "enriquecimentos". */
  isAdmin?: boolean;
  /**
   * Presente só quando esta chamada deve contar para a cota individual de
   * enriquecimentos — hoje, só o clique em "Enriquecer" (não o horário
   * avulso/embutido, que só reserva o SKU global).
   */
  limitesUsuario?: LimitesUsuario;
}

/** Place Details (New) com o field mask Enterprise, SKU detailsEnterprise. */
export async function placeDetails(
  db: UsageDb,
  placeId: string,
  caps: UsageCounts,
  ctx: PlaceDetailsCtx = {},
): Promise<DetalhesLugar> {
  const key = requireApiKey();
  await reserveQuota(db, "detailsEnterprise", caps, undefined, {
    userId: ctx.userId,
    isAdmin: ctx.isAdmin,
    userQuota: { tipo: "enriquecimentos", limites: ctx.limitesUsuario },
  });

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

/**
 * Normaliza os períodos brutos do Google em FaixaHorario[]. Um período sem
 * `close` (representação do Google para "aberto 24h" a partir dali) vira
 * uma faixa de 24h cheias a partir da abertura.
 */
function toFaixas(
  periods: Array<{ open?: GoogleHorarioPonto; close?: GoogleHorarioPonto }> | undefined,
): FaixaHorario[] {
  const faixas: FaixaHorario[] = [];
  for (const periodo of periods ?? []) {
    if (periodo?.open?.day === undefined) continue;
    const diaAbre = periodo.open.day;
    const horaAbre = periodo.open.hour ?? 0;
    const minAbre = periodo.open.minute ?? 0;
    if (periodo.close?.day !== undefined) {
      faixas.push({
        diaAbre,
        horaAbre,
        minAbre,
        diaFecha: periodo.close.day,
        horaFecha: periodo.close.hour ?? 0,
        minFecha: periodo.close.minute ?? 0,
      });
    } else {
      const fechaTotal = diaAbre * 1440 + horaAbre * 60 + minAbre + 1440;
      faixas.push({
        diaAbre,
        horaAbre,
        minAbre,
        diaFecha: Math.floor(fechaTotal / 1440) % 7,
        horaFecha: Math.floor((fechaTotal % 1440) / 60),
        minFecha: fechaTotal % 60,
      });
    }
  }
  return faixas;
}

/**
 * Horário de funcionamento (New) com o field mask Pro, SKU detailsProHours
 * — contador PRÓPRIO, separado do enriquecimento Enterprise (placeDetails).
 * Chamado JUNTO do enriquecimento (2 requests distintos) ou sozinho pelo
 * botão "buscar horários" de leads já enriquecidos. NUNCA conta para a cota
 * individual de "enriquecimentos" (decisão de produto) — só o teto GLOBAL
 * do SKU se aplica, com o mesmo bypass de admin dos demais.
 */
export async function placeHours(
  db: UsageDb,
  placeId: string,
  caps: UsageCounts,
  ctx: { userId?: string; isAdmin?: boolean } = {},
): Promise<HorariosLugar> {
  const key = requireApiKey();
  await reserveQuota(db, "detailsProHours", caps, undefined, {
    userId: ctx.userId,
    isAdmin: ctx.isAdmin,
  });

  const url = `${BASE_URL}/places/${encodeURIComponent(placeId)}?languageCode=pt-BR`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELD_MASKS.detailsProHours,
    },
  });
  if (!res.ok) {
    throw new PlacesError(res.status, await errorDetail(res));
  }

  const place = (await res.json()) as GooglePlace;
  return {
    faixas: toFaixas(place.regularOpeningHours?.periods),
    utcOffsetMinutes: place.utcOffsetMinutes,
  };
}
