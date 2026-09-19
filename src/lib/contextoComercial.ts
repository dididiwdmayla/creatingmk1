import { ValidationError } from "@/lib/errors";
import type { AppDb } from "@/lib/firestore-like";

/**
 * `/config/contextoComercial` — documento único com o que a IA sabe sobre o
 * que o operador VENDE. Sem isto o rascunho de resposta (`lib/fila/
 * rascunhoResposta.ts`) só tinha o índice de preço regional e a demo do
 * lead: nenhum dos dois diz o que está incluso, prazo de entrega ou
 * condição de pagamento — o rascunho saía educado e vazio, ou inventava.
 *
 * TEXTO LIVRE, de propósito: as perguntas de um lead não são previsíveis
 * ("tem manutenção?", "faz e-commerce?", "quanto tempo demora?"), e o
 * operador precisa poder acrescentar uma linha nova a cada pergunta nova
 * sem esperar deploy. Modelar como formulário (campos fixos de preço/prazo/
 * escopo) obrigaria a prever toda pergunta com antecedência — exatamente o
 * que este documento existe para não fazer. Mesma escolha de doc único e
 * texto livre de `capturas.ancoras`/`multiplicadoresNicho`, aplicada a um
 * campo só.
 *
 * Doc PRÓPRIO, fora de `/config/app`: nasce com um campo e cresce por
 * decisão de quem escreve nele, não por acoplamento ao resto da config
 * geral — mesmo motivo de `/config/fila` ter documento à parte.
 */
export const CONTEXTO_COMERCIAL_COLLECTION = "config";
export const CONTEXTO_COMERCIAL_DOC = "contextoComercial";

export interface ContextoComercial {
  /** Texto livre — o que o negócio vende, como funciona, preços e prazos que o operador declarou. */
  texto: string;
}

export const DEFAULT_CONTEXTO_COMERCIAL: ContextoComercial = { texto: "" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Valida um patch parcial de `/config/contextoComercial` (corpo do PUT). */
export function validateContextoComercialPatch(
  patch: unknown,
): asserts patch is Partial<ContextoComercial> {
  if (!isRecord(patch)) {
    throw new ValidationError(["corpo deve ser um objeto JSON"]);
  }
  const problemas: string[] = [];
  for (const key of Object.keys(patch)) {
    if (key !== "texto") problemas.push(`chave desconhecida: ${key}`);
  }
  if (patch.texto !== undefined && typeof patch.texto !== "string") {
    problemas.push("texto deve ser string");
  }
  if (problemas.length > 0) {
    throw new ValidationError(problemas);
  }
}

/**
 * Config efetiva: default (vazio) + o que estiver persistido. Doc ausente
 * nunca é erro — é literalmente o estado inicial (operador ainda não
 * preencheu), e é esse vazio que faz o rascunho pedir preenchimento em vez
 * de inventar (ver `lib/fila/rascunhoResposta.ts`).
 */
export async function loadContextoComercial(db: AppDb): Promise<ContextoComercial> {
  const snap = await db.collection(CONTEXTO_COMERCIAL_COLLECTION).doc(CONTEXTO_COMERCIAL_DOC).get();
  const stored = snap.exists ? snap.data() : undefined;
  const texto = typeof stored?.texto === "string" ? stored.texto : DEFAULT_CONTEXTO_COMERCIAL.texto;
  return { texto };
}

/** Valida o patch, aplica sobre o efetivo e persiste o doc completo. */
export async function saveContextoComercial(db: AppDb, patch: unknown): Promise<ContextoComercial> {
  validateContextoComercialPatch(patch);
  const atual = await loadContextoComercial(db);
  const proximo: ContextoComercial = {
    texto: patch.texto !== undefined ? patch.texto.trim() : atual.texto,
  };
  await db
    .collection(CONTEXTO_COMERCIAL_COLLECTION)
    .doc(CONTEXTO_COMERCIAL_DOC)
    .set({ ...proximo, atualizadoEm: new Date().toISOString() });
  return proximo;
}
