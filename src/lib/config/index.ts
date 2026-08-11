import {
  DEFAULT_CAPS,
  DEFAULT_PRICING,
  LEGACY_SKU_ALIASES,
  SKUS,
  type PricingTable,
  type Sku,
  type UsageCounts,
} from "@/lib/costs";
import { ANCORAS_PADRAO, validarAncoras } from "@/lib/demos/capturas/ancoras";
import { ValidationError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import {
  DEFAULT_JANELAS_CONTATO,
  mesclarJanelasContato,
  validarJanelasContato,
  type JanelasContatoConfig,
} from "@/lib/leads/janelaContato";
import {
  DEFAULT_PAISES_PROSPECCAO,
  validarPaisesProspeccao,
  type PaisesProspeccaoConfig,
} from "@/lib/prospeccao/paises";

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
  /** Calculadora de precificação regional (card "Precificação"). */
  precificacao: PrecificacaoConfig;
  /** Âncoras de captura por skin (tela /interno/capturas). */
  capturas: CapturasConfig;
  /**
   * Janelas recomendadas de contato por família de negócio (ficha do lead e
   * botão de WhatsApp) — ver `@/lib/leads/janelaContato`. Determinístico,
   * editável aqui sem deploy.
   */
  janelasContato: JanelasContatoConfig;
  /**
   * Países candidatos à prospecção (tela /mundo) — ver
   * `@/lib/prospeccao/paises`. Lista curta e editável aqui sem deploy.
   */
  paisesProspeccao: PaisesProspeccaoConfig;
}

export interface CapturasConfig {
  /**
   * skinId → até 3 ids de seção, na ordem em que as capturas saem.
   * A âncora aponta para uma SEÇÃO do contrato da skin, não para posição
   * em pixel — ver `lib/demos/capturas/ancoras.ts`. Vive aqui (e não em
   * código) justamente pra ser remarcável sem deploy.
   */
  ancoras: Record<string, string[]>;
}

/** Um atalho do slider (botão que reposiciona o preço-base). */
export interface PresetPrecificacao {
  nome: string;
  valorBRL: number;
}

export interface PrecificacaoConfig {
  /**
   * Multiplicador por nicho (chave-valor livre, chave = texto do nicho tal
   * como usado nas buscas). Nicho sem entrada correspondente → 1.0
   * (neutro) — ver `multiplicadorParaNicho` em src/lib/precificacao/calc.ts.
   */
  multiplicadoresNicho: Record<string, number>;
  /** Preço sugerido nunca fica abaixo deste piso (R$). */
  pisoPrecificacao: number;
  /**
   * Fator mínimo do índice efetivo: regiões baratas reduzem o preço em no
   * máximo (1 - fatorMinimoIndice); regiões caras (índice > 1) sobem sem
   * teto — ver `calcularIndiceEfetivo`.
   */
  fatorMinimoIndice: number;
  /** Atalhos editáveis que reposicionam o slider (700–10.000, passo 100). */
  presets: PresetPrecificacao[];
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
  precificacao: {
    multiplicadoresNicho: {},
    pisoPrecificacao: 900,
    fatorMinimoIndice: 0.7,
    presets: [
      { nome: "Vitrine", valorBRL: 1000 },
      { nome: "Presença", valorBRL: 2000 },
      { nome: "Autoridade", valorBRL: 3500 },
      { nome: "Sistema", valorBRL: 5000 },
    ],
  },
  capturas: { ancoras: structuredClone(ANCORAS_PADRAO) },
  janelasContato: structuredClone(DEFAULT_JANELAS_CONTATO),
  paisesProspeccao: structuredClone(DEFAULT_PAISES_PROSPECCAO),
};

const FILTRO_VALUES: FiltroPresenca[] = ["qualquer", "com", "sem"];
const PRESET_NOME_MAX = 30;
const TOP_LEVEL_KEYS = new Set([
  "nicho",
  "regiao",
  "filtros",
  "mensagemPadrao",
  "followUpDias",
  "maxBuscasRecorrentes",
  "caps",
  "precos",
  "precificacao",
  "capturas",
  "janelasContato",
  "paisesProspeccao",
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

  if (patch.precificacao !== undefined) {
    validatePrecificacaoPatch(patch.precificacao, problemas);
  }

  if (patch.capturas !== undefined) {
    if (!isRecord(patch.capturas)) {
      problemas.push("capturas deve ser um objeto");
    } else {
      for (const key of Object.keys(patch.capturas)) {
        if (key !== "ancoras") {
          problemas.push(`capturas.${key} não é um campo conhecido`);
        }
      }
      if (patch.capturas.ancoras !== undefined) {
        validarAncoras(patch.capturas.ancoras, "capturas.ancoras", problemas);
      }
    }
  }

  if (patch.janelasContato !== undefined) {
    validarJanelasContato(patch.janelasContato, "janelasContato", problemas);
  }

  if (patch.paisesProspeccao !== undefined) {
    validarPaisesProspeccao(patch.paisesProspeccao, "paisesProspeccao", problemas);
  }

  if (problemas.length > 0) {
    throw new ValidationError(problemas);
  }
}

function validatePrecificacaoPatch(value: unknown, problemas: string[]): void {
  if (!isRecord(value)) {
    problemas.push("precificacao deve ser um objeto");
    return;
  }
  for (const key of Object.keys(value)) {
    if (!["multiplicadoresNicho", "pisoPrecificacao", "fatorMinimoIndice", "presets"].includes(key)) {
      problemas.push(`precificacao.${key} não é um campo conhecido`);
    }
  }

  if (value.multiplicadoresNicho !== undefined) {
    if (!isRecord(value.multiplicadoresNicho)) {
      problemas.push("precificacao.multiplicadoresNicho deve ser um objeto nicho → multiplicador");
    } else {
      for (const [nicho, multiplicador] of Object.entries(value.multiplicadoresNicho)) {
        if (
          typeof multiplicador !== "number" ||
          !Number.isFinite(multiplicador) ||
          multiplicador <= 0
        ) {
          problemas.push(
            `precificacao.multiplicadoresNicho["${nicho}"] deve ser número > 0`,
          );
        }
      }
    }
  }

  if (
    value.pisoPrecificacao !== undefined &&
    (typeof value.pisoPrecificacao !== "number" ||
      !Number.isFinite(value.pisoPrecificacao) ||
      value.pisoPrecificacao < 0)
  ) {
    problemas.push("precificacao.pisoPrecificacao deve ser número ≥ 0");
  }

  if (
    value.fatorMinimoIndice !== undefined &&
    (typeof value.fatorMinimoIndice !== "number" ||
      !Number.isFinite(value.fatorMinimoIndice) ||
      value.fatorMinimoIndice <= 0)
  ) {
    problemas.push("precificacao.fatorMinimoIndice deve ser número > 0");
  }

  if (value.presets !== undefined) {
    if (!Array.isArray(value.presets)) {
      problemas.push("precificacao.presets deve ser uma lista");
    } else {
      value.presets.forEach((preset, i) => {
        if (!isRecord(preset)) {
          problemas.push(`precificacao.presets[${i}] deve ser um objeto`);
          return;
        }
        if (
          typeof preset.nome !== "string" ||
          !preset.nome.trim() ||
          preset.nome.length > PRESET_NOME_MAX
        ) {
          problemas.push(
            `precificacao.presets[${i}].nome deve ser string não vazia (≤${PRESET_NOME_MAX} caracteres)`,
          );
        }
        if (
          typeof preset.valorBRL !== "number" ||
          !Number.isFinite(preset.valorBRL) ||
          preset.valorBRL <= 0
        ) {
          problemas.push(`precificacao.presets[${i}].valorBRL deve ser número > 0`);
        }
      });
    }
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
    precificacao: {
      multiplicadoresNicho:
        patch.precificacao?.multiplicadoresNicho ?? base.precificacao.multiplicadoresNicho,
      pisoPrecificacao: patch.precificacao?.pisoPrecificacao ?? base.precificacao.pisoPrecificacao,
      fatorMinimoIndice:
        patch.precificacao?.fatorMinimoIndice ?? base.precificacao.fatorMinimoIndice,
      presets: patch.precificacao?.presets ?? base.precificacao.presets,
    },
    capturas: {
      // Merge POR SKIN, não substituição do mapa inteiro: a tela de
      // marcação salva a skin que o operador acabou de mexer, e as outras
      // 7 têm que continuar valendo o que já valia (default ou marcação
      // anterior). Uma lista VAZIA é uma marcação legítima — "não capturar
      // esta skin" —, por isso o merge é por chave presente, não por
      // truthiness.
      ancoras: { ...base.capturas.ancoras, ...patch.capturas?.ancoras },
    },
    // Merge POR FAMÍLIA, mesmo espírito de capturas.ancoras acima — a tela
    // salva a família que o admin acabou de editar, as outras continuam
    // valendo o que já valia (default ou edição anterior). Família em
    // formato antigo (a tabela de janela ideal/alternativa que a barra do
    // dia substituiu) é DESCARTADA em favor do padrão novo — ver
    // `mesclarJanelasContato`.
    janelasContato: mesclarJanelasContato(base.janelasContato, patch.janelasContato),
    // Substituição da lista INTEIRA (como `precificacao.presets`, e ao
    // contrário do merge por chave de ancoras/janelasContato): a tela edita
    // a lista como um todo, e sem substituir não haveria como REMOVER um
    // país — a entrada removida voltaria do default a cada save.
    paisesProspeccao: patch.paisesProspeccao ?? base.paisesProspeccao,
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
