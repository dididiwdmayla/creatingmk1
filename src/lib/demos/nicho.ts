import { SKINS } from "./registry";
import type { SkinDefinition } from "./types";

/**
 * Normalização EXATA de nicho, separada de `normalizaNicho`
 * (`lib/precificacao/calc.ts`): aquela só reduz espaços múltiplos a um e
 * não mexe em acento, o que basta para casar chave-valor livre digitada
 * pelo mesmo admin duas vezes. Aqui o nicho é digitado pelo OPERADOR em
 * português livre ("Pet Shop", "petshop", "pét-shop" precisam ser o MESMO
 * nicho), então esta função remove acento e TODO espaço/hífen — nunca
 * substring: "bar" não pode virar "barbearia" cortando o resto fora.
 */
export function normalizaNichoExato(nicho: string): string {
  return nicho
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "");
}

/**
 * Skins cujo nicho OU algum sinônimo casa (igualdade exata, normalizada)
 * com o nicho de busca. Pura: lê o registro estático, nunca Firestore.
 * Ordem = ordem do registro (`SKINS`), a mesma que `proximaCombinacao`
 * (./rodizio.ts) usa para a ordenação determinística das combinações.
 */
export function skinsDoNicho(
  nicho: string,
  skins: readonly SkinDefinition[] = SKINS,
): SkinDefinition[] {
  const alvo = normalizaNichoExato(nicho);
  return skins.filter((skin) => {
    if (normalizaNichoExato(skin.nicho) === alvo) return true;
    return skin.sinonimos.some((sinonimo) => normalizaNichoExato(sinonimo) === alvo);
  });
}
