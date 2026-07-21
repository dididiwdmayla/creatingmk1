import type { AnimacaoEntrada, SkinSecaoDef } from "@/lib/demos/types";

/**
 * Contrato de seções da skin de barbearia2, na ordem default de render.
 * O editor usa esta lista para reordenar/ocultar e oferecer alinhamento;
 * a skin renderiza pela ordem efetiva (ver lib/demos/estrutura.ts).
 *
 * `hero` é fixa (abertura, com a navegação por cima). O material bruto não
 * tinha máquina de escrever em nenhum título — a entrada padrão dele é
 * fade/slide simples (CSS puro), então nenhuma seção oferece "typewriter"
 * em `entradaOptions` (mesmo critério de lancheria/secoes.ts).
 */
const ENTRADAS: readonly AnimacaoEntrada[] = [
  "nenhuma",
  "fade",
  "deslizar-esquerda",
  "deslizar-direita",
];

export const BARBEARIA2_SECOES: SkinSecaoDef[] = [
  { id: "hero", nome: "Abertura (hero)", fixa: true },
  { id: "manifesto", nome: "Manifesto", alignOptions: ["esquerda", "centro"], entradaOptions: ENTRADAS },
  { id: "servicos", nome: "Serviços", entradaOptions: ENTRADAS },
  {
    id: "ritual",
    nome: "O ritual",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
  { id: "galeria", nome: "Galeria", entradaOptions: ENTRADAS },
  {
    id: "barbeiros",
    nome: "Barbeiros",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
  {
    id: "agendamento",
    nome: "Agendamento",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
  { id: "contato", nome: "Contato", entradaOptions: ENTRADAS },
];
