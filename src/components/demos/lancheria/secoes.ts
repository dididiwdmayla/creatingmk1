import type { AnimacaoEntrada, SkinSecaoDef } from "@/lib/demos/types";

/**
 * Contrato de seções da skin de lancheria, na ordem default de render.
 * O editor usa esta lista para reordenar/ocultar e oferecer alinhamento;
 * a skin renderiza pela ordem efetiva (ver lib/demos/estrutura.ts).
 *
 * `hero` é fixa (abertura, com o header por cima). O material bruto não
 * tinha máquina de escrever em nenhum título — por isso nenhuma seção
 * oferece "typewriter" em `entradaOptions` (ao contrário da barbearia).
 */
const ENTRADAS: readonly AnimacaoEntrada[] = [
  "nenhuma",
  "fade",
  "deslizar-esquerda",
  "deslizar-direita",
];

export const LANCHERIA_SECOES: SkinSecaoDef[] = [
  { id: "hero", nome: "Abertura (hero)", fixa: true },
  { id: "cardapio", nome: "Cardápio (lanches)", entradaOptions: ENTRADAS },
  { id: "bebidas", nome: "Bebidas", entradaOptions: ENTRADAS },
  { id: "acompanhamentos", nome: "Acompanhamentos", entradaOptions: ENTRADAS },
  {
    id: "contato",
    nome: "Contato (rodapé)",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
];
