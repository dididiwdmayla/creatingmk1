/**
 * Funções puras da calculadora de precificação regional (card
 * "Precificação" na ficha do lead e no grupo de busca). Nada aqui toca
 * Firestore/rede — só matemática sobre números já carregados (índice da
 * região, config do admin, posição do slider).
 */

/** Faixa e passo do slider de preço-base (BRL) — compartilhado UI + rota. */
export const SLIDER_MIN_BRL = 700;
export const SLIDER_MAX_BRL = 10_000;
export const SLIDER_STEP_BRL = 100;

/** Normalização de nicho para casar com a chave de `multiplicadoresNicho`. */
export function normalizaNicho(nicho: string): string {
  return nicho.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Multiplicador configurado para o nicho (chave-valor livre em
 * /config/app). Nicho sem entrada correspondente → 1.0 (neutro).
 */
export function multiplicadorParaNicho(
  nicho: string,
  multiplicadores: Record<string, number>,
): number {
  const alvo = normalizaNicho(nicho);
  for (const [chave, valor] of Object.entries(multiplicadores)) {
    if (normalizaNicho(chave) === alvo) return valor;
  }
  return 1.0;
}

/**
 * Índice efetivo: `indiceAjustado` (edição do admin na UI da região)
 * VENCE o `indice` gerado por IA quando presente. Depois, aplica o fator
 * mínimo — regiões baratas reduzem o preço em no máximo (1 - fatorMinimo);
 * regiões caras (índice > 1) sobem sem teto.
 */
export function calcularIndiceEfetivo(
  indice: number,
  indiceAjustado: number | undefined,
  fatorMinimoIndice: number,
): number {
  const base = indiceAjustado ?? indice;
  return Math.max(base, fatorMinimoIndice);
}

/**
 * Preço sugerido em BRL: base × índice efetivo × multiplicador do nicho,
 * nunca abaixo do piso configurado (default R$900).
 */
export function calcularPrecoSugerido(
  precoBase: number,
  indiceEfetivo: number,
  multiplicadorNicho: number,
  piso: number,
): number {
  const bruto = precoBase * indiceEfetivo * multiplicadorNicho;
  return Math.max(bruto, piso);
}

/**
 * Conversão do preço (BRL) para a moeda local da região, via o câmbio
 * aproximado salvo em /regioes (1 unidade da moeda local ≈ `cambioAproxBRL`
 * reais — mesma convenção de `precos.usdBrl` na config). Sem câmbio
 * (região sem essa informação) → undefined: a UI mostra só BRL.
 */
export function converterMoedaLocal(
  precoBRL: number,
  cambioAproxBRL: number | undefined,
): number | undefined {
  if (!cambioAproxBRL || cambioAproxBRL <= 0) return undefined;
  return precoBRL / cambioAproxBRL;
}
