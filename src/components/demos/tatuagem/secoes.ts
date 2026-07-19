import type { AnimacaoEntrada, SkinSecaoDef } from "@/lib/demos/types";

/**
 * Contrato de seções da skin de tatuagem (editorial sombrio), na ordem
 * default de render. `hero` é fixa (tela de abertura, header por cima).
 *
 * O material bruto (skins-raw/tatuagem) não tem lista de preços nem
 * depoimentos — mas DemoData.servicos/depoimentos são campos universais
 * (o editor sempre mostra os painéis "Serviços e preços" e "Depoimentos",
 * ver app/leads/[id]/demo/editar/paineis.tsx) e o registro exige ao menos
 * um serviço com nome+preço. Por isso as seções `investimento` e
 * `depoimentos` são acréscimos deliberados ao original — reskinados na
 * mesma linguagem editorial (mono, divisores finos) para não destoar.
 * Nenhuma outra seção foge do material bruto.
 *
 * `statement` não tinha animação de entrada no original (bloco estático);
 * fica sem `entradaOptions` com "typewriter" (a skin não usa máquina de
 * escrever em lugar nenhum — o original não tinha esse efeito).
 */
const ENTRADAS: readonly AnimacaoEntrada[] = [
  "nenhuma",
  "fade",
  "deslizar-esquerda",
  "deslizar-direita",
];

export const TATUAGEM_SECOES: SkinSecaoDef[] = [
  { id: "hero", nome: "Abertura (hero)", fixa: true },
  { id: "sobre", nome: "O Artista", entradaOptions: ENTRADAS },
  { id: "statement", nome: "Manifesto", entradaOptions: ENTRADAS },
  { id: "portfolio", nome: "Portfólio", alignOptions: ["centro", "esquerda"], entradaOptions: ENTRADAS },
  { id: "investimento", nome: "Investimento", entradaOptions: ENTRADAS },
  {
    id: "depoimentos",
    nome: "Depoimentos",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
  { id: "marquee", nome: "Faixa rolante" },
  {
    id: "processo",
    nome: "O Processo",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
  { id: "contato", nome: "Agendar sessão", entradaOptions: ENTRADAS },
];
