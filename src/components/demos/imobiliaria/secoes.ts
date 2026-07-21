import type { AnimacaoEntrada, SkinSecaoDef } from "@/lib/demos/types";

/**
 * Contrato de seções da skin de imobiliária, na ordem default de render.
 * O editor usa esta lista para reordenar/ocultar e oferecer alinhamento;
 * a skin renderiza pela ordem efetiva (ver lib/demos/estrutura.ts).
 *
 * `hero` é fixa (abertura, com o header por cima). O material bruto anima
 * quase tudo por REVELAÇÃO INDIVIDUAL de elemento (`data-reveal`, stagger
 * por delay), não por um wrapper único de seção — por isso o default
 * (override ausente) de toda seção fica SEM o wrapper genérico de entrada
 * (ver `wrapperTipo` em Skin.tsx): a fidelidade vem do `Reveal` interno de
 * cada bloco. `entradaOptions` continua oferecendo a troca no editor (o
 * wrapper de seção inteira vira uma opção explícita, não o default).
 *
 * `manifesto` não oferece direção (slide) porque tem um efeito próprio de
 * revelação PROGRESSIVA por scroll (palavra a palavra, ligado/desligado
 * por `Theme.animacao`) que mede a posição da própria seção continuamente;
 * um wrapper com transform mudaria a leitura da posição durante a
 * transição. Sem `typewriter` em nenhuma seção: o material bruto não usa
 * máquina de escrever em título nenhum.
 */
const ENTRADAS: readonly AnimacaoEntrada[] = [
  "nenhuma",
  "fade",
  "deslizar-esquerda",
  "deslizar-direita",
];

const ENTRADAS_SEM_TRANSFORM: readonly AnimacaoEntrada[] = ["nenhuma", "fade"];

export const IMOBILIARIA_SECOES: SkinSecaoDef[] = [
  { id: "hero", nome: "Abertura (hero)", fixa: true },
  { id: "manifesto", nome: "Manifesto", entradaOptions: ENTRADAS_SEM_TRANSFORM },
  { id: "imoveis", nome: "Imóveis em destaque", entradaOptions: ENTRADAS },
  { id: "bairros", nome: "Bairros", entradaOptions: ENTRADAS },
  { id: "como", nome: "Como funciona", alignOptions: ["esquerda", "centro"], entradaOptions: ENTRADAS },
  { id: "depoimento", nome: "Depoimento", entradaOptions: ENTRADAS },
  { id: "contato", nome: "Contato", entradaOptions: ENTRADAS },
];
