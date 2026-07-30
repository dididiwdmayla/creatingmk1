import type { AnimacaoEntrada, SkinSecaoDef } from "@/lib/demos/types";

/**
 * Contrato de seções da skin de imobiliária, na ordem default de render.
 * O editor usa esta lista para reordenar/ocultar e oferecer alinhamento;
 * a skin renderiza pela ordem efetiva (ver lib/demos/estrutura.ts).
 *
 * `hero` é fixa (abertura, com a nav por cima). O material bruto não tinha
 * máquina de escrever em nenhum título — por isso nenhuma seção oferece
 * "typewriter" em `entradaOptions` (mesmo critério de lancheria/barbearia2).
 */
const ENTRADAS: readonly AnimacaoEntrada[] = [
  "nenhuma",
  "fade",
  "deslizar-esquerda",
  "deslizar-direita",
];

export const IMOBILIARIA_SECOES: SkinSecaoDef[] = [
  { id: "hero", nome: "Abertura (hero)", fixa: true },
  { id: "imoveis", nome: "Imóveis em destaque", entradaOptions: ENTRADAS },
  { id: "bairros", nome: "Bairros (vitrine arrastável)", entradaOptions: ENTRADAS },
  { id: "como", nome: "Como funciona", entradaOptions: ENTRADAS },
  { id: "depoimento", nome: "Depoimento", entradaOptions: ENTRADAS },
  {
    id: "contato",
    nome: "Contato (rodapé)",
    alignOptions: ["centro", "esquerda"],
    entradaOptions: ENTRADAS,
  },
];
