import type { AnimacaoEntrada, SkinSecaoDef } from "@/lib/demos/types";

/**
 * Contrato de seções da skin "Pigmento Vivo" (conversão de
 * skins-raw/tatuagem2), na ordem default de render. `hero` é fixa (tela
 * de abertura, nav por cima).
 *
 * O material bruto não tem lista de preços nem depoimentos — mesmo caso
 * já registrado em tatuagem/secoes.ts: DemoData.servicos/depoimentos são
 * campos universais do contrato (o editor sempre mostra os painéis
 * correspondentes) — por isso `investimento` e `depoimentos` são
 * acréscimos deliberados, reskinados na mesma linguagem colorida/editorial
 * do resto (nenhuma outra seção foge do original).
 *
 * `manifesto` não recebe `entradaOptions`: a seção já tem sua própria
 * revelação progressiva por palavra conforme o scroll (ManifestoReveal),
 * e embrulhá-la de novo no wrapper de entrada padrão duplicaria/competiria
 * com esse efeito — mesmo raciocínio do `statement`/`marquee` sem opção
 * em tatuagem/secoes.ts.
 */
const ENTRADAS: readonly AnimacaoEntrada[] = [
  "nenhuma",
  "fade",
  "deslizar-esquerda",
  "deslizar-direita",
];

export const TATUAGEM2_SECOES: SkinSecaoDef[] = [
  { id: "hero", nome: "Abertura (hero)", fixa: true },
  { id: "manifesto", nome: "Manifesto" },
  { id: "estilos", nome: "Estilos", entradaOptions: ENTRADAS },
  { id: "investimento", nome: "Investimento", entradaOptions: ENTRADAS },
  { id: "portfolio", nome: "Portfólio", entradaOptions: ENTRADAS },
  { id: "artistas", nome: "Artistas", entradaOptions: ENTRADAS },
  {
    id: "depoimentos",
    nome: "Depoimentos",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
  {
    id: "processo",
    nome: "O Processo",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
  { id: "faq", nome: "Cuidados e FAQ", entradaOptions: ENTRADAS },
  { id: "agendar", nome: "Agendar sessão (CTA final)", entradaOptions: ENTRADAS },
  { id: "contato", nome: "Rodapé", entradaOptions: ENTRADAS },
];
