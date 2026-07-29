import { AiError, gerarJson } from "@/lib/ai/gemini";
import { reserveQuota, type UsageCounts } from "@/lib/costs";
import type { UsageDb } from "@/lib/firestore-like";
import { idiomaLabel } from "@/lib/geo/geocode";

/**
 * Tradução de um termo de nicho para o idioma-alvo via Gemini (SKU
 * aiGeneration, UMA chamada — mesmo espírito de gerarIndiceRegiao/
 * gerarAnaliseBusca: sem retry, resposta fora do schema já é AiError). O
 * resultado é cacheado PERMANENTEMENTE pelo chamador (ver ./repo); esta
 * função só GERA.
 */

const TERMO_MAX = 60;

const CHAVES_TERMO = ["termo"] as const;

export function schemaTermoLocal(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: [...CHAVES_TERMO],
    properties: {
      termo: {
        type: "string",
        maxLength: TERMO_MAX,
        description:
          "Termo de busca curto (sem explicações), pronto pra usar num campo de nicho de busca local.",
      },
    },
  };
}

export function montarPromptTermoLocal(nicho: string, idioma: string): string {
  return [
    "Você ajuda um web designer freelancer brasileiro a prospectar negócios locais em outros países.",
    `Traduza o termo de nicho de negócio abaixo para ${idiomaLabel(idioma)}, da forma como um morador `,
    "local pesquisaria esse tipo de negócio no Google/Google Maps (termo de busca curto, sem explicações, ",
    "sem aspas, sem tradução literal palavra-por-palavra se não fizer sentido — use o termo natural).",
    "",
    `Nicho original (português): "${nicho}"`,
    "",
    `Responda APENAS o JSON pedido: "termo" com até ${TERMO_MAX} caracteres, no idioma-alvo.`,
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textoCurto(value: unknown, max: number): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim().slice(0, max);
}

/**
 * Validação estrita da resposta do Gemini. Sem retry (chamador decide se
 * tenta de novo) — mesma postura de validarAnaliseBusca/validarIndiceRegiao.
 */
export function validarTermoLocal(
  bruto: unknown,
): { termo: string; problemas: [] } | { termo?: undefined; problemas: string[] } {
  const problemas: string[] = [];
  if (!isRecord(bruto)) {
    return { problemas: ["resposta deve ser um objeto JSON"] };
  }

  for (const chave of Object.keys(bruto)) {
    if (!(CHAVES_TERMO as readonly string[]).includes(chave)) {
      problemas.push(`chave desconhecida: ${chave}`);
    }
  }

  const termo = textoCurto(bruto.termo, TERMO_MAX);
  if (!termo) problemas.push("termo deve ser string não vazia");

  if (problemas.length > 0) return { problemas };
  return { termo: termo as string, problemas: [] };
}

/**
 * Gera a tradução: UMA reserva de cota + UMA chamada ao Gemini, sem retry.
 * Resposta fora do schema → AiError (502) direto — o chamador (rota) não
 * insiste; o cache (ver ./repo) garante que o próximo pedido do MESMO par
 * nicho+idioma tenta de novo (nada fica preso num resultado ruim).
 */
export async function gerarTermoLocal(
  db: UsageDb,
  nicho: string,
  idioma: string,
  caps: UsageCounts,
  ctx: { userId?: string; isAdmin?: boolean } = {},
): Promise<string> {
  const prompt = montarPromptTermoLocal(nicho, idioma);
  await reserveQuota(db, "aiGeneration", caps, undefined, ctx);
  const resultado = validarTermoLocal(await gerarJson(prompt, schemaTermoLocal()));
  if (resultado.termo) return resultado.termo;
  throw new AiError(`resposta fora do schema: ${resultado.problemas.join("; ")}`);
}
