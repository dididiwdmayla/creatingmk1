import type { AnimacaoEntrada, SkinSecaoDef } from "@/lib/demos/types";

/**
 * Contrato de seções da skin de barbearia, na ordem default de render.
 * O editor usa esta lista para reordenar/ocultar e oferecer alinhamento;
 * a skin renderiza pela ordem efetiva (ver lib/demos/estrutura.ts).
 *
 * `hero` é fixa (é a tela de abertura, com o header por cima). As demais
 * são reordenáveis e ocultáveis. `alignOptions` só onde o layout aguenta
 * trocar o alinhamento sem quebrar (grades de itens e blocos de texto) —
 * nada de posicionamento livre: o template continua responsivo.
 *
 * `entradaOptions`: animações de entrada no scroll que cada seção aceita
 * (override do comportamento default do template — ver Skin.tsx).
 * "typewriter" só onde a seção tem título/citação que a skin sabe animar.
 * A seção Serviços tem sidebar `position: sticky` por dentro — um wrapper
 * com transform quebraria o sticky (ver SectionReveal), então ela só
 * declara opções SEM transform (fade/typewriter).
 */
const ENTRADAS: readonly AnimacaoEntrada[] = [
  "nenhuma",
  "fade",
  "deslizar-esquerda",
  "deslizar-direita",
  "typewriter",
];

const ENTRADAS_SEM_TITULO: readonly AnimacaoEntrada[] = [
  "nenhuma",
  "fade",
  "deslizar-esquerda",
  "deslizar-direita",
];

export const BARBEARIA_SECOES: SkinSecaoDef[] = [
  { id: "hero", nome: "Abertura (hero)", fixa: true },
  { id: "agendamentoRapido", nome: "Agendamento rápido", entradaOptions: ENTRADAS_SEM_TITULO },
  {
    id: "filosofia",
    nome: "Filosofia",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
  { id: "servicos", nome: "Serviços", entradaOptions: ["nenhuma", "fade", "typewriter"] },
  {
    id: "equipe",
    nome: "Equipe",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
  { id: "ritual", nome: "Ritual (citação)", entradaOptions: ENTRADAS },
  {
    id: "depoimentos",
    nome: "Depoimentos",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
  {
    id: "agendamento",
    nome: "Como funciona",
    alignOptions: ["esquerda", "centro"],
    entradaOptions: ENTRADAS,
  },
  { id: "contato", nome: "Contato", entradaOptions: ENTRADAS },
];
