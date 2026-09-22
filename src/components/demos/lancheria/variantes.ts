import type {
  ChapaComposicao,
  DemoData,
  DemoSecao,
  DemoServico,
  SkinVariante,
  Theme,
} from "@/lib/demos/types";
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
 * Cada variante tem o SEU preset de paleta e tipografia (./themes.ts), com
 * o mesmo id dela. Os ids antigos (`brasa`, `diner`, `neon`) continuam
 * abrindo, na variante de mesma LUMINÂNCIA, por `themeAliases` no registro
 * (ver "IDs e aliases" §4 do plano) — nenhuma demo publicada troca de
 * claro para escuro.
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
  /**
   * O cardápio de exemplo desta casa. **Sempre SEIS**, como o exemplo base:
   * cada lanche desenha o slot `lanche-N`, e uma variante com cinco deixaria
   * `lanche-6` sem caixa nenhuma — um slot que o editor oferece e a página
   * nunca mostra. É a mesma razão pela qual bebidas continuam cinco e
   * acompanhamentos, quatro.
   */
  servicos?: DemoServico[];
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
    // A cópia desta variante é a do material bruto — ela É o exemplo base.
  },
  {
    id: "balcao",
    nome: "Balcão — Smash de Almoço",
    descricao:
      "Balcão de smash no centro, azulejo e aço, cardápio curto, fila na calçada. Quem chega: trabalhador no almoço, decide em 40 segundos, quer preço, horário e endereço antes de sair da mesa.",
    fundo: "claro",
    presetId: "balcao",
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
    slogan: "Smash na chapa, pronto em cinco minutos.",
    servicos: [
      {
        nome: "Smash Duplo",
        preco: "",
        precoValor: 26,
        descricao: "Dois discos de 90g prensados na chapa, cheddar, cebola e molho da casa no pão de batata.",
      },
      {
        nome: "Smash Simples",
        preco: "",
        precoValor: 19,
        descricao: "Um disco de 90g, cheddar derretido e picles. O de sempre, o de todo dia.",
      },
      {
        nome: "Smash Bacon",
        preco: "",
        precoValor: 29,
        descricao: "Dois discos, bacon crocante e cheddar duplo. Pra quem pulou o café da manhã.",
      },
      {
        nome: "Smash Salada",
        preco: "",
        precoValor: 22,
        descricao: "Disco de 90g, alface, tomate e maionese verde. Leve, mas ainda é smash.",
      },
      {
        nome: "Frango na Chapa",
        preco: "",
        precoValor: 24,
        descricao: "Filé de frango prensado, queijo prato e molho de mostarda com mel.",
      },
      {
        nome: "Smash Veggie",
        preco: "",
        precoValor: 23,
        descricao: "Disco de grão-de-bico prensado na chapa, queijo prato e rúcula.",
      },
    ],
    textos: {
      hero: {
        texto: "Chapa quente das 11h às 15h. Pede no balcão, come em pé ou leva pro escritório.",
        cta: "VER A COMANDA",
      },
      cardapio: { rotulo: "COMANDA", titulo: "Hoje na chapa" },
      bebidas: {
        rotulo: "BEBIDAS",
        titulo: "Pra descer",
        itens: [
          { titulo: "Refrigerante lata", subtitulo: "R$ 6,00" },
          { titulo: "Suco de laranja", subtitulo: "R$ 8,00" },
          { titulo: "Água com gás", subtitulo: "R$ 5,00" },
          { titulo: "Limonada suíça", subtitulo: "R$ 7,00" },
          { titulo: "Café coado", subtitulo: "R$ 4,00" },
        ],
      },
      acompanhamentos: {
        rotulo: "PRA ACOMPANHAR",
        titulo: "Fecha o combo",
        itens: [
          { titulo: "Batata frita", subtitulo: "R$ 12,00" },
          { titulo: "Batata com cheddar", subtitulo: "R$ 18,00" },
          { titulo: "Anéis de cebola", subtitulo: "R$ 14,00" },
          { titulo: "Salada de repolho", subtitulo: "R$ 8,00" },
        ],
      },
      contato: {
        rotulo: "CONTATO",
        titulo: "Onde fica o balcão",
        cta: "Chamar no WhatsApp",
        texto: "SEG A SEX, 11H ÀS 15H",
      },
    },
  },
  {
    id: "sala",
    nome: "Sala — Hamburgueria Autoral",
    descricao:
      "Casa com mesa e serviço, blend assinado, carta de cerveja artesanal. Quem chega: casal jantando fora, ticket alto, lê a descrição inteira antes de escolher.",
    fundo: "escuro",
    presetId: "sala",
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
    slogan: "Blend próprio, maturado sete dias.",
    servicos: [
      {
        nome: "Blend da Casa",
        preco: "",
        precoValor: 58,
        descricao:
          "Acém, peito e costela moídos na hora, 180g, selados na chapa de ferro. Queijo prato curado, cebola confitada no próprio gordura e maionese de ervas, no pão de leite assado aqui.",
      },
      {
        nome: "Costela e Café",
        preco: "",
        precoValor: 72,
        descricao:
          "Costela desfiada em cocção lenta de seis horas, finalizada com um caramelo de café e melado. Queijo canastra, picles de cebola roxa e pão australiano.",
      },
      {
        nome: "Brie e Pera",
        preco: "",
        precoValor: 68,
        descricao:
          "Blend de 180g, brie derretido na chapa, pera assada com tomilho e rúcula. O doce da fruta corta a gordura — é o lanche que costuma surpreender quem pede.",
      },
      {
        nome: "Dry Aged 45",
        preco: "",
        precoValor: 89,
        descricao:
          "Maturação a seco de 45 dias, 200g, sal grosso e mais nada por cima. Queijo gruyère, cebola crua e pão de fermentação natural. Quantidade limitada por noite.",
      },
      {
        nome: "Cordeiro e Hortelã",
        preco: "",
        precoValor: 76,
        descricao:
          "Paleta de cordeiro moída na hora, 180g, iogurte de hortelã, cebola roxa e pepino em conserva. Pão de azeite, levemente tostado na manteiga.",
      },
      {
        nome: "Beterraba Defumada",
        preco: "",
        precoValor: 54,
        descricao:
          "Beterraba defumada no bafo e grão-de-bico, 160g, queijo de castanha, tomate confitado e agrião. Feito na mesma chapa, com o mesmo cuidado dos outros.",
      },
    ],
    textos: {
      hero: {
        texto: "Casa com mesa, serviço e carta de cerveja artesanal. Reserva pelo WhatsApp.",
        cta: "VER O MENU",
      },
      cardapio: { rotulo: "MENU", titulo: "Os nossos cortes" },
      bebidas: {
        rotulo: "CARTA",
        titulo: "Cervejas e vinhos",
        itens: [
          { titulo: "IPA da casa, 500ml", subtitulo: "R$ 28,00" },
          { titulo: "Pilsen tcheca, 500ml", subtitulo: "R$ 24,00" },
          { titulo: "Stout de café, 330ml", subtitulo: "R$ 32,00" },
          { titulo: "Tinto da casa, taça", subtitulo: "R$ 34,00" },
          { titulo: "Kombucha de hibisco", subtitulo: "R$ 18,00" },
        ],
      },
      acompanhamentos: {
        rotulo: "ACOMPANHA",
        titulo: "Para dividir",
        itens: [
          { titulo: "Batata rústica com alecrim", subtitulo: "R$ 26,00" },
          { titulo: "Aipim frito com aioli", subtitulo: "R$ 24,00" },
          { titulo: "Salada verde da estação", subtitulo: "R$ 22,00" },
          { titulo: "Pão de alho na brasa", subtitulo: "R$ 19,00" },
        ],
      },
      contato: {
        rotulo: "CONTATO",
        titulo: "Reservar uma mesa",
        cta: "Falar com a casa",
        texto: "COZINHA ABERTA ATÉ 23H",
      },
    },
  },
  {
    id: "praca",
    nome: "Praça — Food Truck",
    descricao:
      "Truck que muda de praça, fim de semana, fila em pé. Quem chega: quem está no evento agora, decide pela foto, com o celular numa mão e a cerveja na outra.",
    fundo: "claro",
    presetId: "praca",
    composicao: {
      abertura: "pilha",
      cardapio: "mural",
      bebidas: "grade4",
      acompanhamentos: "tira",
      contato: "bloco",
    },
    ordem: ["hero", "contato", "cardapio", "acompanhamentos", "bebidas"],
    slogan: "O truck muda de praça. O lanche não.",
    servicos: [
      {
        nome: "Truck Clássico",
        preco: "",
        precoValor: 28,
        descricao: "160g na brasa, queijo prato, alface e tomate. O primeiro que a gente fez.",
      },
      {
        nome: "Cheddar Melt",
        preco: "",
        precoValor: 34,
        descricao: "160g, cheddar derretido por cima e por baixo, cebola caramelizada.",
      },
      {
        nome: "Bacon na Brasa",
        preco: "",
        precoValor: 36,
        descricao: "160g, bacon grelhado na hora e barbecue defumado no pão australiano.",
      },
      {
        nome: "Duplo da Praça",
        preco: "",
        precoValor: 39,
        descricao: "Dois discos de 120g, queijo duplo e picles. Não cabe numa mão só.",
      },
      {
        nome: "Frango Empanado",
        preco: "",
        precoValor: 30,
        descricao: "Sobrecoxa empanada na hora, maionese de limão e repolho crocante.",
      },
      {
        nome: "Grão e Brasa",
        preco: "",
        precoValor: 27,
        descricao: "Disco de grão-de-bico na brasa, queijo prato e tomate assado.",
      },
    ],
    textos: {
      hero: {
        texto: "Sexta e sábado, de praça em praça. Segue pra saber onde a gente para hoje.",
        cta: "VER O QUE TEM HOJE",
      },
      cardapio: { rotulo: "NA JANELA", titulo: "O que sai do truck" },
      bebidas: {
        rotulo: "GELADAS",
        titulo: "Tirado do gelo",
        itens: [
          { titulo: "Cerveja long neck", subtitulo: "R$ 12,00" },
          { titulo: "Refrigerante lata", subtitulo: "R$ 7,00" },
          { titulo: "Suco de maracujá", subtitulo: "R$ 10,00" },
          { titulo: "Água de coco", subtitulo: "R$ 9,00" },
          { titulo: "Água mineral", subtitulo: "R$ 5,00" },
        ],
      },
      acompanhamentos: {
        rotulo: "PRA DIVIDIR",
        titulo: "Vai junto",
        itens: [
          { titulo: "Fritas na caixa", subtitulo: "R$ 18,00" },
          { titulo: "Fritas com bacon", subtitulo: "R$ 26,00" },
          { titulo: "Anéis de cebola", subtitulo: "R$ 20,00" },
          { titulo: "Nuggets caseiros", subtitulo: "R$ 16,00" },
        ],
      },
      contato: {
        rotulo: "CONTATO",
        titulo: "Onde estamos hoje",
        cta: "Ver a localização",
        texto: "SIGA O TRUCK",
      },
    },
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
    ...(d.servicos && { servicos: d.servicos }),
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
