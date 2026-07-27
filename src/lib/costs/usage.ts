import { QuotaExceededError } from "./errors";
import type { UsageDb, UsageDocSnapshot } from "../firestore-like";
import type { LimitesUsuario } from "../usuarios/types";
import { periodKey } from "./period";
import {
  DEFAULT_CAPS,
  LEGACY_SKU_ALIASES,
  SKUS,
  ZERO_USAGE,
  type Sku,
  type UsageCounts,
} from "./skus";
import { checarCotaUsuario, type TipoCotaUsuario } from "./userQuota";

export const USAGE_COLLECTION = "usage";

export interface UsageSnapshot {
  period: string;
  usage: UsageCounts;
  /** Quebra por usuário (requests por SKU). Docs antigos → objeto vazio. */
  porUsuario: Record<string, UsageCounts>;
}

/**
 * Contadores malformados (string, negativo, NaN) viram 0 — nunca quebrar
 * por dado sujo. Nomes legados de SKU (ex.: detailsPro) valem enquanto o
 * nome novo não existir no doc; assim que o novo é gravado, o legado é
 * ignorado.
 */
function readCounts(data: Record<string, unknown> | undefined): UsageCounts {
  const counts = { ...ZERO_USAGE };
  for (const sku of SKUS) {
    const legacy = LEGACY_SKU_ALIASES[sku];
    const value = data?.[sku] ?? (legacy ? data?.[legacy] : undefined);
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      counts[sku] = Math.floor(value);
    }
  }
  return counts;
}

/** Quebra por usuário no doc; entradas malformadas são ignoradas. */
function readPorUsuario(data: Record<string, unknown> | undefined): Record<string, UsageCounts> {
  const bruto = data?.porUsuario;
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return {};
  const porUsuario: Record<string, UsageCounts> = {};
  for (const [userId, counts] of Object.entries(bruto)) {
    if (typeof counts === "object" && counts !== null && !Array.isArray(counts)) {
      porUsuario[userId] = readCounts(counts as Record<string, unknown>);
    }
  }
  return porUsuario;
}

function snapshotData(snap: UsageDocSnapshot): Record<string, unknown> | undefined {
  return snap.exists ? snap.data() : undefined;
}

export interface ReserveQuotaOptions {
  /** Usuário logado (quebra porUsuario + dono da cota individual). */
  userId?: string;
  /**
   * Sessão admin: pula o teto GLOBAL mensal (mas o contador ainda
   * incrementa — dashboard/projeção continuam corretos) e nunca é
   * bloqueada por limite individual. A trava absoluta de fatura passa a
   * ser só a cota configurada no console do Google.
   */
  isAdmin?: boolean;
  /**
   * Presente só nas chamadas que contam para uma cota individual (busca
   * de leads, enriquecimento sob demanda). Ausente = só o teto global se
   * aplica (geocoding, IA, horário avulso).
   */
  userQuota?: { tipo: TipoCotaUsuario; limites: LimitesUsuario | undefined };
}

/**
 * Reserva 1 request do SKU no mês corrente, ou lança QuotaExceededError
 * (teto global) / UserQuotaExceededError (limite individual do usuário).
 *
 * Transacional: ler doc(s) → verificar teto(s) → incrementar. Chamar
 * SEMPRE antes do request ao Google — se o Google falhar depois, o
 * contador fica 1 acima do real, que é o lado seguro do erro. A reserva
 * global e a reserva individual (quando aplicável) são a MESMA transação
 * — ou as duas passam, ou nenhuma conta (duplo clique não gasta 2x nem
 * deixa as contagens dessincronizarem).
 *
 * `userId` (quando a rota identifica a sessão) incrementa também a quebra
 * `porUsuario` do doc global — o teto global continua sendo um só
 * (agregado), essa quebra é atribuição de uso, não cota individual.
 */
export async function reserveQuota(
  db: UsageDb,
  sku: Sku,
  caps: UsageCounts = DEFAULT_CAPS,
  now: Date = new Date(),
  opts: ReserveQuotaOptions = {},
): Promise<UsageSnapshot> {
  const { userId, isAdmin = false, userQuota } = opts;
  const period = periodKey(now);
  const ref = db.collection(USAGE_COLLECTION).doc(period);

  return db.runTransaction(async (tx) => {
    const data = snapshotData(await tx.get(ref));
    const usage = readCounts(data);
    const cap = Math.max(0, caps[sku]);
    if (!isAdmin && usage[sku] + 1 > cap) {
      throw new QuotaExceededError(sku, usage[sku], cap, period);
    }

    // Leitura(s) da cota individual ANTES de qualquer escrita (regra de
    // transação): lança UserQuotaExceededError sem gravar nada se estourar.
    const cotaUsuario =
      userQuota && !isAdmin && userId
        ? await checarCotaUsuario(tx, db, userId, userQuota.tipo, userQuota.limites, now)
        : undefined;

    const next = { ...usage, [sku]: usage[sku] + 1 };
    const porUsuario = readPorUsuario(data);
    if (userId) {
      const atual = porUsuario[userId] ?? { ...ZERO_USAGE };
      porUsuario[userId] = { ...atual, [sku]: atual[sku] + 1 };
    }
    tx.set(
      ref,
      { ...next, porUsuario, atualizadoEm: now.toISOString() },
      { merge: true },
    );
    if (cotaUsuario) {
      tx.set(
        cotaUsuario.ref,
        { ...cotaUsuario.proximo, atualizadoEm: now.toISOString() },
        { merge: true },
      );
    }
    return { period, usage: next, porUsuario };
  });
}

/** Uso do mês corrente (dashboard). Doc ausente = tudo zero. */
export async function getUsage(
  db: UsageDb,
  now: Date = new Date(),
): Promise<UsageSnapshot> {
  const period = periodKey(now);
  const snap = await db.collection(USAGE_COLLECTION).doc(period).get();
  const data = snapshotData(snap);
  return { period, usage: readCounts(data), porUsuario: readPorUsuario(data) };
}
