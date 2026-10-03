import { ValidationError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";
import { CORTE_PADRAO, corteValido } from "@/lib/leads/semVestigio";

import { EXPIRACAO_MIN_HORAS, EXPIRACAO_PADRAO_HORAS } from "./painelTipos";

/**
 * `/config/automacao` — documento único da automação do estoque de leads
 * prontos (ver "Automação do estoque" em ARCHITECTURE.md). Doc PRÓPRIO,
 * mesmo motivo de `/config/fila`: quem lê é um chamador diferente (o
 * workflow do GitHub Actions, uma vez por noite) e ninguém mais precisa
 * carregar estes campos junto do `/config/app`.
 */
export const AUTOMACAO_CONFIG_COLLECTION = "config";
export const AUTOMACAO_CONFIG_DOC = "automacao";

export interface AutomacaoConfig {
  /**
   * Interruptor geral. Padrão FALSE: a automação gasta cota paga (busca e
   * IA) e cria demo em nome do time — ninguém descobre isso por acaso na
   * manhã seguinte. Desligada, o planejador registra a execução com o
   * motivo e não faz nada.
   */
  ativo: boolean;
  /**
   * Estoque desejado — prontos + a caminho (ver `lib/automacao/estoque.ts`).
   * Abaixo dele, a execução completa até ele; igual ou acima, nada a fazer.
   */
  alvoEstoque: number;
  /**
   * Demo automática nasce APROVADA quando passa no critério
   * (`passaCriterioAprovacaoAutomatica`); senão nasce pendente. Padrão
   * FALSE: toda demo automática espera o operador.
   */
  aprovacaoAutomatica: boolean;
  /**
   * Texto da demo por IA (`gerarSugestaoDemo`). Padrão TRUE, nunca
   * obrigatório: falhou ou desligada, a demo fica com o conteúdo de exemplo
   * da skin.
   */
  textoIA: boolean;
  /**
   * Data de corte do LEGADO ("YYYY-MM-DD", fuso de São Paulo). Lead criado
   * antes dela nunca entra na automação: sem vestígio não quer dizer sem
   * contato — antes de `registrosEnvio` existir, o contato à mão não deixava
   * rastro, e fazer demo para ele é mandar mensagem repetida.
   */
  corteLegado: string;
  /** Teto de REQUISIÇÕES de Text Search (páginas) por execução. */
  tetoBuscasNoite: number;
  /** Teto de CHAMADAS ao Gemini por execução (o retry conta). */
  tetoIANoite: number;
  /**
   * Par (nicho, região) que teve execução — de qualquer máquina, o cron da
   * Vercel incluso — nas últimas N horas não é buscado: as duas não pagam
   * pela mesma área na mesma madrugada.
   */
  intervaloParHoras: number;
  /** Janela da saturação: quantas execuções da automação olhar para trás. */
  saturacaoExecucoes: number;
  /**
   * Par cujas últimas `saturacaoExecucoes` execuções trouxeram, SOMADAS,
   * menos que isto de leads novos sai do rodízio de pares.
   */
  saturacaoMinNovos: number;
  /**
   * Prazo da demo automática NÃO ENVIADA, em horas a partir da criação:
   * vencida, a varredura da execução diária a apaga (ver
   * `lib/automacao/expiracao.ts` e `varredura.ts`). Mínimo
   * `EXPIRACAO_MIN_HORAS` — abaixo dele o PUT é 400 e o doc cai no padrão.
   */
  expiracaoDemoHoras: number;
}

export const DEFAULT_AUTOMACAO_CONFIG: AutomacaoConfig = {
  ativo: false,
  alvoEstoque: 15,
  aprovacaoAutomatica: false,
  textoIA: true,
  corteLegado: CORTE_PADRAO,
  tetoBuscasNoite: 6,
  tetoIANoite: 20,
  intervaloParHoras: 20,
  saturacaoExecucoes: 3,
  saturacaoMinNovos: 3,
  expiracaoDemoHoras: EXPIRACAO_PADRAO_HORAS,
};

const BOOLEANOS = ["ativo", "aprovacaoAutomatica", "textoIA"] as const;
const INTEIROS = [
  "alvoEstoque",
  "tetoBuscasNoite",
  "tetoIANoite",
  "intervaloParHoras",
  "saturacaoExecucoes",
  "saturacaoMinNovos",
  "expiracaoDemoHoras",
] as const;

const CHAVES = new Set<string>([...BOOLEANOS, ...INTEIROS, "corteLegado"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Valida um patch parcial (corpo do PUT /api/config/automacao). */
export function validateAutomacaoConfigPatch(
  patch: unknown,
): asserts patch is Partial<AutomacaoConfig> {
  if (!isRecord(patch)) throw new ValidationError(["corpo deve ser um objeto JSON"]);
  const problemas: string[] = [];
  for (const chave of Object.keys(patch)) {
    if (!CHAVES.has(chave)) problemas.push(`chave desconhecida: ${chave}`);
  }
  for (const campo of BOOLEANOS) {
    if (patch[campo] !== undefined && typeof patch[campo] !== "boolean") {
      problemas.push(`${campo} deve ser booleano`);
    }
  }
  for (const campo of INTEIROS) {
    const v = patch[campo];
    if (v !== undefined && (typeof v !== "number" || !Number.isInteger(v) || v < 0)) {
      problemas.push(`${campo} deve ser inteiro ≥ 0`);
    }
  }
  if (
    typeof patch.expiracaoDemoHoras === "number" &&
    Number.isInteger(patch.expiracaoDemoHoras) &&
    patch.expiracaoDemoHoras < EXPIRACAO_MIN_HORAS
  ) {
    problemas.push(`expiracaoDemoHoras deve ser ≥ ${EXPIRACAO_MIN_HORAS} (horas)`);
  }
  if (
    patch.corteLegado !== undefined &&
    (typeof patch.corteLegado !== "string" || !corteValido(patch.corteLegado))
  ) {
    problemas.push("corteLegado deve ser uma data YYYY-MM-DD");
  }
  if (problemas.length > 0) throw new ValidationError(problemas);
}

function booleano(valor: unknown, padrao: boolean): boolean {
  return typeof valor === "boolean" ? valor : padrao;
}

function inteiro(valor: unknown, padrao: number): number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 ? valor : padrao;
}

/**
 * Merge tolerante: também é o motor de `loadAutomacaoConfig`, que chama isto
 * com o doc CRU do Firestore — valor de tipo errado lá cai no padrão em vez
 * de derrubar a execução da madrugada.
 */
export function mergeAutomacaoConfig(
  base: AutomacaoConfig,
  patch: Partial<Record<keyof AutomacaoConfig, unknown>>,
): AutomacaoConfig {
  return {
    ativo: booleano(patch.ativo, base.ativo),
    alvoEstoque: inteiro(patch.alvoEstoque, base.alvoEstoque),
    aprovacaoAutomatica: booleano(patch.aprovacaoAutomatica, base.aprovacaoAutomatica),
    textoIA: booleano(patch.textoIA, base.textoIA),
    corteLegado:
      typeof patch.corteLegado === "string" && corteValido(patch.corteLegado)
        ? patch.corteLegado
        : base.corteLegado,
    tetoBuscasNoite: inteiro(patch.tetoBuscasNoite, base.tetoBuscasNoite),
    tetoIANoite: inteiro(patch.tetoIANoite, base.tetoIANoite),
    intervaloParHoras: inteiro(patch.intervaloParHoras, base.intervaloParHoras),
    saturacaoExecucoes: inteiro(patch.saturacaoExecucoes, base.saturacaoExecucoes),
    saturacaoMinNovos: inteiro(patch.saturacaoMinNovos, base.saturacaoMinNovos),
    // Abaixo do mínimo, gravado à mão no doc, cai no anterior: um prazo
    // curto demais apaga o que o operador ainda nem viu.
    expiracaoDemoHoras:
      inteiro(patch.expiracaoDemoHoras, base.expiracaoDemoHoras) >= EXPIRACAO_MIN_HORAS
        ? inteiro(patch.expiracaoDemoHoras, base.expiracaoDemoHoras)
        : base.expiracaoDemoHoras,
  };
}

function ref(db: AppDb) {
  return db.collection(AUTOMACAO_CONFIG_COLLECTION).doc(AUTOMACAO_CONFIG_DOC);
}

/** Config efetiva: defaults + o persistido. Doc ausente = defaults (desligada). */
export async function loadAutomacaoConfig(db: AppDb): Promise<AutomacaoConfig> {
  const snap = await ref(db).get();
  const stored = snap.exists ? snap.data() : undefined;
  if (!stored) return { ...DEFAULT_AUTOMACAO_CONFIG };
  return mergeAutomacaoConfig({ ...DEFAULT_AUTOMACAO_CONFIG }, stored);
}

/** Valida, aplica sobre a efetiva e grava o doc COMPLETO (sem merge do Firestore). */
export async function saveAutomacaoConfig(
  db: AppDb,
  patch: unknown,
  now: Date = new Date(),
): Promise<AutomacaoConfig> {
  validateAutomacaoConfigPatch(patch);
  const merged = mergeAutomacaoConfig(await loadAutomacaoConfig(db), patch);
  await ref(db).set({ ...merged, atualizadoEm: now.toISOString() });
  return merged;
}
