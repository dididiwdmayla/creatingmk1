import {
  DEFAULT_CAPS,
  DEFAULT_PRICING,
  LEGACY_SKU_ALIASES,
  SKUS,
  type PricingTable,
  type Sku,
  type UsageCounts,
} from "@/lib/costs";
import { ValidationError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";

export const CONFIG_COLLECTION = "config";
export const CONFIG_DOC = "app";

export type FiltroPresenca = "qualquer" | "com" | "sem";

export interface AppConfig {
  nicho: string;
  regiao: string;
  filtros: { temSite: FiltroPresenca; temTelefone: FiltroPresenca };
  mensagemPadrao: string;
  /**
   * Fila do dia (/hoje): lead "contactado" sem resposta há mais deste
   * número de dias vira follow-up. Inteiro ≥ 1.
   */
  followUpDias: number;
  /**
   * Teto de buscas recorrentes simultâneas (cron diário). O toggle
   * "recorrente" recusa passar do teto; o cron também recorta a fila.
   * Inteiro ≥ 0 (0 desliga a recorrência por completo).
   */
  maxBuscasRecorrentes: number;
  caps: UsageCounts;
  precos: {
    usdPor1000: Record<Sku, number>;
    cotaGratis: Record<Sku, number>;
    usdBrl: number;
  };
}

function perSku(pick: (sku: Sku) => number): Record<Sku, number> {
  return Object.fromEntries(SKUS.map((sku) => [sku, pick(sku)])) as Record<
    Sku,
    number
  >;
}

export const DEFAULT_CONFIG: AppConfig = {
  nicho: "",
  regiao: "",
  filtros: { temSite: "qualquer", temTelefone: "qualquer" },
  mensagemPadrao:
    "Oi {nome}, tudo bem? Sou web designer e ajudo negócios locais a " +
    "aparecerem melhor no Google. Posso te mostrar uma ideia rápida?",
  followUpDias: 4,
  maxBuscasRecorrentes: 3,
  caps: { ...DEFAULT_CAPS },
  precos: {
    usdPor1000: perSku((sku) => DEFAULT_PRICING[sku].usdPer1000),
    cotaGratis: perSku((sku) => DEFAULT_PRICING[sku].freeQuota),
    usdBrl: 5.5,
  },
};

const FILTRO_VALUES: FiltroPresenca[] = ["qualquer", "com", "sem"];
const TOP_LEVEL_KEYS = new Set([
  "nicho",
  "regiao",
  "filtros",
  "mensagemPadrao",
  "followUpDias",
  "maxBuscasRecorrentes",
  "caps",
  "precos",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateSkuMap(
  value: unknown,
  path: string,
  problemas: string[],
  { integer }: { integer: boolean },
): void {
  if (!isRecord(value)) {
    problemas.push(`${path} deve ser um objeto com os SKUs`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (!(SKUS as readonly string[]).includes(key)) {
      problemas.push(`${path}.${key} não é um SKU conhecido (${SKUS.join(", ")})`);
    }
  }
  for (const sku of SKUS) {
    const v = value[sku];
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      problemas.push(`${path}.${sku} deve ser número ≥ 0`);
    } else if (integer && !Number.isInteger(v)) {
      problemas.push(`${path}.${sku} deve ser inteiro`);
    }
  }
}

/**
 * Valida um patch parcial de config (corpo do PUT /api/config).
 * Chaves desconhecidas são rejeitadas para pegar typos ("cap" vs "caps").
 */
export function validateConfigPatch(patch: unknown): asserts patch is Partial<AppConfig> {
  const problemas: string[] = [];
  if (!isRecord(patch)) {
    throw new ValidationError(["corpo deve ser um objeto JSON"]);
  }

  for (const key of Object.keys(patch)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      problemas.push(`chave desconhecida: ${key}`);
    }
  }

  for (const key of ["nicho", "regiao", "mensagemPadrao"] as const) {
    if (patch[key] !== undefined && typeof patch[key] !== "string") {
      problemas.push(`${key} deve ser string`);
    }
  }

  if (patch.filtros !== undefined) {
    if (!isRecord(patch.filtros)) {
      problemas.push("filtros deve ser um objeto");
    } else {
      for (const key of Object.keys(patch.filtros)) {
        if (key !== "temSite" && key !== "temTelefone") {
          problemas.push(`filtros.${key} não é um filtro conhecido`);
        }
      }
      for (const key of ["temSite", "temTelefone"] as const) {
        const v = patch.filtros[key];
        if (v !== undefined && !FILTRO_VALUES.includes(v as FiltroPresenca)) {
          problemas.push(`filtros.${key} deve ser um de: ${FILTRO_VALUES.join(", ")}`);
        }
      }
    }
  }

  if (
    patch.followUpDias !== undefined &&
    (typeof patch.followUpDias !== "number" ||
      !Number.isInteger(patch.followUpDias) ||
      patch.followUpDias < 1)
  ) {
    problemas.push("followUpDias deve ser inteiro ≥ 1");
  }

  if (
    patch.maxBuscasRecorrentes !== undefined &&
    (typeof patch.maxBuscasRecorrentes !== "number" ||
      !Number.isInteger(patch.maxBuscasRecorrentes) ||
      patch.maxBuscasRecorrentes < 0)
  ) {
    problemas.push("maxBuscasRecorrentes deve ser inteiro ≥ 0");
  }

  if (patch.caps !== undefined) {
    validateSkuMap(patch.caps, "caps", problemas, { integer: true });
  }

  if (patch.precos !== undefined) {
    if (!isRecord(patch.precos)) {
      problemas.push("precos deve ser um objeto");
    } else {
      for (const key of Object.keys(patch.precos)) {
        if (!["usdPor1000", "cotaGratis", "usdBrl"].includes(key)) {
          problemas.push(`precos.${key} não é um campo conhecido`);
        }
      }
      if (patch.precos.usdPor1000 !== undefined) {
        validateSkuMap(patch.precos.usdPor1000, "precos.usdPor1000", problemas, {
          integer: false,
        });
      }
      if (patch.precos.cotaGratis !== undefined) {
        validateSkuMap(patch.precos.cotaGratis, "precos.cotaGratis", problemas, {
          integer: true,
        });
      }
      const usdBrl = patch.precos.usdBrl;
      if (
        usdBrl !== undefined &&
        (typeof usdBrl !== "number" || !Number.isFinite(usdBrl) || usdBrl <= 0)
      ) {
        problemas.push("precos.usdBrl deve ser número > 0");
      }
    }
  }

  if (problemas.length > 0) {
    throw new ValidationError(problemas);
  }
}

/**
 * Merge por SKU conhecido: além do merge, sanitiza — chaves legadas
 * (ex.: detailsPro) migram via alias na leitura e nunca voltam a ser
 * gravadas com o nome antigo.
 */
function mergeSkuMap(
  base: Record<Sku, number>,
  patch: Partial<Record<string, number>> | undefined,
): Record<Sku, number> {
  return Object.fromEntries(
    SKUS.map((sku) => {
      const legacy = LEGACY_SKU_ALIASES[sku];
      const value = patch?.[sku] ?? (legacy ? patch?.[legacy] : undefined) ?? base[sku];
      return [sku, value];
    }),
  ) as Record<Sku, number>;
}

/** Merge profundo de um patch validado sobre uma config completa. */
export function mergeConfig(base: AppConfig, patch: Partial<AppConfig>): AppConfig {
  return {
    nicho: patch.nicho ?? base.nicho,
    regiao: patch.regiao ?? base.regiao,
    mensagemPadrao: patch.mensagemPadrao ?? base.mensagemPadrao,
    followUpDias: patch.followUpDias ?? base.followUpDias,
    maxBuscasRecorrentes: patch.maxBuscasRecorrentes ?? base.maxBuscasRecorrentes,
    filtros: { ...base.filtros, ...patch.filtros },
    caps: mergeSkuMap(base.caps, patch.caps),
    precos: {
      usdBrl: patch.precos?.usdBrl ?? base.precos.usdBrl,
      usdPor1000: mergeSkuMap(base.precos.usdPor1000, patch.precos?.usdPor1000),
      cotaGratis: mergeSkuMap(base.precos.cotaGratis, patch.precos?.cotaGratis),
    },
  };
}

/**
 * Config efetiva: defaults + o que estiver persistido em /config/app.
 * Docs antigos/parciais são tolerados — campos ausentes caem no default.
 */
export async function loadConfig(db: AppDb): Promise<AppConfig> {
  const snap = await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).get();
  const stored = snap.exists ? snap.data() : undefined;
  if (!stored) return structuredClone(DEFAULT_CONFIG);
  return mergeConfig(structuredClone(DEFAULT_CONFIG), stored as Partial<AppConfig>);
}

/**
 * Valida o patch, aplica sobre a config efetiva e persiste o doc COMPLETO
 * (sem merge do Firestore — o merge profundo é feito aqui, determinístico).
 */
export async function saveConfig(db: AppDb, patch: unknown): Promise<AppConfig> {
  validateConfigPatch(patch);
  const merged = mergeConfig(await loadConfig(db), patch);
  const doc: Record<string, unknown> = {
    ...merged,
    atualizadoEm: new Date().toISOString(),
  };
  await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).set(doc);
  return merged;
}

/** Tabela de preços do módulo de custos a partir da config efetiva. */
export function pricingFromConfig(config: AppConfig): PricingTable {
  return Object.fromEntries(
    SKUS.map((sku) => [
      sku,
      {
        usdPer1000: config.precos.usdPor1000[sku],
        freeQuota: config.precos.cotaGratis[sku],
      },
    ]),
  ) as PricingTable;
}
