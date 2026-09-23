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
  "barbearia-editorial": ["norte", "meia-noite", "creme", "vinho"],
  "tatuagem-editorial": ["sangue", "vesperal", "cripta", "marfim"],
  "lancheria-chapa-burger": ["chapa", "balcao", "sala", "praca"],
  "multimarcas-vortice": ["vortice", "patio", "garagem", "campo"],
  "lancheria-2": [
    "lancheria-meia-noite",
    "lancheria-diner",
    "lancheria-pratico",
    "lancheria-cantina",
  ],
});

/**
 * Slots de imagem que a composição de uma variante NÃO desenha, em dado
 * puro — `SkinVariante.imagensOcultas` visto de fora do TypeScript.
 *
 * Mora aqui pelo mesmo motivo da lista acima, e tem o mesmo teste de
 * contrato: o laço (`scripts/qa-tatuagem.mjs`) mede a caixa de cada slot
 * no navegador COM JAVASCRIPT DESLIGADO e exige zero para o que está
 * declarado e maior que zero para o que não está. Sem a cópia, a
 * declaração que o editor mostra ao operador seria só um comentário.
 */
export const IMAGENS_OCULTAS_POR_VARIANTE = /** @type {Record<string, Record<string, Record<string, string>>>} */ ({
  "tatuagem-editorial": {
    vesperal: { hero: "so-titulo" },
    cripta: { sobre: "nenhum" },
  },
  "lancheria-chapa-burger": {
    balcao: {
      "flutuante-bacon": "nenhum",
      "flutuante-queijo": "nenhum",
      "flutuante-bebida": "nenhum",
    },
    sala: {
      "bebida-1": "nenhum",
      "bebida-2": "nenhum",
      "bebida-3": "nenhum",
      "bebida-4": "nenhum",
      "bebida-5": "nenhum",
      "flutuante-bacon": "nenhum",
      "flutuante-queijo": "nenhum",
      "flutuante-bebida": "nenhum",
    },
  },
  "multimarcas-vortice": {
    vortice: { hero: "nenhum" },
    patio: { hero: "nenhum" },
  },
});
