/**
 * Cliente do Google Gemini (Generative Language API). Único ponto do app
 * que fala com generativelanguage.googleapis.com. Segue os mesmos
 * princípios do cliente da Places API:
 *
 * - A chave (GEMINI_API_KEY) vive SÓ em variável de ambiente e é usada
 *   exclusivamente server-side (route handlers). Nenhuma chamada parte do
 *   cliente.
 * - Sem a chave configurada, a IA fica indisponível — as rotas respondem
 *   503 ai_unavailable e a UI oculta/desabilita os botões (nada quebra).
 * - Toda chamada passa por reserveQuota(sku "aiGeneration") ANTES do fetch
 *   (responsabilidade de quem chama — ver ./sugestao.ts), igual ao Google
 *   Maps: se o Gemini falhar depois, o contador fica 1 acima do real, o
 *   lado seguro do erro.
 */

/** Modelo flash mais atual (GA em jul/2026). */
export const GEMINI_MODEL = "gemini-3.5-flash";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/** Gemini respondeu erro ou JSON inutilizável. Rotas → HTTP 502. */
export class AiError extends Error {
  readonly code = "ai_error";

  constructor(readonly detail: string) {
    super(`Falha na geração com IA: ${detail}`);
    this.name = "AiError";
  }
}

/** GEMINI_API_KEY ausente: funcionalidade desligada. Rotas → HTTP 503. */
export class AiIndisponivelError extends Error {
  readonly code = "ai_unavailable";

  constructor() {
    super("IA indisponível: GEMINI_API_KEY não configurada no servidor.");
    this.name = "AiIndisponivelError";
  }
}

/** A UI usa isto (via GET /api/ia) para ocultar/desabilitar botões de IA. */
export function aiDisponivel(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function requireApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiIndisponivelError();
  return key;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

/**
 * Uma chamada generateContent pedindo APENAS JSON (responseMimeType +
 * responseJsonSchema guiam o modelo; a validação estrita de verdade é de
 * quem chama — o schema do Gemini é orientação, não garantia). Devolve o
 * JSON já parseado como unknown; resposta vazia/não-JSON vira AiError.
 */
export async function gerarJson(
  prompt: string,
  responseJsonSchema: Record<string, unknown>,
): Promise<unknown> {
  const key = requireApiKey();
  const res = await fetch(`${BASE_URL}/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema,
        temperature: 0.7,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AiError(
      `Gemini respondeu ${res.status}: ${body.slice(0, 500) || res.statusText}`,
    );
  }

  const data = (await res.json().catch(() => undefined)) as GeminiResponse | undefined;
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("");
  if (!text?.trim()) {
    throw new AiError("resposta sem conteúdo de texto");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AiError(`resposta não é JSON válido: ${text.slice(0, 200)}`);
  }
}
