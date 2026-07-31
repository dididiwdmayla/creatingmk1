import type { EfeitoDefinition } from "./types";

/**
 * Registro de efeitos visuais da Forja de Demos. Para adicionar um efeito:
 * crie o pacote em ./<id>/ (componente "use client", ver contrato em
 * ./types.ts), registre o import dinâmico em ./dynamicComponents.ts e
 * acrescente a entrada aqui. Ver ARCHITECTURE.md.
 *
 * Só metadado (id/nome/nichos) — nunca o componente em si, pra este
 * módulo poder ser importado (ex.: um seletor de efeitos) sem puxar o
 * código de nenhum efeito.
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
];

export function getEfeito(id: string | undefined): EfeitoDefinition | undefined {
  return EFEITOS.find((efeito) => efeito.id === id);
}
