/**
 * O ALVO de uma geração de capturas — qual demo capturar e onde ela mora.
 *
 * Existem duas famílias: a demo de um lead (doc em `/leads`, rota pública
 * `/demo/{placeId}`) e a demo AVULSA (doc em `/demosAvulsas`, rota
 * `/demo/avulsa/{id}`). A fila de capturas atravessa quatro processos que
 * não se falam — a rota do Radar, o `repository_dispatch` do GitHub, o
 * orquestrador do workflow e o motor — e o payload que passa entre eles é
 * uma LISTA DE STRINGS separada por vírgula (o `client_payload` chega como
 * expressão de template no YAML; qualquer coisa estruturada viraria
 * "[object Object]" na linha de comando).
 *
 * Então a família viaja no próprio id, como prefixo: `avulsa:<uuid>`. Sem
 * prefixo é lead, que é como todo alvo já gravado se parece — nenhuma
 * migração, nenhum payload novo. Este módulo é a ÚNICA definição desse
 * formato, e é `.mjs` porque os scripts do laço não compilam TypeScript
 * (mesmo motivo de `dom.mjs`/`previa.mjs`).
 */

/** Prefixo que marca um alvo da coleção de demos avulsas. */
export const PREFIXO_AVULSA = "avulsa:";

export const COLECAO_LEADS = "leads";
export const COLECAO_AVULSAS = "demosAvulsas";

/**
 * Quebra o alvo em `{ id, avulsa, colecao }`. Id vazio ou só o prefixo
 * devolve `undefined` — quem chama trata como alvo inválido em vez de
 * buscar o doc "" e receber um erro sem sentido do Firestore.
 */
export function parseAlvo(alvo) {
  const bruto = typeof alvo === "string" ? alvo.trim() : "";
  if (!bruto) return undefined;
  const avulsa = bruto.startsWith(PREFIXO_AVULSA);
  const id = avulsa ? bruto.slice(PREFIXO_AVULSA.length).trim() : bruto;
  if (!id) return undefined;
  return { id, avulsa, colecao: avulsa ? COLECAO_AVULSAS : COLECAO_LEADS };
}

/** O caminho inverso: `{ id, avulsa }` → a string que viaja no payload. */
export function formatAlvo(id, avulsa = false) {
  return avulsa ? `${PREFIXO_AVULSA}${id}` : id;
}

/** Caminho da rota PÚBLICA do alvo (o que o motor abre no Chromium). */
export function caminhoPublicoDoAlvo(alvo) {
  const parsed = parseAlvo(alvo);
  if (!parsed) return undefined;
  return parsed.avulsa
    ? `/demo/avulsa/${encodeURIComponent(parsed.id)}`
    : `/demo/${encodeURIComponent(parsed.id)}`;
}

/** Rota interna de leitura do alvo (de onde o motor tira skin e nome). */
export function caminhoApiDoAlvo(alvo) {
  const parsed = parseAlvo(alvo);
  if (!parsed) return undefined;
  return parsed.avulsa
    ? `/api/demos-avulsas/${encodeURIComponent(parsed.id)}`
    : `/api/leads/${encodeURIComponent(parsed.id)}`;
}
