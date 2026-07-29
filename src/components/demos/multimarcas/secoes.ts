import type { AnimacaoEntrada, SkinSecaoDef } from "@/lib/demos/types";

/**
 * Contrato de seções da skin "Multimarcas Vórtice", na ordem default de
 * render. `hero` é fixa (abertura, com a nav por cima). O material bruto
 * não tem máquina de escrever em nenhum título — por isso nenhuma seção
 * oferece "typewriter" em `entradaOptions` (mesmo critério da lancheria).
 *
 * `numeros` (contadores "+1.200 carros entregues" etc.) fica logo depois
 * de `vantagens` na ordem default — no material bruto os dois blocos
 * dividem a mesma seção visual; aqui viram duas seções reordenáveis
 * independentes (cada uma ocultável/realocável por si), sem costura visível
 * entre elas quando ambas aparecem juntas (ver Skin.tsx).
 */
const ENTRADAS: readonly AnimacaoEntrada[] = [
  "nenhuma",
  "fade",
  "deslizar-esquerda",
  "deslizar-direita",
];

export const MULTIMARCAS_SECOES: SkinSecaoDef[] = [
  { id: "hero", nome: "Abertura (hero)", fixa: true },
  { id: "estoque", nome: "Estoque (veículos)", entradaOptions: ENTRADAS },
  { id: "vantagens", nome: "Por que escolher", entradaOptions: ENTRADAS },
  { id: "numeros", nome: "Números (contadores)", entradaOptions: ENTRADAS },
  { id: "simulador", nome: "Simulador de financiamento", entradaOptions: ENTRADAS },
  {
    id: "avaliacao",
    nome: "Avaliação (venda seu carro)",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
  { id: "depoimentos", nome: "Depoimentos", entradaOptions: ENTRADAS },
  {
    id: "contato",
    nome: "Contato (rodapé)",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
];
