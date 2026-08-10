import { ValidationError } from "@/lib/errors";
import { colideComGenericas } from "./chave";
import { FRASES_SLOTS, FRASE_MAX } from "./types";

/** Corpo aceito por PUT /api/frases — `nicho: null` é o conjunto genérico. */
export interface ConjuntoPatch {
  nicho: string | null;
  frases: string[];
}

/**
 * Valida o corpo do PUT. Chave desconhecida é rejeitada (mesmo espírito de
 * `validateConfigPatch`: pega typo em vez de ignorar em silêncio).
 */
export function validarConjuntoPatch(corpo: unknown): asserts corpo is ConjuntoPatch {
  const problemas: string[] = [];
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    throw new ValidationError(["corpo deve ser um objeto JSON"]);
  }
  const patch = corpo as Record<string, unknown>;

  for (const chave of Object.keys(patch)) {
    if (chave !== "nicho" && chave !== "frases") {
      problemas.push(`chave desconhecida: ${chave}`);
    }
  }

  const { nicho } = patch;
  if (nicho !== null && typeof nicho !== "string") {
    problemas.push("nicho deve ser string (ou null para o conjunto genérico)");
  } else if (typeof nicho === "string") {
    if (!nicho.trim()) {
      problemas.push("nicho não pode ser vazio (use null para o conjunto genérico)");
    } else if (colideComGenericas(nicho)) {
      // Sem este guarda-corpo, um nicho com esse nome exato sobrescreveria
      // o doc reservado do conjunto genérico de fallback.
      problemas.push(`nicho "${nicho}" é reservado pelo conjunto genérico`);
    }
  }

  if (!Array.isArray(patch.frases)) {
    problemas.push("frases deve ser uma lista de strings");
  } else {
    if (patch.frases.length > FRASES_SLOTS) {
      problemas.push(`frases deve ter no máximo ${FRASES_SLOTS} itens`);
    }
    patch.frases.forEach((frase, i) => {
      if (typeof frase !== "string") {
        problemas.push(`frases[${i}] deve ser string`);
      } else if (frase.length > FRASE_MAX) {
        problemas.push(`frases[${i}] deve ter no máximo ${FRASE_MAX} caracteres`);
      }
    });
  }

  if (problemas.length > 0) {
    throw new ValidationError(problemas);
  }
}

/** Valida o corpo do POST de avanço da rotação. */
export function validarAlvoRotacao(corpo: unknown): asserts corpo is { nicho: string | null } {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    throw new ValidationError(["corpo deve ser um objeto JSON"]);
  }
  const { nicho } = corpo as Record<string, unknown>;
  if (nicho !== null && typeof nicho !== "string") {
    throw new ValidationError(["nicho deve ser string (ou null para o conjunto genérico)"]);
  }
  if (typeof nicho === "string" && !nicho.trim()) {
    throw new ValidationError(["nicho não pode ser vazio (use null para o conjunto genérico)"]);
  }
}
