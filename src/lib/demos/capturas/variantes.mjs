/**
 * Variantes por skin, em dado puro — `SkinDefinition.variantes` visto de
 * fora do TypeScript.
 *
 * Mora num `.mjs` pelo mesmo motivo que `padrao.mjs`: os laços de
 * verificação (`scripts/qa-visual.mjs`) não compilam TypeScript, e a
 * matriz visual precisa saber quais variantes existem para percorrer
 * variante × modo de cor. A duplicação contra o registro é coberta por
 * teste de contrato (ver __tests__/variantes-mjs.test.ts): variante nova
 * que entre no registro sem entrar aqui quebra o teste, em vez de sumir
 * silenciosamente da matriz — que foi exatamente como as quatro
 * lancherias ficaram fora de `--so=colapso` por uma rodada inteira.
 */
export const VARIANTES_POR_SKIN = /** @type {Record<string, string[]>} */ ({
  "lancheria-2": [
    "lancheria-meia-noite",
    "lancheria-diner",
    "lancheria-pratico",
    "lancheria-cantina",
  ],
});
