import type { ChapaComposicao, DemoData, DemoSecao, SkinVariante, Theme } from "@/lib/demos/types";
import { criarVariante } from "@/lib/demos/variantes";

import { LANCHERIA_EXEMPLO } from "./exemplo";
import { LANCHERIA_SECOES } from "./secoes";
import { LANCHERIA_THEME_PRESETS } from "./themes";

/**
 * As quatro VARIANTES da `lancheria-chapa-burger` — quatro TIPOS DE CASA,
 * não quatro paletas (ver "Critério de drasticidade" em
 * docs/plano-chapa-burger.md §4/§5).
 *
 * Cada declaração carrega TRÊS camadas, e só a primeira é obrigatória:
 *
 *   1. a COMPOSIÇÃO (os cinco knobs) + o arranjo de seções;
 *   2. `tema` — o que acompanha o mundo visual e não é paleta: alinhamento
 *      da abertura, densidade, hover, raio. Paleta e tipografia vêm do
 *      preset (./themes.ts);
 *   3. `slogan`/`textos` — a cópia de exemplo própria da variante, gravada
 *      por cima do exemplo BASE. Chaves e slots continuam os mesmos: o
 *      exemplo é um só contrato, e a trava (`__tests__/variantes.test.tsx`)
 *      compara as quatro entre si.
 *
 * O ALINHAMENTO da abertura entra aqui, e não na folha de composição, de
 * propósito: `heroTitulo.alinhamento` é controle do OPERADOR na aba Tema.
 * A composição tem opinião (a ficha e a cisão são desenhos de leitura à
 * esquerda; o cartaz e a pilha são cartazes centrados), mas ela é o VALOR
 * INICIAL de um campo editável — não uma regra de folha que o operador não
 * conseguiria vencer.
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
  /** Ajustes de tema que acompanham o mundo — nunca paleta (essa é do preset). */
  tema?: Partial<Theme>;
  /** Cópia de exemplo própria da variante (item 12). */
  slogan?: string;
  /** Textos de seção próprios, gravados por cima do exemplo BASE (item 12). */
  textos?: Record<string, Partial<DemoSecao>>;
}

/** Valor inicial do campo "alinhamento" da aba Tema, por abertura. */
const ALINHAMENTO_DA_ABERTURA: Record<ChapaComposicao["abertura"], "esquerda" | "centro"> = {
  cartaz: "centro",
  ficha: "esquerda",
  cisao: "esquerda",
  pilha: "centro",
};

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
  const theme: Theme = {
    ...preset,
    ...d.tema,
    id: d.id,
    nome: d.nome,
    chapa: d.composicao,
    heroTitulo: {
      ...preset.heroTitulo,
      ...d.tema?.heroTitulo,
      alinhamento: d.tema?.heroTitulo?.alinhamento ?? ALINHAMENTO_DA_ABERTURA[d.composicao.abertura],
    },
  };
  const exemplo: DemoData = {
    ...LANCHERIA_EXEMPLO,
    ...(d.slogan && { slogan: d.slogan }),
    secoes: Object.fromEntries(
      Object.entries(LANCHERIA_EXEMPLO.secoes).map(([id, secao]) => [
        id,
        { ...secao, ...d.textos?.[id] },
      ]),
    ),
  };
  return criarVariante(
    {
      id: d.id,
      nome: d.nome,
      descricao: d.descricao,
      fundo: d.fundo,
      theme,
      exemplo,
      arranjo: { ordem: d.ordem },
      thumbnail: `/demos/lancheria/${d.id}.jpg`,
      ...(d.imagensOcultas && { imagensOcultas: d.imagensOcultas }),
    },
    LANCHERIA_SECOES,
  );
});
