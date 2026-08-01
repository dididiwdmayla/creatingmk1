import type { EfeitoDefinition, EfeitoIntensidade } from "./types";

/**
 * Registro de efeitos visuais da Forja de Demos. Para adicionar um efeito:
 * crie o pacote em ./<id>/ (componente "use client", ver contrato em
 * ./types.ts), registre o import dinâmico em ./dynamicComponents.ts e
 * acrescente a entrada aqui. Ver ARCHITECTURE.md.
 *
 * Só metadado (id/nome/nichos) — nunca o componente em si, pra este
 * módulo poder ser importado (ex.: o seletor "Efeito de fundo" da aba
 * Tema do editor) sem puxar o código de nenhum efeito.
 */
export const EFEITOS: EfeitoDefinition[] = [
  {
    id: "aura",
    nome: "Aura",
    nichosRecomendados: ["barbearia", "tatuagem", "imobiliaria", "multimarcas"],
  },
  {
    id: "grao",
    nome: "Grão",
    nichosRecomendados: ["barbearia", "tatuagem", "lancheria", "petshop"],
  },
  {
    id: "gradiente",
    nome: "Gradiente animado",
    // Nichos que já usavam "gradiente" como Theme.fundoEfeito antes deste
    // registro existir (ver themes.ts de cada skin) — preserva o mesmo
    // "recomendado" pros presets que já ligavam o efeito.
    nichosRecomendados: ["imobiliaria", "multimarcas"],
  },
  {
    id: "particulas",
    nome: "Partículas",
    // Ids de SkinDefinition.nicho (não de skin) — "barbearia2-sul" e
    // "tatuagem-pigmento-vivo" declaram nicho "barbearia"/"tatuagem",
    // os mesmos das skins "-editorial" (ver src/lib/demos/registry.ts).
    nichosRecomendados: ["barbearia", "lancheria", "multimarcas", "petshop", "tatuagem"],
  },
];

export function getEfeito(id: string | undefined): EfeitoDefinition | undefined {
  return EFEITOS.find((efeito) => efeito.id === id);
}

/**
 * Intensidade default quando a demo não tem uma escolha explícita
 * persistida (`TemaPatch.fundoEfeitoIntensidade`): mais presente (2) se o
 * nicho da skin está entre os recomendados do efeito, mais discreta (1)
 * caso contrário — ver "Adicione controle de intensidade" no editor
 * (aba Tema) e a rota pública /demo/[leadId].
 */
export function intensidadePadrao(
  efeito: EfeitoDefinition,
  nicho: string,
): Exclude<EfeitoIntensidade, 0> {
  return efeito.nichosRecomendados.includes(nicho) ? 2 : 1;
}

/** Efeito de fundo já resolvido — pronto pra passar direto ao componente dinâmico. */
export interface EfeitoFundoResolvido {
  efeito: EfeitoDefinition;
  intensidade: EfeitoIntensidade;
}

/**
 * Resolve o efeito de fundo efetivo de uma demo: `fundoEfeitoId` (já
 * validado/resolvido pelo preset ← TemaPatch em `aplicarTema`, ver
 * ./tema.ts) + a intensidade persistida (`TemaPatch.fundoEfeitoIntensidade`)
 * ou o default do nicho quando ausente. `undefined` = nada a renderizar —
 * cobre tanto "nenhum" quanto um id que não existe mais no registro (ex.:
 * um efeito removido depois de uma demo antiga tê-lo escolhido; a demo
 * simplesmente some do fundo, sem erro).
 */
export function resolverEfeitoFundo(
  fundoEfeitoId: string,
  intensidadePersistida: EfeitoIntensidade | undefined,
  nicho: string,
): EfeitoFundoResolvido | undefined {
  const efeito = getEfeito(fundoEfeitoId);
  if (!efeito) return undefined;
  const intensidade = intensidadePersistida ?? intensidadePadrao(efeito, nicho);
  return { efeito, intensidade };
}
