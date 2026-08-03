import type { DemoData, SkinSecaoDef } from "./types";

/**
 * Estrutura efetiva das seções de uma demo: ordem (DemoData.ordemSecoes)
 * e visibilidade (DemoSecao.oculta), resolvidas contra o contrato de
 * seções da skin (SkinDefinition.secoes). Funções puras usadas pela skin
 * (render), pelo editor (painel Estrutura) e pelos testes de contrato.
 */

/**
 * Ordem efetiva de TODAS as seções da skin: fixas ficam na posição default;
 * não-fixas seguem `ordem` (ids desconhecidos ignorados; não listadas
 * entram no fim, na ordem default — dado velho nunca some com seção).
 */
export function ordemEfetiva(secoes: SkinSecaoDef[], ordem: string[] | undefined): string[] {
  if (!ordem || ordem.length === 0) return secoes.map((secao) => secao.id);

  const reordenaveis = secoes.filter((secao) => !secao.fixa).map((secao) => secao.id);
  const pedidas = ordem.filter((id) => reordenaveis.includes(id));
  const restantes = reordenaveis.filter((id) => !pedidas.includes(id));
  const fila = [...pedidas, ...restantes];

  let i = 0;
  return secoes.map((secao) => (secao.fixa ? secao.id : fila[i++]));
}

/** Seção visível? Fixas sempre; não-fixas obedecem DemoSecao.oculta. */
export function secaoVisivel(def: SkinSecaoDef, data: DemoData): boolean {
  if (def.fixa) return true;
  return data.secoes[def.id]?.oculta !== true;
}

/**
 * Animação ligada nesta seção? (`DemoSecao.animacao` — ausente = ligada,
 * que é o comportamento de toda demo publicada antes deste controle.)
 * Vale para seção fixa também, ao contrário de ocultar/reordenar.
 */
export function secaoAnimada(data: DemoData, id: string): boolean {
  return data.secoes[id]?.animacao !== false;
}

/** Ids das seções a renderizar, já ordenados e sem as ocultas. */
export function secoesVisiveis(secoes: SkinSecaoDef[], data: DemoData): string[] {
  const porId = new Map(secoes.map((secao) => [secao.id, secao]));
  return ordemEfetiva(secoes, data.ordemSecoes).filter((id) => {
    const def = porId.get(id);
    return def !== undefined && secaoVisivel(def, data);
  });
}
