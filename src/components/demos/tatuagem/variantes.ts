import type {
  DemoData,
  DemoSecao,
  SkinVariante,
  TatuagemComposicao,
  Theme,
} from "@/lib/demos/types";
import { criarVariante } from "@/lib/demos/variantes";

import { TATUAGEM_EXEMPLO } from "./exemplo";
import { TATUAGEM_SECOES } from "./secoes";
import { TATUAGEM_THEME_PRESETS } from "./themes";

/**
 * As quatro VARIANTES da `tatuagem-editorial` — quatro TIPOS DE ESTÚDIO,
 * não quatro paletas.
 *
 * A essência está nas quatro: o tom editorial sombrio e o vídeo rodando
 * dentro das letras do título. O que muda é a COMPOSIÇÃO — oito seções
 * mudam de layout entre as quatro, por parâmetro tipado
 * (`TatuagemComposicao`), nunca por um segundo caminho de render.
 *
 * **Os ids não mudam.** `sangue`/`vesperal`/`cripta`/`marfim` já são o que
 * `LeadDemo.themeId` persiste em toda demo publicada desta skin; renomear
 * pediria alias e migração para ganhar nada — os quatro já são nomes
 * próprios. O que muda é o `nome` e a `descricao` que o editor mostra.
 *
 * `sangue` continua sendo o default e carrega o desenho do material bruto:
 * uma das quatro tem de preservar a conversão fiel, senão a migração perde
 * o original em vez de somar três mundos a ele.
 */
interface Declaracao {
  id: string;
  nome: string;
  /** O TIPO de estúdio e o público dele — é o que justifica a composição. */
  descricao: string;
  fundo: "claro" | "escuro";
  composicao: TatuagemComposicao;
  /** Permutação dos ids de TATUAGEM_SECOES (ver VarianteArranjo). */
  ordem: string[];
  slogan: string;
  /** Ajustes de tema que acompanham o mundo (nunca paleta — essa é do preset). */
  tema?: Partial<Theme>;
  /**
   * Slots de imagem que ESTA composição não desenha, e o aviso que o editor
   * mostra na aba Imagens. Upload sem efeito visível parece defeito — ver
   * `SkinVariante.imagensOcultas`. Conferido no navegador, sem JavaScript:
   * o slot declarado aqui tem de medir caixa zero, e o não declarado, caixa
   * maior que zero (`scripts/qa-tatuagem.mjs`).
   */
  imagensOcultas?: Record<string, "nenhum" | "so-titulo">;
  textos: Record<string, Partial<DemoSecao>>;
}

const DECLARACOES: Declaracao[] = [
  {
    id: "sangue",
    nome: "Sangue — Casa de Fechamento",
    descricao:
      "Projetos de grande escala: braço, costas, perna. Para quem está fechando um projeto de meses, não tatuando uma peça — o Processo vem antes do preço.",
    fundo: "escuro",
    composicao: {
      abertura: "monolito", galeria: "mosaico", artista: "retrato", precos: "lista",
      provas: "cartoes", fecho: "centralizado", manifesto: "alternado", protocolo: "linhas",
      faixa: "rolante", foto: "duro", letra: "vazada", letras: 100, veu: 85,
    },
    ordem: ["hero", "sobre", "portfolio", "processo", "investimento", "depoimentos", "statement", "marquee", "contato"],
    slogan: "A pele é o registro.",
    textos: {
      hero: {
        texto: "Fechamentos de braço, costas e perna. Sessões longas, marcadas com muita antecedência.",
        cta: "ABRIR UM PROJETO",
      },
      sobre: { rotulo: "O ARTISTA" },
      portfolio: { rotulo: "ARQUIVO", titulo: "Trabalhos" },
      investimento: { rotulo: "INVESTIMENTO", titulo: "O que fazemos, com agulha e tinta." },
      depoimentos: { rotulo: "DEPOIMENTOS", titulo: "Quem senta na cadeira, volta." },
      processo: { rotulo: "PROTOCOLO", titulo: "O Processo" },
      contato: { titulo: "AGENDAR SESSÃO", cta: "INICIAR CONVERSA" },
    },
  },
  {
    id: "vesperal",
    nome: "Vesperal — Ateliê Autoral",
    descricao:
      "Um artista só, hora marcada, lista de espera. Para quem já escolheu a MÃO e aceita esperar: a página é portfólio pessoal, e o preço não é o argumento.",
    fundo: "escuro",
    composicao: {
      abertura: "cartaz", galeria: "lista", artista: "dossie", precos: "prosa",
      provas: "citacao", fecho: "cartaz", manifesto: "marca", protocolo: "escada",
      faixa: "estatica", foto: "cinza", letra: "vazada", letras: 55, veu: 85,
    },
    ordem: ["hero", "statement", "sobre", "portfolio", "processo", "depoimentos", "investimento", "marquee", "contato"],
    slogan: "Uma agulha. Uma agenda.",
    // A abertura é só tipografia: a foto do hero não entra como fundo, mas
    // continua sendo o que preenche as letras do título.
    imagensOcultas: { hero: "so-titulo" },
    tema: { hover: "brilho" },
    textos: {
      hero: {
        texto: "Ateliê de um artista só, com hora marcada. A lista de espera abre a cada dois meses.",
        cta: "ENTRAR NA LISTA",
      },
      sobre: { rotulo: "QUEM TATUA" },
      statement: { texto: "O QUE FICA NA PELE COMEÇA NO PAPEL." },
      portfolio: { rotulo: "OBRA", titulo: "Peça por peça" },
      investimento: {
        rotulo: "SOBRE VALORES",
        titulo: "Cada peça é orçada depois do estudo.",
      },
      depoimentos: { rotulo: "EM SUAS PALAVRAS", titulo: "Quem esperou, conta." },
      processo: { rotulo: "O RITUAL", titulo: "Como se chega até a agulha" },
      contato: { titulo: "ENTRAR NA LISTA DE ESPERA", cta: "ESCREVER AO ARTISTA" },
    },
  },
  {
    id: "cripta",
    nome: "Cripta — Mural Coletivo",
    descricao:
      "Estúdio de rua com residentes e convidados, flash e walk-in. Para quem quer UMA tatuagem em breve e está comparando: volume de trabalho e preço na primeira varrida.",
    fundo: "escuro",
    composicao: {
      abertura: "cisao", galeria: "mural", artista: "indice", precos: "tabela",
      provas: "tira", fecho: "colunas", manifesto: "bloco", protocolo: "colunas",
      faixa: "rolante", foto: "duro", letra: "vazada", letras: 35, veu: 55,
    },
    ordem: ["hero", "investimento", "portfolio", "marquee", "sobre", "depoimentos", "processo", "statement", "contato"],
    slogan: "Muita mão boa na mesma sala.",
    // O índice de estilos ocupa o lugar do retrato: num coletivo não há UM
    // rosto a mostrar, e a foto do artista não é desenhada.
    imagensOcultas: { sobre: "nenhum" },
    tema: { densidade: "compacta", animacao: "sutil", intro: false },
    textos: {
      hero: {
        texto: "Residentes e convidados, todo estilo, flash toda semana. Walk-in quando tem cadeira livre.",
        cta: "VER A AGENDA",
      },
      sobre: {
        rotulo: "A CASA",
        titulo: "O coletivo",
        texto:
          "Seis tatuadores dividindo a mesma sala há quatro anos, cada um com a própria agenda e o próprio traço.\n\nQuem entra escolhe pelo trabalho, não pelo nome da casa — e é por isso que o mural vem antes de qualquer conversa.",
        itens: [
          { titulo: "Blackwork" },
          { titulo: "Fine Line" },
          { titulo: "Old School" },
          { titulo: "Oriental" },
          { titulo: "Flash" },
        ],
      },
      statement: { texto: "CADA MÃO AQUI TEM UM TRAÇO." },
      portfolio: { rotulo: "MURAL", titulo: "O que sai daqui" },
      investimento: { rotulo: "TABELA", titulo: "Preço na parede, sem surpresa." },
      depoimentos: { rotulo: "QUEM PASSOU", titulo: "Saiu tatuado, falou." },
      processo: { rotulo: "COMO FUNCIONA", titulo: "Do chat à cadeira" },
      contato: { titulo: "CHEGA MAIS", cta: "CHAMAR NO WHATSAPP" },
    },
  },
  {
    id: "marfim",
    nome: "Marfim — Arquivo Claro",
    descricao:
      "Fine line, botânico e ornamental, em papel antes da pele. Para a primeira tatuagem: escolhe por gosto e tem medo do clichê pesado — catálogo de galeria, não porta de loja.",
    fundo: "claro",
    composicao: {
      abertura: "ficha", galeria: "tira", artista: "faixa", precos: "cartoes",
      provas: "empilhado", fecho: "tarja", manifesto: "sussurro", protocolo: "numerado",
      faixa: "estatica", foto: "suave",
      // Paleta clara: `vazada` pintaria creme sobre creme, e é este
      // preenchimento que sai no HTML do servidor quando há vídeo.
      letra: "solida", letras: 70, veu: 30,
    },
    ordem: ["hero", "portfolio", "sobre", "statement", "investimento", "depoimentos", "processo", "marquee", "contato"],
    slogan: "Traço fino, tinta clara, tempo.",
    tema: { densidade: "confortavel", animacao: "sutil", intro: false, hover: "lift" },
    textos: {
      hero: {
        texto: "Fine line, botânico e ornamental. Estudo em papel antes de qualquer agulha.",
        cta: "VER O CATÁLOGO",
      },
      sobre: { rotulo: "NO ATELIÊ" },
      statement: { texto: "COMEÇAR PEQUENO TAMBÉM É COMEÇAR." },
      portfolio: { rotulo: "CATÁLOGO", titulo: "Folheie o arquivo" },
      investimento: { rotulo: "VALORES", titulo: "Tudo com preço à vista." },
      depoimentos: { rotulo: "PRIMEIRA VEZ", titulo: "Era a primeira, e deu certo." },
      processo: { rotulo: "PASSO A PASSO", titulo: "Sem susto, do começo ao fim" },
      contato: { titulo: "MARCAR UMA CONVERSA", cta: "FALAR SEM COMPROMISSO" },
    },
  },
];

/**
 * Mesmo contrato de seções, mesmo contrato de slots (chaves E valores), o
 * mesmo `<h1>` dentro da abertura. A variante só troca defaults — e a
 * trava (`__tests__/variantes.test.tsx`) é quem prova isso, no HTML do
 * servidor, com JavaScript desligado.
 */
export const TATUAGEM_VARIANTES: readonly SkinVariante[] = DECLARACOES.map((d) => {
  const preset = TATUAGEM_THEME_PRESETS.find((t) => t.id === d.id)!;
  const exemplo: DemoData = {
    ...TATUAGEM_EXEMPLO,
    slogan: d.slogan,
    secoes: Object.fromEntries(
      Object.entries(TATUAGEM_EXEMPLO.secoes).map(([id, secao]) => [
        id,
        { ...secao, ...d.textos[id] },
      ]),
    ),
  };
  return criarVariante(
    {
      id: d.id,
      nome: d.nome,
      descricao: d.descricao,
      fundo: d.fundo,
      theme: { ...preset, ...d.tema, nome: d.nome, tatuagem: d.composicao },
      exemplo,
      arranjo: { ordem: d.ordem },
      thumbnail: `/demos/tatuagem/${d.id}.jpg`,
      ...(d.imagensOcultas && { imagensOcultas: d.imagensOcultas }),
    },
    TATUAGEM_SECOES,
  );
});
