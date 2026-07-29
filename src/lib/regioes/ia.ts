import { AiError, gerarJson } from "@/lib/ai/gemini";
import { reserveQuota, type UsageCounts } from "@/lib/costs";
import type { UsageDb } from "@/lib/firestore-like";
import { CONFIANCAS, type Confianca } from "./types";

/**
 * Geração do índice de mercado de uma cidade específica via Gemini (SKU
 * aiGeneration, UMA chamada — mesmo espírito de gerarAnaliseBusca: sem
 * retry, resposta fora do schema já é AiError). O resultado é cacheado
 * PERMANENTEMENTE pelo chamador (ver ./repo); esta função só GERA.
 */

const MOEDA_MAX = 10;
const FAIXA_MAX = 80;
const JUSTIFICATIVA_MAX = 400;

export interface IndiceGerado {
  indice: number;
  moedaLocal: string;
  cambioAproxBRL?: number;
  faixaMercadoLocal: string;
  justificativa: string;
  confianca: Confianca;
}

const CHAVES_INDICE = [
  "indice",
  "moedaLocal",
  "cambioAproxBRL",
  "faixaMercadoLocal",
  "justificativa",
  "confianca",
] as const;

/**
 * Extrai cidade + país do endereço já resolvido pelo geocoding
 * ("Zürich, Suíça" / "Sarandi, PR, Brasil") — reaproveita o texto do
 * cache, sem pedir campos novos à Geocoding API. Heurística: primeira
 * parte = cidade, última = país (estado/região do meio é descartado —
 * não é usado pela IA).
 */
export function parseCidadePais(endereco: string): { cidade: string; pais: string } {
  const partes = endereco
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);
  if (partes.length === 0) return { cidade: "", pais: "" };
  return { cidade: partes[0], pais: partes[partes.length - 1] };
}

export function schemaIndiceRegiao(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["indice", "moedaLocal", "faixaMercadoLocal", "justificativa", "confianca"],
    properties: {
      indice: {
        type: "number",
        exclusiveMinimum: 0,
        description:
          "Índice RELATIVO do mercado de sites para pequenos negócios NAQUELA CIDADE (não a média do país). Referência: cidade média do interior do Brasil = 1.0.",
      },
      moedaLocal: { type: "string", maxLength: MOEDA_MAX },
      cambioAproxBRL: {
        type: "number",
        exclusiveMinimum: 0,
        description: "Estimativa aproximada: 1 unidade da moeda local em reais (BRL).",
      },
      faixaMercadoLocal: {
        type: "string",
        maxLength: FAIXA_MAX,
        description: "Faixa típica local de um site simples, na moeda local.",
      },
      justificativa: { type: "string", maxLength: JUSTIFICATIVA_MAX },
      confianca: { type: "string", enum: [...CONFIANCAS] },
    },
  };
}

export function montarPromptIndiceRegiao(cidade: string, pais: string, regiaoTexto: string): string {
  return [
    "Você é um analista de mercado ajudando um web designer freelancer brasileiro a precificar sites simples para pequenos negócios locais.",
    "",
    `Cidade: ${cidade}`,
    `País: ${pais}`,
    `Região buscada originalmente: "${regiaoTexto}"`,
    "",
    "IMPORTANTE: avalie o mercado desta CIDADE ESPECÍFICA, não a média do país inteiro — " +
      "por exemplo, Zurique é um mercado muito mais caro que o interior da Suíça, e São Paulo " +
      "capital é mais caro que uma cidade pequena do interior do mesmo estado.",
    "Referência de escala: uma cidade média do interior do Brasil vale índice 1.0. Cidades/países " +
      "mais caros (maior poder aquisitivo, custo de vida e de serviços digitais) devem ter índice " +
      "maior que 1.0 (sem teto); cidades/países mais baratos, menor que 1.0.",
    "",
    "Responda APENAS o JSON pedido, com:",
    "- indice: número relativo (referência acima), pode ter casas decimais.",
    "- moedaLocal: código ou nome curto da moeda local (ex.: \"CHF\", \"USD\", \"R$\").",
    "- cambioAproxBRL: quantos reais (BRL) vale 1 unidade da moeda local, aproximado — " +
      "omita se a moeda local já for o Real.",
    "- faixaMercadoLocal: faixa típica de preço de um site simples NESSA cidade, na moeda local " +
      "(texto curto, ex.: \"300–800 CHF\").",
    "- justificativa: 1-2 frases em português do Brasil explicando o índice.",
    "- confianca: \"alta\", \"media\" ou \"baixa\", conforme sua confiança na estimativa.",
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
 * tenta de novo) — mesma postura de validarAnaliseBusca.
 */
export function validarIndiceRegiao(
  bruto: unknown,
): { indice: IndiceGerado; problemas: [] } | { indice?: undefined; problemas: string[] } {
  const problemas: string[] = [];
  if (!isRecord(bruto)) {
    return { problemas: ["resposta deve ser um objeto JSON"] };
  }

  for (const chave of Object.keys(bruto)) {
    if (!(CHAVES_INDICE as readonly string[]).includes(chave)) {
      problemas.push(`chave desconhecida: ${chave}`);
    }
  }

  const indice = bruto.indice;
  if (typeof indice !== "number" || !Number.isFinite(indice) || indice <= 0) {
    problemas.push("indice deve ser número > 0");
  }

  const moedaLocal = textoCurto(bruto.moedaLocal, MOEDA_MAX);
  if (!moedaLocal) problemas.push("moedaLocal deve ser string não vazia");

  let cambioAproxBRL: number | undefined;
  if (bruto.cambioAproxBRL !== undefined) {
    if (
      typeof bruto.cambioAproxBRL !== "number" ||
      !Number.isFinite(bruto.cambioAproxBRL) ||
      bruto.cambioAproxBRL <= 0
    ) {
      problemas.push("cambioAproxBRL, quando presente, deve ser número > 0");
    } else {
      cambioAproxBRL = bruto.cambioAproxBRL;
    }
  }

  const faixaMercadoLocal = textoCurto(bruto.faixaMercadoLocal, FAIXA_MAX);
  if (!faixaMercadoLocal) problemas.push("faixaMercadoLocal deve ser string não vazia");

  const justificativa = textoCurto(bruto.justificativa, JUSTIFICATIVA_MAX);
  if (!justificativa) problemas.push("justificativa deve ser string não vazia");

  const confianca = bruto.confianca;
  if (typeof confianca !== "string" || !(CONFIANCAS as readonly string[]).includes(confianca)) {
    problemas.push(`confianca deve ser um de: ${CONFIANCAS.join(", ")}`);
  }

  if (problemas.length > 0) return { problemas };
  return {
    indice: {
      indice: indice as number,
      moedaLocal: moedaLocal as string,
      ...(cambioAproxBRL !== undefined && { cambioAproxBRL }),
      faixaMercadoLocal: faixaMercadoLocal as string,
      justificativa: justificativa as string,
      confianca: confianca as Confianca,
    },
    problemas: [],
  };
}

/**
 * Gera o índice: UMA reserva de cota + UMA chamada ao Gemini, sem retry.
 * Resposta fora do schema → AiError (502) direto — quem chama decide se
 * deixa o usuário tentar de novo (novo clique = nova reserva).
 */
export async function gerarIndiceRegiao(
  db: UsageDb,
  dados: { cidade: string; pais: string; regiaoTexto: string },
  caps: UsageCounts,
  ctx: { userId?: string; isAdmin?: boolean } = {},
): Promise<IndiceGerado> {
  const prompt = montarPromptIndiceRegiao(dados.cidade, dados.pais, dados.regiaoTexto);
  await reserveQuota(db, "aiGeneration", caps, undefined, ctx);
  const resultado = validarIndiceRegiao(await gerarJson(prompt, schemaIndiceRegiao()));
  if (resultado.indice) return resultado.indice;
  throw new AiError(`resposta fora do schema: ${resultado.problemas.join("; ")}`);
}
