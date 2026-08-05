/**
 * Padrão inicial por skin, aprovado antes de virar código. O critério é
 * sempre o mesmo trio, na ordem em que uma conversa de prospecção anda:
 *
 *   1. IDENTIDADE  — o hero, a primeira impressão da marca (toda skin tem).
 *   2. OFERTA      — a seção que mostra o que o negócio vende.
 *   3. PROVA/FECHO — depoimento, galeria ou o passo que fecha a venda.
 *
 * Ficaram DE FORA as seções puramente decorativas (`faixa` do petshop,
 * `marquee` da tatuagem) e as que só fazem sentido em movimento: um print
 * parado delas não diz nada a quem recebe.
 *
 * Isto é só o DEFAULT. O doc `/config/app` sobrescreve por skin, editável
 * em /interno/capturas sem deploy.
 *
 * Mora num `.mjs` para o laço de captura (scripts/capturas.mjs, que não
 * compila TypeScript) poder cair AQUI quando não houver Firestore para
 * responder /api/config — é o que mantém o motor exercitável sem banco,
 * pelo mesmo motivo que /interno/demo-qa existe.
 */
export const ANCORAS_PADRAO = /** @type {Record<string, string[]>} */ ({
  "barbearia-editorial": ["hero", "servicos", "depoimentos"],
  "barbearia2-sul": ["hero", "servicos", "galeria"],
  "imobiliaria-curada": ["hero", "imoveis", "depoimento"],
  "lancheria-chapa-burger": ["hero", "cardapio", "contato"],
  "multimarcas-vortice": ["hero", "estoque", "simulador"],
  "petshop-focinho-feliz": ["hero", "servicos", "depoimentos"],
  "tatuagem-editorial": ["hero", "portfolio", "investimento"],
  "tatuagem-pigmento-vivo": ["hero", "portfolio", "estilos"],
});
