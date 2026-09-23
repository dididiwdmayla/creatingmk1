import type {
  DemoData,
  DemoSecao,
  DemoServico,
  MultimarcasComposicao,
  SkinVariante,
  Theme,
} from "@/lib/demos/types";
import { criarVariante } from "@/lib/demos/variantes";

import { MULTIMARCAS_EXEMPLO } from "./exemplo";
import { MULTIMARCAS_SECOES } from "./secoes";
import { MULTIMARCAS_THEME_PRESETS } from "./themes";

/**
 * As quatro VARIANTES da `multimarcas-vortice` — quatro TIPOS DE LOJA, não
 * quatro paletas (ver "As quatro variantes" e "Critério de drasticidade"
 * em docs/plano-multimarcas.md §4/§6).
 *
 * Cada declaração carrega TRÊS camadas (o molde da chapa burger):
 *
 *   1. a COMPOSIÇÃO (os nove knobs de `MultimarcasComposicao`) + o arranjo
 *      de seções + os slots que ela não desenha (`imagensOcultas`, §8);
 *   2. `tema` — o que acompanha o mundo visual e não é paleta: intro,
 *      hover, densidade, raio, alinhamento da abertura. Paleta e
 *      tipografia vêm do preset (./themes.ts);
 *   3. `slogan`/`textos`/`servicos` — a cópia de exemplo própria da
 *      variante, gravada por cima do exemplo BASE. Chaves e slots
 *      continuam os mesmos: o exemplo é um só contrato, e a trava
 *      (`__tests__/variantes.test.tsx`) compara as quatro entre si.
 *
 * O ALINHAMENTO da abertura entra aqui, e não na folha de composição, de
 * propósito: `heroTitulo.alinhamento` é controle do OPERADOR na aba Tema.
 * A composição tem opinião (a sangrada é um cartaz centrado; as outras três
 * leem da esquerda), mas ela é o VALOR INICIAL de um campo editável.
 *
 * A INTRO (o preloader do velocímetro) nasce ligada só na `vortice`, fiel
 * ao material bruto; o Pátio vende pressa, e as outras duas também abrem
 * direto (§6, "Intro"). Continua editável na aba Tema.
 *
 * IDs e aliases (§4): os ids ANTIGOS de preset (`azul-classico`, `grafite`,
 * `meia-noite`) viram os ids NOVOS de variante (`patio`, `garagem`,
 * `campo`) por `SkinDefinition.themeAliases`, mapeados por FUNDO — nenhuma
 * demo publicada troca de luminância. `vortice` fica com o mesmo id (é o
 * default e a conversão fiel do material bruto).
 */
interface Declaracao {
  /** Id novo da variante (§4). */
  id: string;
  nome: string;
  /** O tipo de loja e o público dela — é o que justifica a composição futura. */
  descricao: string;
  fundo: "claro" | "escuro";
  /** Id do preset de paleta/tipografia em ./themes.ts (o mesmo da variante). */
  presetId: string;
  /** Os nove knobs de desenho (§6 do plano) — o que faz a variante ser um TIPO DE LOJA. */
  composicao: MultimarcasComposicao;
  /** Permutação COMPLETA dos ids de MULTIMARCAS_SECOES, incluindo "hero" (ver VarianteArranjo). */
  ordem: readonly string[];
  imagensOcultas?: Record<string, "nenhum" | "so-titulo">;
  /** Ajustes de tema que acompanham o mundo — nunca paleta (essa é do preset). */
  tema?: Partial<Theme>;
  /** Cópia de exemplo própria da variante (item 21). */
  slogan?: string;
  /** Textos de seção próprios, gravados por cima do exemplo BASE (item 21). */
  textos?: Record<string, Partial<DemoSecao>>;
  /**
   * O estoque de exemplo desta loja. **Sempre NOVE carros**, como o exemplo
   * base: cada um desenha o slot `carro-N`, e uma variante com oito
   * deixaria `carro-9` sem caixa — um slot que o editor oferece e a página
   * nunca mostra.
   */
  servicos?: DemoServico[];
  /** Depoimentos próprios (o `contexto` é o carro, e o carro é da loja). */
  depoimentos?: DemoData["depoimentos"];
  /** Alts próprios — os carros mudam, e o alt descreve o carro. */
  imagensAlt?: Record<string, string>;
}

/** Valor inicial do campo "alinhamento" da aba Tema, por abertura. */
const ALINHAMENTO_DA_ABERTURA: Record<MultimarcasComposicao["abertura"], "esquerda" | "centro"> = {
  tipografica: "esquerda",
  busca: "esquerda",
  sangrada: "centro",
  dividida: "esquerda",
};

const DECLARACOES: readonly Declaracao[] = [
  {
    id: "vortice",
    nome: "Vórtice — Seminovos Premium",
    descricao:
      "Loja de seminovos de 80–150 mil com laudo e garantia. Quem chega: comprador racional que compara três lojas e decide por procedência. Conversão fiel do material bruto; continua o default.",
    fundo: "claro",
    presetId: "vortice",
    tema: { intro: true },
    composicao: {
      abertura: "tipografica",
      estoque: "grade",
      vantagens: "grade",
      numeros: "linha",
      destaque: "cartao",
      simulador: "cartoes",
      avaliacao: "faixa",
      depoimentos: "carrossel",
      contato: "rodape",
    },
    ordem: ["hero", "estoque", "vantagens", "numeros", "destaque", "simulador", "avaliacao", "depoimentos", "contato"],
    // Abertura tipográfica, fiel ao original — sem foto (§8).
    imagensOcultas: { hero: "nenhum" },
  },
  {
    id: "patio",
    nome: "Pátio — Loja de Bairro",
    descricao:
      "Pátio de populares e primeiro carro, até 70 mil, faixa na calçada. Quem chega: quem compra pela parcela e não pelo preço, no celular, entre um compromisso e outro.",
    fundo: "claro",
    presetId: "patio",
    // O Pátio vende pressa: sem intro (a página densa vem do preset).
    tema: { intro: false, hover: "lift" },
    composicao: {
      abertura: "busca",
      estoque: "lista",
      vantagens: "faixa",
      numeros: "selos",
      destaque: "tira",
      simulador: "coluna",
      avaliacao: "tarja",
      depoimentos: "empilhado",
      contato: "tarja",
    },
    ordem: ["hero", "estoque", "simulador", "avaliacao", "destaque", "numeros", "vantagens", "depoimentos", "contato"],
    // A abertura é a busca por faixa de preço — sem foto (§8).
    imagensOcultas: { hero: "nenhum" },
  },
  {
    id: "garagem",
    nome: "Garagem — Boutique de Esportivos",
    descricao:
      "Poucos carros, cada um um evento: esportivos, importados, clássicos. Quem chega: entusiasta que lê a ficha técnica inteira antes de mandar a primeira mensagem.",
    fundo: "escuro",
    presetId: "garagem",
    // Cada carro um evento: hover que brilha, clique que pulsa.
    tema: { intro: false, hover: "brilho", clique: "pulso" },
    composicao: {
      abertura: "sangrada",
      estoque: "vitrine",
      vantagens: "editorial",
      numeros: "coluna",
      destaque: "catalogo",
      simulador: "painel",
      avaliacao: "linha",
      depoimentos: "citacao",
      contato: "fecho",
    },
    ordem: ["hero", "destaque", "estoque", "depoimentos", "vantagens", "numeros", "avaliacao", "simulador", "contato"],
    // Desenha os onze slots (§8) — foto sangrada na abertura.
  },
  {
    id: "campo",
    nome: "Campo — Picapes e Utilitários",
    descricao:
      "Loja de picape, SUV 4×4 e utilitário no interior. Quem chega: produtor ou empresa que troca a caminhonete velha na compra da nova — a troca é o assunto.",
    fundo: "escuro",
    presetId: "campo",
    tema: { intro: false, hover: "lift" },
    composicao: {
      abertura: "dividida",
      estoque: "tabela",
      vantagens: "quadrantes",
      numeros: "placar",
      destaque: "ficha",
      simulador: "lateral",
      avaliacao: "formulario",
      depoimentos: "tira",
      contato: "bloco",
    },
    ordem: ["hero", "avaliacao", "estoque", "destaque", "numeros", "simulador", "vantagens", "depoimentos", "contato"],
    // Desenha os onze slots (§8) — abertura dividida, com foto.
  },
];

/**
 * Mesmo contrato de seções, mesmo contrato de slots (chaves E valores de
 * `imagens`). A variante só troca defaults — e a trava
 * (`__tests__/variantes.test.tsx`) é quem prova isso, no HTML do servidor.
 */
export const MULTIMARCAS_VARIANTES: readonly SkinVariante[] = DECLARACOES.map((d) => {
  const preset = MULTIMARCAS_THEME_PRESETS.find((t) => t.id === d.presetId)!;
  const theme: Theme = {
    ...preset,
    ...d.tema,
    id: d.id,
    nome: d.nome,
    multimarcas: d.composicao,
    heroTitulo: {
      ...preset.heroTitulo,
      ...d.tema?.heroTitulo,
      alinhamento: d.tema?.heroTitulo?.alinhamento ?? ALINHAMENTO_DA_ABERTURA[d.composicao.abertura],
    },
  };
  const exemplo: DemoData = {
    ...MULTIMARCAS_EXEMPLO,
    ...(d.slogan && { slogan: d.slogan }),
    ...(d.servicos && { servicos: d.servicos }),
    ...(d.depoimentos && { depoimentos: d.depoimentos }),
    ...(d.imagensAlt && { imagensAlt: { ...MULTIMARCAS_EXEMPLO.imagensAlt, ...d.imagensAlt } }),
    secoes: Object.fromEntries(
      Object.entries(MULTIMARCAS_EXEMPLO.secoes).map(([id, secao]) => [id, { ...secao, ...d.textos?.[id] }]),
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
      thumbnail: `/demos/multimarcas/${d.id}.jpg`,
      ...(d.imagensOcultas && { imagensOcultas: d.imagensOcultas }),
    },
    MULTIMARCAS_SECOES,
  );
});
