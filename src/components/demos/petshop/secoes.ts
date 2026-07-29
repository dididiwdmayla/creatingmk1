import type { AnimacaoEntrada, SkinSecaoDef } from "@/lib/demos/types";

/**
 * Contrato de seções da skin de petshop, na ordem default de render.
 * O editor usa esta lista para reordenar/ocultar e oferecer alinhamento;
 * a skin renderiza pela ordem efetiva (ver lib/demos/estrutura.ts).
 *
 * `hero` é fixa (abertura, com o header por cima) — as demais, inclusive
 * o rodapé de contato, seguem reordenáveis/ocultáveis, mesmo critério de
 * `lancheria`/`barbearia`/`barbearia2`. O material bruto não
 * tinha máquina de escrever em nenhum título — a entrada padrão dele é o
 * `data-reveal` (fade + slide de baixo, ver fx.js) — por isso nenhuma
 * seção oferece "typewriter" em `entradaOptions` (mesmo critério de
 * lancheria/barbearia2). `faixa` (a fita de frases) só oferece
 * fade/nenhuma: ela já tem uma animação horizontal contínua própria
 * (marquee) — uma entrada `deslizar-esquerda/direita` competiria no mesmo
 * eixo e ficaria confusa (dois movimentos horizontais simultâneos).
 */
const ENTRADAS: readonly AnimacaoEntrada[] = [
  "nenhuma",
  "fade",
  "deslizar-esquerda",
  "deslizar-direita",
];

const ENTRADAS_SEM_TRANSFORM: readonly AnimacaoEntrada[] = ["nenhuma", "fade"];

export const PETSHOP_SECOES: SkinSecaoDef[] = [
  { id: "hero", nome: "Abertura (hero)", fixa: true },
  { id: "faixa", nome: "Fita de frases", entradaOptions: ENTRADAS_SEM_TRANSFORM },
  { id: "numeros", nome: "Números", entradaOptions: ENTRADAS },
  { id: "servicos", nome: "Serviços", entradaOptions: ENTRADAS },
  {
    id: "comoFunciona",
    nome: "Como funciona",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
  {
    id: "depoimentos",
    nome: "Depoimentos",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
  { id: "equipe", nome: "Equipe", alignOptions: ["esquerda", "centro"], entradaOptions: ENTRADAS },
  { id: "diferenciais", nome: "Diferenciais", entradaOptions: ENTRADAS },
  {
    id: "galeria",
    nome: "Galeria (clientes da semana)",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
  { id: "ctaFinal", nome: "Chamada final", entradaOptions: ENTRADAS },
  {
    id: "contato",
    nome: "Contato (rodapé)",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
];
