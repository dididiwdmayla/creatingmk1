import { normalizaNicho } from "@/lib/precificacao/calc";
import { CHAVE_GENERICAS } from "./types";

/**
 * Chave do doc em /frasesProspeccao. Mesma normalização já usada para casar
 * nicho em toda a plataforma (`normalizaNicho` de lib/precificacao/calc.ts,
 * gêmea da de lib/traducaoNicho/repo.ts): minúsculas, espaços colapsados —
 * "Dentista" e "dentista " caem no MESMO conjunto de frases. O
 * encodeURIComponent é o que impede um "/" no nicho de virar subcoleção.
 */
export function chaveNicho(nicho: string): string {
  return encodeURIComponent(normalizaNicho(nicho));
}

/** True quando o nicho colidiria com o doc reservado do conjunto genérico. */
export function colideComGenericas(nicho: string): boolean {
  return chaveNicho(nicho) === CHAVE_GENERICAS;
}

export { normalizaNicho };
