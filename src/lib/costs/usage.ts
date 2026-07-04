import { QuotaExceededError } from "./errors";
import type { UsageDb, UsageDocSnapshot } from "../firestore-like";
import { periodKey } from "./period";
import {
  DEFAULT_CAPS,
  LEGACY_SKU_ALIASES,
  SKUS,
  ZERO_USAGE,
  type Sku,
  type UsageCounts,
} from "./skus";

export const USAGE_COLLECTION = "usage";

export interface UsageSnapshot {
  period: string;
  usage: UsageCounts;
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

function countsFrom(snap: UsageDocSnapshot): UsageCounts {
  return readCounts(snap.exists ? snap.data() : undefined);
}

/**
 * Reserva 1 request do SKU no mês corrente, ou lança QuotaExceededError.
 *
 * Transacional: ler doc de uso → verificar teto → incrementar. Chamar SEMPRE
 * antes do request ao Google — se o Google falhar depois, o contador fica 1
 * acima do real, que é o lado seguro do erro.
 */
export async function reserveQuota(
  db: UsageDb,
  sku: Sku,
  caps: UsageCounts = DEFAULT_CAPS,
  now: Date = new Date(),
): Promise<UsageSnapshot> {
  const period = periodKey(now);
  const ref = db.collection(USAGE_COLLECTION).doc(period);

  return db.runTransaction(async (tx) => {
    const usage = countsFrom(await tx.get(ref));
    const cap = Math.max(0, caps[sku]);
    if (usage[sku] + 1 > cap) {
      throw new QuotaExceededError(sku, usage[sku], cap, period);
    }
    const next = { ...usage, [sku]: usage[sku] + 1 };
    tx.set(ref, { ...next, atualizadoEm: now.toISOString() }, { merge: true });
    return { period, usage: next };
  });
}

/** Uso do mês corrente (dashboard). Doc ausente = tudo zero. */
export async function getUsage(
  db: UsageDb,
  now: Date = new Date(),
): Promise<UsageSnapshot> {
  const period = periodKey(now);
  const snap = await db.collection(USAGE_COLLECTION).doc(period).get();
  return { period, usage: countsFrom(snap) };
}
