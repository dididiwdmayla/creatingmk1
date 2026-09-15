import { ValidationError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";

/**
 * `/config/fila` — documento único com o estado que o celular (MacroDroid)
 * consulta antes de puxar o próximo lead da fila de envio. Doc PRÓPRIO,
 * fora de `/config/app` (ver `@/lib/config`): a fila é lida com muito mais
 * frequência (o celular bate a cada ciclo) e por um chamador totalmente
 * diferente (dispositivo, não sessão de usuário) — misturar no doc de app
 * acoplaria dois ritmos de escrita/leitura sem necessidade.
 */
export const FILA_CONFIG_COLLECTION = "config";
export const FILA_CONFIG_DOC = "fila";

export interface FilaConfig {
  /** Botão de pausa: false = o celular não recebe mais leads. */
  ativo: boolean;
  /** Teto de envios no dia operacional (ver `inicioDiaOperacionalHora`). */
  metaDiaria: number;
  /** Teto de envios na última hora corrida (janela deslizante). */
  tetoPorHora: number;
  /** Só libera lead cuja janela de contato atual é "boa" (ver janelaContato.ts). */
  exigirJanelaBoa: boolean;
  /** Nichos liberados para a fila. Vazio = todos. */
  nichosPermitidos: string[];
  /** Intervalo mínimo entre dois envios confirmados, em segundos. */
  intervaloMinimoSegundos: number;
  /**
   * Hora (0-23, America/Sao_Paulo) em que o "dia operacional" começa —
   * usada para fechar a chave de `filaContadores`. 0 = meia-noite (mesmo
   * comportamento do calendário normal).
   */
  inicioDiaOperacionalHora: number;
  /**
   * NÚMERO DE DESTINO DO DISPARO DE TESTE — dígitos puros com DDI.
   *
   * Toda tarefa de teste sai para ELE, e nunca para o telefone real do lead
   * escolhido. Isso vale inclusive quando o alvo é o lead fixo de teste: a
   * sobrescrita não é conveniência, é a REDE DE SEGURANÇA para quando o
   * operador escolhe um lead de verdade para ver onde ele para no pipeline
   * — sem ela, o diagnóstico mandaria prospecção para o negócio.
   *
   * Vazio = disparo de teste desligado; o botão recusa e diz por quê, em
   * vez de cair num destino padrão.
   */
  numeroTeste: string;
  /**
   * Quem mudou `ativo` da última vez: `"dispositivo"` (POST /api/fila/pausar,
   * a macro do celular) ou o `userId` do admin (PUT /api/config/fila). `null`
   * = nunca mudou desde que o doc existe. NÃO é patcheável direto — só as
   * duas rotas que de fato mudam `ativo` escrevem aqui, cada uma com sua
   * própria identidade (ver `lib/fila/pausar.ts` e `saveFilaConfig`).
   */
  ativoAlteradoPor: string | null;
  /** ISO de quando `ativoAlteradoPor` foi gravado. `null` junto com ele. */
  ativoAlteradoEm: string | null;
}

export const DEFAULT_FILA_CONFIG: FilaConfig = {
  ativo: true,
  metaDiaria: 15,
  tetoPorHora: 4,
  exigirJanelaBoa: true,
  nichosPermitidos: [],
  intervaloMinimoSegundos: 180,
  inicioDiaOperacionalHora: 0,
  numeroTeste: "5544984570105",
  ativoAlteradoPor: null,
  ativoAlteradoEm: null,
};

const TOP_LEVEL_KEYS = new Set<keyof FilaConfig>([
  "ativo",
  "metaDiaria",
  "tetoPorHora",
  "exigirJanelaBoa",
  "nichosPermitidos",
  "intervaloMinimoSegundos",
  "inicioDiaOperacionalHora",
  "numeroTeste",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validarInteiroNaoNegativo(value: unknown, campo: string, problemas: string[]): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    problemas.push(`${campo} deve ser inteiro ≥ 0`);
  }
}

/** Valida um patch parcial de `/config/fila` (corpo do PUT /api/config/fila). */
export function validateFilaConfigPatch(patch: unknown): asserts patch is Partial<FilaConfig> {
  const problemas: string[] = [];
  if (!isRecord(patch)) {
    throw new ValidationError(["corpo deve ser um objeto JSON"]);
  }

  for (const key of Object.keys(patch)) {
    if (!TOP_LEVEL_KEYS.has(key as keyof FilaConfig)) {
      problemas.push(`chave desconhecida: ${key}`);
    }
  }

  if (patch.ativo !== undefined && typeof patch.ativo !== "boolean") {
    problemas.push("ativo deve ser booleano");
  }
  if (patch.exigirJanelaBoa !== undefined && typeof patch.exigirJanelaBoa !== "boolean") {
    problemas.push("exigirJanelaBoa deve ser booleano");
  }

  if (patch.metaDiaria !== undefined) {
    validarInteiroNaoNegativo(patch.metaDiaria, "metaDiaria", problemas);
  }
  if (patch.tetoPorHora !== undefined) {
    validarInteiroNaoNegativo(patch.tetoPorHora, "tetoPorHora", problemas);
  }
  if (patch.intervaloMinimoSegundos !== undefined) {
    validarInteiroNaoNegativo(patch.intervaloMinimoSegundos, "intervaloMinimoSegundos", problemas);
  }

  if (patch.inicioDiaOperacionalHora !== undefined) {
    const v = patch.inicioDiaOperacionalHora;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 23) {
      problemas.push("inicioDiaOperacionalHora deve ser inteiro entre 0 e 23");
    }
  }

  if (patch.numeroTeste !== undefined) {
    // Dígitos puros com DDI, como `montarMensagemParaLead` já entrega para
    // o aparelho — nada de espaço, parêntese ou traço, que o WhatsApp do
    // celular não resolve. Vazio é válido: é o disparo de teste desligado.
    if (typeof patch.numeroTeste !== "string" || !/^(\d{10,15})?$/.test(patch.numeroTeste.trim())) {
      problemas.push("numeroTeste deve ser dígitos com DDI (10 a 15) ou vazio");
    }
  }

  if (patch.nichosPermitidos !== undefined) {
    if (
      !Array.isArray(patch.nichosPermitidos) ||
      !patch.nichosPermitidos.every((n) => typeof n === "string")
    ) {
      problemas.push("nichosPermitidos deve ser uma lista de strings");
    }
  }

  if (problemas.length > 0) {
    throw new ValidationError(problemas);
  }
}

/** Dígitos do `numeroTeste`, ou `undefined` quando não veio string nenhuma. */
function normalizarNumeroTeste(valor: unknown): string | undefined {
  return typeof valor === "string" ? valor.trim() : undefined;
}

/** Merge raso de um patch validado sobre uma config completa. */
export function mergeFilaConfig(base: FilaConfig, patch: Partial<FilaConfig>): FilaConfig {
  return {
    ativo: patch.ativo ?? base.ativo,
    metaDiaria: patch.metaDiaria ?? base.metaDiaria,
    tetoPorHora: patch.tetoPorHora ?? base.tetoPorHora,
    exigirJanelaBoa: patch.exigirJanelaBoa ?? base.exigirJanelaBoa,
    // Substituição da lista INTEIRA (como paisesProspeccao em lib/config):
    // sem isso não haveria como REMOVER um nicho liberado.
    nichosPermitidos: patch.nichosPermitidos ?? base.nichosPermitidos,
    intervaloMinimoSegundos: patch.intervaloMinimoSegundos ?? base.intervaloMinimoSegundos,
    inicioDiaOperacionalHora: patch.inicioDiaOperacionalHora ?? base.inicioDiaOperacionalHora,
    // `.trim()` só sobre string: `loadFilaConfig` faz este merge sobre o doc
    // CRU do Firestore, e um valor de tipo errado ali não pode derrubar
    // `/proximo` às duas da manhã.
    numeroTeste: normalizarNumeroTeste(patch.numeroTeste) ?? base.numeroTeste,
    // Passthrough normal, como o resto — `mergeFilaConfig` também é o motor
    // de `loadFilaConfig` (que chama isto com o doc CRU do Firestore como
    // "patch", para reidratar o que está persistido). `validateFilaConfigPatch`
    // é quem impede um PUT de admin de setar estes dois direto (fora de
    // `TOP_LEVEL_KEYS`) — só `saveFilaConfig` os recarimba, e só quando
    // `ativo` de fato muda.
    ativoAlteradoPor: patch.ativoAlteradoPor ?? base.ativoAlteradoPor,
    ativoAlteradoEm: patch.ativoAlteradoEm ?? base.ativoAlteradoEm,
  };
}

/**
 * Config efetiva: defaults + o que estiver persistido. Doc ausente NUNCA
 * pode virar erro nem liberar envio irrestrito — cai nos defaults (fila
 * ativa, mas com os tetos conservadores acima).
 */
export async function loadFilaConfig(db: AppDb): Promise<FilaConfig> {
  const snap = await db.collection(FILA_CONFIG_COLLECTION).doc(FILA_CONFIG_DOC).get();
  const stored = snap.exists ? snap.data() : undefined;
  if (!stored) return structuredClone(DEFAULT_FILA_CONFIG);
  return mergeFilaConfig(structuredClone(DEFAULT_FILA_CONFIG), stored as Partial<FilaConfig>);
}

/**
 * Valida o patch, aplica sobre a config efetiva e persiste o doc COMPLETO
 * (sem merge do Firestore — o merge é feito aqui, determinístico).
 *
 * `alteradoPor` é o `userId` do admin que chamou — vem de `PUT
 * /api/config/fila` (`requireAdmin`), nunca de sessão do próprio usuário
 * comum. Só é usado (e só re-carimba `ativoAlteradoPor`/`ativoAlteradoEm`)
 * quando o patch de fato MUDA `ativo`: um PUT que edita `metaDiaria` sem
 * tocar `ativo` não pode fazer parecer que o admin acabou de pausar/religar
 * a fila. Omitido = comportamento de sempre (campos de auditoria intocados),
 * o que mantém as chamadas existentes (inclusive as de teste) válidas.
 */
export async function saveFilaConfig(
  db: AppDb,
  patch: unknown,
  alteradoPor?: string,
): Promise<FilaConfig> {
  validateFilaConfigPatch(patch);
  const base = await loadFilaConfig(db);
  let merged = mergeFilaConfig(base, patch);
  if (alteradoPor && patch.ativo !== undefined && patch.ativo !== base.ativo) {
    merged = { ...merged, ativoAlteradoPor: alteradoPor, ativoAlteradoEm: new Date().toISOString() };
  }
  await db
    .collection(FILA_CONFIG_COLLECTION)
    .doc(FILA_CONFIG_DOC)
    .set({ ...merged, atualizadoEm: new Date().toISOString() });
  return merged;
}
