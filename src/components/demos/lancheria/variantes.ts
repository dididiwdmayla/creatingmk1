import type { ChapaComposicao, SkinVariante, Theme } from "@/lib/demos/types";
import { criarVariante } from "@/lib/demos/variantes";

import { LANCHERIA_EXEMPLO } from "./exemplo";
import { LANCHERIA_SECOES } from "./secoes";
import { LANCHERIA_THEME_PRESETS } from "./themes";

/**
 * As quatro VARIANTES da `lancheria-chapa-burger` — quatro TIPOS DE CASA,
 * não quatro paletas (ver "Critério de drasticidade" em
 * docs/plano-chapa-burger.md §4/§5).
 *
 * Etapa 1 (fiação mecânica mínima): composição, fundo, ordem e
 * `imagensOcultas` já vêm dos valores fechados no plano; o EXEMPLO ainda é
 * o mesmo das quatro — cópia própria por variante (slogan, textos de
 * seção, `imagensAlt`) é a etapa 2 (item 12). Só o arranjo de seções muda
 * por cima dele aqui.
 *
 * Os PRESETS de paleta são os quatro de sempre (./themes.ts), só trocando
 * de id — `brasa`→`praca`, `diner`→`balcao`, `neon`→`sala`; `chapa` fica
 * inalterado e continua o default (ver "IDs e aliases" §4, espelhado em
 * `themeAliases` no registro).
 */
interface Declaracao {
  id: string;
  nome: string;
  /** O TIPO de casa e o público dele — é o que justifica a composição. */
  descricao: string;
  fundo: "claro" | "escuro";
  /** Id do preset de paleta em ./themes.ts que esta variante herda. */
  presetId: string;
  composicao: ChapaComposicao;
  /** Permutação dos ids de LANCHERIA_SECOES (ver VarianteArranjo). */
  ordem: string[];
  /**
   * Slots de imagem que ESTA composição não desenha, e o aviso que o
   * editor mostra na aba Imagens (ver `SkinVariante.imagensOcultas` e
   * docs/plano-chapa-burger.md §6).
   */
  imagensOcultas?: Record<string, "nenhum" | "so-titulo">;
}

const DECLARACOES: Declaracao[] = [
  {
    id: "chapa",
    nome: "Chapa — Casa de Bairro",
    descricao:
      "Hamburgueria artesanal de rua, humor na marca, pedido por WhatsApp. Quem chega: cliente recorrente que já sabe o nome do lanche e pede na sexta à noite.",
    fundo: "escuro",
    presetId: "chapa",
    composicao: {
      abertura: "cartaz",
      cardapio: "grade",
      bebidas: "trilho",
      acompanhamentos: "trilho",
      contato: "rodape",
    },
    ordem: ["hero", "cardapio", "bebidas", "acompanhamentos", "contato"],
  },
  {
    id: "balcao",
    nome: "Balcão — Smash de Almoço",
    descricao:
      "Balcão de smash no centro, azulejo e aço, cardápio curto, fila na calçada. Quem chega: trabalhador no almoço, decide em 40 segundos, quer preço, horário e endereço antes de sair da mesa.",
    fundo: "claro",
    presetId: "diner",
    composicao: {
      abertura: "ficha",
      cardapio: "comanda",
      bebidas: "chips",
      acompanhamentos: "quadros",
      contato: "tarja",
    },
    ordem: ["hero", "cardapio", "acompanhamentos", "bebidas", "contato"],
    // Comida flutuando não cabe num balcão de azulejo.
    imagensOcultas: {
      "flutuante-bacon": "nenhum",
      "flutuante-queijo": "nenhum",
      "flutuante-bebida": "nenhum",
    },
  },
  {
    id: "sala",
    nome: "Sala — Hamburgueria Autoral",
    descricao:
      "Casa com mesa e serviço, blend assinado, carta de cerveja artesanal. Quem chega: casal jantando fora, ticket alto, lê a descrição inteira antes de escolher.",
    fundo: "escuro",
    presetId: "neon",
    composicao: {
      abertura: "cisao",
      cardapio: "editorial",
      bebidas: "carta",
      acompanhamentos: "linha",
      contato: "fecho",
    },
    ordem: ["hero", "cardapio", "bebidas", "acompanhamentos", "contato"],
    // A carta de bebidas é tipográfica; a casa é sóbria.
    imagensOcultas: {
      "bebida-1": "nenhum",
      "bebida-2": "nenhum",
      "bebida-3": "nenhum",
      "bebida-4": "nenhum",
      "bebida-5": "nenhum",
      "flutuante-bacon": "nenhum",
      "flutuante-queijo": "nenhum",
      "flutuante-bebida": "nenhum",
    },
  },
  {
    id: "praca",
    nome: "Praça — Food Truck",
    descricao:
      "Truck que muda de praça, fim de semana, fila em pé. Quem chega: quem está no evento agora, decide pela foto, com o celular numa mão e a cerveja na outra.",
    fundo: "claro",
    presetId: "brasa",
    composicao: {
      abertura: "pilha",
      cardapio: "mural",
      bebidas: "grade4",
      acompanhamentos: "tira",
      contato: "bloco",
    },
    ordem: ["hero", "contato", "cardapio", "acompanhamentos", "bebidas"],
  },
];

/**
 * Mesmo contrato de seções, mesmo contrato de slots (chaves E valores). A
 * variante só troca defaults — e a trava (`__tests__/variantes.test.tsx`)
 * é quem prova isso, no HTML do servidor, com JavaScript desligado.
 */
export const LANCHERIA_VARIANTES: readonly SkinVariante[] = DECLARACOES.map((d) => {
  const preset = LANCHERIA_THEME_PRESETS.find((t) => t.id === d.presetId)!;
  const theme: Theme = { ...preset, id: d.id, nome: d.nome, chapa: d.composicao };
  return criarVariante(
    {
      id: d.id,
      nome: d.nome,
      descricao: d.descricao,
      fundo: d.fundo,
      theme,
      exemplo: LANCHERIA_EXEMPLO,
      arranjo: { ordem: d.ordem },
      thumbnail: `/demos/lancheria/${d.id}.jpg`,
      ...(d.imagensOcultas && { imagensOcultas: d.imagensOcultas }),
    },
    LANCHERIA_SECOES,
  );
});
