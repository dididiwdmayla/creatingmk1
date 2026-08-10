import { getSkin } from "@/lib/demos/registry";
import { ValidationError } from "@/lib/errors";
import { FRASES_SLOTS, FRASE_MAX } from "./types";

/** Corpo aceito por PUT /api/frases — um conjunto por vez, por skin. */
export interface ConjuntoPatch {
  skinId: string;
  frases: string[];
}

/**
 * Valida o corpo do PUT. Chave desconhecida é rejeitada (mesmo espírito de
 * `validateConfigPatch`: pega typo em vez de ignorar em silêncio), e o
 * `skinId` precisa existir NO REGISTRO — é o que impede a coleção de voltar
 * a acumular doc por texto livre.
 */
export function validarConjuntoPatch(corpo: unknown): asserts corpo is ConjuntoPatch {
  const problemas: string[] = [];
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    throw new ValidationError(["corpo deve ser um objeto JSON"]);
  }
  const patch = corpo as Record<string, unknown>;

  for (const chave of Object.keys(patch)) {
    if (chave !== "skinId" && chave !== "frases") {
      problemas.push(`chave desconhecida: ${chave}`);
    }
  }

  problemas.push(...problemasDoSkinId(patch.skinId));

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
export function validarAlvoRotacao(corpo: unknown): asserts corpo is { skinId: string } {
  if (typeof corpo !== "object" || corpo === null || Array.isArray(corpo)) {
    throw new ValidationError(["corpo deve ser um objeto JSON"]);
  }
  const problemas = problemasDoSkinId((corpo as Record<string, unknown>).skinId);
  if (problemas.length > 0) {
    throw new ValidationError(problemas);
  }
}

function problemasDoSkinId(skinId: unknown): string[] {
  if (typeof skinId !== "string" || !skinId.trim()) {
    return ["skinId deve ser o id de uma skin do registro"];
  }
  if (!getSkin(skinId)) {
    return [`skinId "${skinId}" não é uma skin do registro`];
  }
  return [];
}
