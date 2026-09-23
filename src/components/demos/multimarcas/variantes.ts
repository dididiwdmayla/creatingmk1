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
    slogan: "Seu primeiro carro cabe na parcela.",
    servicos: [
      {
        nome: "Fiat Mobi Like",
        preco: "",
        precoValor: 42900,
        categoria: "Hatch",
        destaques: [
          "2021",
          "48.300 km",
          "Manual",
          "Flex"
        ],
        descricao: "Motor 1.0 · Cor Branco Banchisa · Dono único"
      },
      {
        nome: "VW Gol 1.0",
        preco: "",
        precoValor: 39900,
        categoria: "Hatch",
        destaques: [
          "2020",
          "61.200 km",
          "Manual",
          "Flex"
        ],
        descricao: "Motor 1.0 MPI · Cor Prata Sirius · Revisões em dia"
      },
      {
        nome: "Chevrolet Onix Plus LT",
        preco: "",
        precoValor: 64900,
        categoria: "Sedan",
        destaques: [
          "2021",
          "44.800 km",
          "Manual",
          "Flex"
        ],
        descricao: "Motor 1.0 · Cor Cinza Satin · Porta-malas de 469 L"
      },
      {
        nome: "Hyundai HB20S Vision",
        preco: "",
        precoValor: 61900,
        categoria: "Sedan",
        destaques: [
          "2021",
          "39.500 km",
          "Automático",
          "Flex"
        ],
        descricao: "Motor 1.0 · Cor Preto Onyx · Central multimídia"
      },
      {
        nome: "Renault Duster Zen",
        preco: "",
        precoValor: 67900,
        categoria: "SUV",
        destaques: [
          "2020",
          "58.900 km",
          "Manual",
          "Flex"
        ],
        descricao: "Motor 1.6 · Cor Branco Glacier · Altura boa para rua de terra"
      },
      {
        nome: "Nissan Kicks S",
        preco: "",
        precoValor: 69900,
        categoria: "SUV",
        destaques: [
          "2019",
          "63.400 km",
          "CVT",
          "Flex"
        ],
        descricao: "Motor 1.6 · Cor Vermelho Malbec · Câmera de ré"
      },
      {
        nome: "Fiat Strada Freedom",
        preco: "",
        precoValor: 68900,
        categoria: "Picape",
        destaques: [
          "2021",
          "52.100 km",
          "Manual",
          "Flex"
        ],
        descricao: "Cabine plus · Motor 1.3 · Caçamba com protetor"
      },
      {
        nome: "VW Saveiro Robust",
        preco: "",
        precoValor: 58900,
        categoria: "Picape",
        destaques: [
          "2020",
          "67.700 km",
          "Manual",
          "Flex"
        ],
        descricao: "Cabine simples · Motor 1.6 · Pronta para trabalho"
      },
      {
        nome: "Peugeot 208 Active",
        preco: "",
        precoValor: 54900,
        categoria: "Hatch",
        destaques: [
          "2021",
          "41.200 km",
          "Manual",
          "Flex"
        ],
        descricao: "Motor 1.6 · Cor Azul Ice · Econômico na cidade"
      }
    ],
    depoimentos: [
      {
        autor: "Juliana Prado",
        contexto: "Fiat Mobi Like 2021",
        texto: "Primeiro carro, e a parcela coube certinho no salário. Saí dirigindo na mesma tarde."
      },
      {
        autor: "Marcos Vinícius",
        contexto: "VW Gol 1.0 2020",
        texto: "Mandei mensagem no intervalo do almoço, à noite já tinha a simulação. Sem enrolação."
      },
      {
        autor: "Aline Souza",
        contexto: "Hyundai HB20S Vision 2021",
        texto: "Deram meu carro velho na entrada e a diferença virou parcela pequena."
      },
      {
        autor: "Roberto Lima",
        contexto: "Fiat Strada Freedom 2021",
        texto: "Precisava de uma picape pra trabalhar. Preço justo e documentação pronta em dois dias."
      },
      {
        autor: "Camila Torres",
        contexto: "Nissan Kicks S 2019",
        texto: "Explicaram cada número da parcela. Nada de surpresa depois."
      }
    ],
    imagensAlt: {
      hero: "Pátio de carros populares com faixa de preço na calçada",
      destaque: "Chevrolet Onix Plus LT 2021, a oferta da semana",
      "carro-1": "Fiat Mobi Like",
      "carro-2": "VW Gol 1.0",
      "carro-3": "Chevrolet Onix Plus LT",
      "carro-4": "Hyundai HB20S Vision",
      "carro-5": "Renault Duster Zen",
      "carro-6": "Nissan Kicks S",
      "carro-7": "Fiat Strada Freedom",
      "carro-8": "VW Saveiro Robust",
      "carro-9": "Peugeot 208 Active"
    },
    textos: {
      hero: {
        rotulo: "CARRO BOM ATÉ 70 MIL",
        texto: "Escolha pela parcela, não pelo preço. Aprovação no mesmo dia e seu usado vale como entrada.",
        cta: "Ver estoque",
        ctaSecundaria: "Simular no WhatsApp"
      },
      estoque: {
        rotulo: "ESTOQUE",
        titulo: "Cabe no seu bolso",
        texto: "Revisado e com garantia",
        cta: "Quero esse",
        ctaSecundaria: "Ver mais"
      },
      simulador: {
        rotulo: "SIMULE AGORA",
        titulo: "Quanto fica a parcela?",
        texto: "Mexa nos valores. A conta sai na hora.",
        cta: "Quero essa parcela"
      },
      avaliacao: {
        rotulo: "SEU USADO VALE ENTRADA",
        titulo: "Traga o seu carro",
        texto: "Avaliação na hora, com o valor abatido na entrada.",
        cta: "Avaliar meu carro",
        itens: [
          { titulo: "Fiat" },
          { titulo: "Volkswagen" },
          { titulo: "Chevrolet" },
          { titulo: "Hyundai" },
          { titulo: "Renault" },
          { titulo: "Ford" },
          { titulo: "Nissan" },
          { titulo: "Peugeot" }
        ]
      },
      destaque: {
        rotulo: "OFERTA DA SEMANA",
        titulo: "Chevrolet Onix Plus LT 2021",
        texto: "Sedã econômico, dono único, com a parcela mais procurada do pátio.",
        cta: "Quero a oferta",
        itens: [
          { titulo: "Ano", texto: "2021" },
          { titulo: "Km", texto: "44.800" },
          { titulo: "Câmbio", texto: "Manual" },
          { titulo: "Entrada", texto: "a partir de 20%" }
        ]
      },
      numeros: {
        itens: [
          { titulo: "48×", detalhe: "parcelas no financiamento" },
          { titulo: "1 dia", detalhe: "para aprovar o crédito" },
          { titulo: "3 meses", detalhe: "de garantia de motor e câmbio" }
        ]
      },
      vantagens: {
        rotulo: "POR QUE AQUI",
        titulo: "Sem enrolação.",
        itens: [
          { titulo: "Parcela primeiro", texto: "A gente começa pelo quanto cabe no mês." },
          { titulo: "Usado na entrada", texto: "Seu carro vira entrada, avaliado na hora." },
          { titulo: "Crédito rápido", texto: "Resposta do banco no mesmo dia." },
          { titulo: "Tudo revisado", texto: "Revisão feita antes de ir para o pátio." }
        ]
      },
      depoimentos: {
        rotulo: "QUEM COMPROU",
        titulo: "Saiu dirigindo"
      },
      contato: {
        rotulo: "PASSE AQUI",
        titulo: "Vem ver de perto",
        cta: "Chamar no WhatsApp",
        texto: "Valores e condições ilustrativos."
      }
    },
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
    slogan: "Poucos carros. Cada um, um evento.",
    servicos: [
      {
        nome: "Mini Cooper S",
        preco: "",
        precoValor: 189900,
        categoria: "Hatch",
        destaques: [
          "2021",
          "18.400 km",
          "Automático",
          "Gasolina"
        ],
        descricao: "Motor 2.0 Turbo · 192 cv · Cor British Racing Green"
      },
      {
        nome: "VW Golf GTI",
        preco: "",
        precoValor: 219900,
        categoria: "Hatch",
        destaques: [
          "2020",
          "22.700 km",
          "DSG",
          "Gasolina"
        ],
        descricao: "Motor 2.0 TSI · 230 cv · Bancos xadrez originais"
      },
      {
        nome: "BMW 330i M Sport",
        preco: "",
        precoValor: 289900,
        categoria: "Sedan",
        destaques: [
          "2021",
          "19.300 km",
          "Automático",
          "Gasolina"
        ],
        descricao: "Motor 2.0 Turbo · 258 cv · Cor Portimão Blue"
      },
      {
        nome: "Audi S4 Sedan",
        preco: "",
        precoValor: 339900,
        categoria: "Sedan",
        destaques: [
          "2019",
          "31.200 km",
          "Tiptronic",
          "Gasolina"
        ],
        descricao: "Motor 3.0 V6 Turbo · 354 cv · Quattro"
      },
      {
        nome: "Porsche Macan S",
        preco: "",
        precoValor: 529900,
        categoria: "SUV",
        destaques: [
          "2020",
          "27.800 km",
          "PDK",
          "Gasolina"
        ],
        descricao: "Motor 2.9 V6 Biturbo · 380 cv · Pacote Sport Chrono"
      },
      {
        nome: "Range Rover Velar R-Dynamic",
        preco: "",
        precoValor: 449900,
        categoria: "SUV",
        destaques: [
          "2020",
          "34.100 km",
          "Automático",
          "Gasolina"
        ],
        descricao: "Motor 2.0 Turbo · 300 cv · Teto panorâmico"
      },
      {
        nome: "Ford F-150 Raptor",
        preco: "",
        precoValor: 689900,
        categoria: "Picape",
        destaques: [
          "2021",
          "15.600 km",
          "Automático",
          "Gasolina"
        ],
        descricao: "Motor 3.5 V6 EcoBoost · 456 cv · Suspensão Fox"
      },
      {
        nome: "RAM 1500 Rebel",
        preco: "",
        precoValor: 459900,
        categoria: "Picape",
        destaques: [
          "2022",
          "12.900 km",
          "Automático",
          "Gasolina"
        ],
        descricao: "Motor 5.7 V8 Hemi · 400 cv · Ar suspensão"
      },
      {
        nome: "Porsche 911 Carrera S",
        preco: "",
        precoValor: 899900,
        categoria: "Esportivo",
        destaques: [
          "2019",
          "14.200 km",
          "PDK",
          "Gasolina"
        ],
        descricao: "Motor 3.0 Biturbo · 450 cv · Escapamento esportivo"
      }
    ],
    depoimentos: [
      {
        autor: "Henrique Salles",
        contexto: "Porsche 911 Carrera S 2019",
        texto: "Chegou com o histórico de revisões completo e a nota de cada peça. É o que se espera nessa faixa."
      },
      {
        autor: "Beatriz Kawano",
        contexto: "BMW 330i M Sport 2021",
        texto: "Test drive marcado no horário que eu pedi, sem vendedor em cima. Voltei no dia seguinte e fechei."
      },
      {
        autor: "Otávio Rangel",
        contexto: "Ford F-150 Raptor 2021",
        texto: "Foto honesta, laudo sem ressalva, carro igual ao anúncio. Raro."
      },
      {
        autor: "Luísa Fontes",
        contexto: "Mini Cooper S 2021",
        texto: "Entenderam o que eu queria antes de eu terminar a frase."
      },
      {
        autor: "André Meirelles",
        contexto: "Porsche Macan S 2020",
        texto: "Aceitaram meu carro na troca pelo valor de mercado, sem teatro."
      }
    ],
    imagensAlt: {
      hero: "Salão escuro com um esportivo sob luz de estúdio",
      destaque: "Porsche 911 Carrera S 2019, o carro em destaque",
      "carro-1": "Mini Cooper S",
      "carro-2": "VW Golf GTI",
      "carro-3": "BMW 330i M Sport",
      "carro-4": "Audi S4 Sedan",
      "carro-5": "Porsche Macan S",
      "carro-6": "Range Rover Velar R-Dynamic",
      "carro-7": "Ford F-150 Raptor",
      "carro-8": "RAM 1500 Rebel",
      "carro-9": "Porsche 911 Carrera S"
    },
    textos: {
      hero: {
        rotulo: "ESPORTIVOS E IMPORTADOS",
        texto: "Carros escolhidos um a um, com histórico completo e a ficha técnica inteira à mostra.",
        cta: "Ver a coleção",
        ctaSecundaria: "Agendar visita"
      },
      estoque: {
        rotulo: "NO SALÃO",
        titulo: "A coleção",
        texto: "Histórico de revisões completo",
        cta: "Quero conhecer",
        ctaSecundaria: "Ficha"
      },
      simulador: {
        rotulo: "FINANCIAMENTO",
        titulo: "Planeje a compra",
        texto: "Uma referência para conversar com o seu banco.",
        cta: "Pedir proposta"
      },
      avaliacao: {
        rotulo: "SEU CARRO NA TROCA",
        titulo: "Aceitamos seu carro na troca",
        texto: "Avaliação pelo valor de mercado, com o histórico dele na mesa.",
        cta: "Avaliar meu carro",
        itens: [
          { titulo: "Porsche" },
          { titulo: "BMW" },
          { titulo: "Audi" },
          { titulo: "Mercedes-Benz" },
          { titulo: "Mini" },
          { titulo: "Volvo" },
          { titulo: "Land Rover" },
          { titulo: "Ford" }
        ]
      },
      destaque: {
        rotulo: "EM DESTAQUE",
        titulo: "Porsche 911 Carrera S 2019",
        texto: "Um dono, revisões na rede autorizada e pintura original. Pacote Sport Chrono, escapamento esportivo e bancos adaptativos.",
        cta: "Agendar test drive",
        itens: [
          { titulo: "Motor", texto: "3.0 boxer biturbo" },
          { titulo: "Potência", texto: "450 cv" },
          { titulo: "0–100 km/h", texto: "3,7 s" },
          { titulo: "Câmbio", texto: "PDK, 8 marchas" },
          { titulo: "Quilometragem", texto: "14.200 km" },
          { titulo: "Cor", texto: "Cinza Ágata" }
        ]
      },
      numeros: {
        itens: [
          { titulo: "9", detalhe: "carros no salão, nem mais" },
          { titulo: "100%", detalhe: "com histórico de revisões" },
          { titulo: "24 h", detalhe: "para agendar o test drive" }
        ]
      },
      vantagens: {
        rotulo: "COMO TRABALHAMOS",
        titulo: "Cada carro, uma história conferida.",
        itens: [
          { titulo: "Curadoria", texto: "Só entra no salão o carro que a gente compraria." },
          { titulo: "Histórico na mesa", texto: "Notas de revisão, laudo e procedência, antes de você pedir." },
          { titulo: "Test drive sem pressa", texto: "Na estrada, no horário que você escolher." },
          { titulo: "Entrega cuidada", texto: "Transporte fechado para qualquer lugar do país." }
        ]
      },
      depoimentos: {
        rotulo: "QUEM LEVOU",
        titulo: "Na garagem deles"
      },
      contato: {
        rotulo: "VISITE O SALÃO",
        titulo: "Com hora marcada",
        cta: "Agendar visita",
        texto: "Conteúdo ilustrativo."
      }
    },
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
    slogan: "Sua picape velha entra. A nova sai.",
    servicos: [
      {
        nome: "Fiat Toro Volcano",
        preco: "",
        precoValor: 149900,
        categoria: "Picape",
        destaques: [
          "2022",
          "38.200 km",
          "Automático",
          "Diesel"
        ],
        descricao: "Motor 2.0 Turbo Diesel · 4×4 · Capota marítima"
      },
      {
        nome: "Chevrolet S10 LTZ",
        preco: "",
        precoValor: 189900,
        categoria: "Picape",
        destaques: [
          "2021",
          "54.600 km",
          "Automático",
          "Diesel"
        ],
        descricao: "Motor 2.8 Diesel · 4×4 · Engate de reboque"
      },
      {
        nome: "Mitsubishi L200 Triton Sport",
        preco: "",
        precoValor: 169900,
        categoria: "Picape",
        destaques: [
          "2020",
          "71.300 km",
          "Automático",
          "Diesel"
        ],
        descricao: "Motor 2.4 Diesel · 4×4 com reduzida · Santo antônio"
      },
      {
        nome: "Nissan Frontier Attack",
        preco: "",
        precoValor: 179900,
        categoria: "Picape",
        destaques: [
          "2021",
          "49.800 km",
          "Automático",
          "Diesel"
        ],
        descricao: "Motor 2.3 Biturbo Diesel · 4×4 · Protetor de caçamba"
      },
      {
        nome: "Toyota SW4 SRX",
        preco: "",
        precoValor: 259900,
        categoria: "SUV 4×4",
        destaques: [
          "2021",
          "46.700 km",
          "Automático",
          "Diesel"
        ],
        descricao: "Motor 2.8 Diesel · 7 lugares · Bloqueio de diferencial"
      },
      {
        nome: "Jeep Commander Overland",
        preco: "",
        precoValor: 219900,
        categoria: "SUV 4×4",
        destaques: [
          "2022",
          "31.400 km",
          "Automático",
          "Diesel"
        ],
        descricao: "Motor 2.0 Turbo Diesel · 4×4 · 7 lugares"
      },
      {
        nome: "Toyota Hilux SRV",
        preco: "",
        precoValor: 209900,
        categoria: "Picape",
        destaques: [
          "2021",
          "62.900 km",
          "Automático",
          "Diesel"
        ],
        descricao: "Motor 2.8 Diesel · 4×4 · Cabine dupla"
      },
      {
        nome: "Ford Ranger XLS",
        preco: "",
        precoValor: 169900,
        categoria: "Picape",
        destaques: [
          "2020",
          "78.400 km",
          "Manual",
          "Diesel"
        ],
        descricao: "Motor 2.2 Diesel · 4×4 · Pronta para lavoura"
      },
      {
        nome: "VW Amarok V6 Highline",
        preco: "",
        precoValor: 239900,
        categoria: "Picape",
        destaques: [
          "2021",
          "58.100 km",
          "Automático",
          "Diesel"
        ],
        descricao: "Motor 3.0 V6 Diesel · 4Motion · Tração permanente"
      }
    ],
    depoimentos: [
      {
        autor: "Sebastião Moura",
        contexto: "Toyota Hilux SRV 2021",
        texto: "Entreguei a minha antiga com 300 mil rodados e saí com a nova no mesmo dia. A avaliação foi justa."
      },
      {
        autor: "Cooperativa Vale Verde",
        contexto: "Ford Ranger XLS 2020",
        texto: "Trocamos duas picapes da frota de uma vez. Resolveram a papelada toda."
      },
      {
        autor: "Neusa Bernardi",
        contexto: "Toyota SW4 SRX 2021",
        texto: "Carro de família que encara estrada de chão. Explicaram cada revisão feita."
      },
      {
        autor: "Ivan Kuhn",
        contexto: "Chevrolet S10 LTZ 2021",
        texto: "Vieram buscar minha picape no sítio para avaliar. Isso ninguém faz."
      },
      {
        autor: "Dirceu Pacheco",
        contexto: "VW Amarok V6 Highline 2021",
        texto: "Troca rápida, sem choradeira no preço da usada."
      }
    ],
    imagensAlt: {
      hero: "Picape 4×4 estacionada no pátio de terra da loja",
      destaque: "Toyota Hilux SRX 2020, a picape em destaque",
      "carro-1": "Fiat Toro Volcano",
      "carro-2": "Chevrolet S10 LTZ",
      "carro-3": "Mitsubishi L200 Triton Sport",
      "carro-4": "Nissan Frontier Attack",
      "carro-5": "Toyota SW4 SRX",
      "carro-6": "Jeep Commander Overland",
      "carro-7": "Toyota Hilux SRV",
      "carro-8": "Ford Ranger XLS",
      "carro-9": "VW Amarok V6 Highline"
    },
    textos: {
      hero: {
        rotulo: "PICAPES E UTILITÁRIOS",
        texto: "Picape, SUV 4×4 e utilitário para quem trabalha. Sua usada entra na troca, avaliada na hora.",
        cta: "Ver estoque",
        ctaSecundaria: "Falar no WhatsApp"
      },
      estoque: {
        rotulo: "NO PÁTIO",
        titulo: "Pronta pra lida",
        texto: "Revisada e com laudo",
        cta: "Tenho interesse",
        ctaSecundaria: "Ficha"
      },
      simulador: {
        rotulo: "FINANCIAMENTO",
        titulo: "Quanto fica por mês?",
        texto: "Com a sua usada na entrada, a parcela cai.",
        cta: "Pedir proposta"
      },
      avaliacao: {
        rotulo: "A TROCA É AQUI",
        titulo: "Quanto vale a sua picape?",
        texto: "Diga o que você tem. A gente responde com o valor da troca, sem compromisso.",
        cta: "Avaliar na troca",
        itens: [
          { titulo: "Toyota" },
          { titulo: "Chevrolet" },
          { titulo: "Ford" },
          { titulo: "Mitsubishi" },
          { titulo: "Nissan" },
          { titulo: "Volkswagen" },
          { titulo: "Fiat" },
          { titulo: "Jeep" },
          { titulo: "RAM" }
        ]
      },
      destaque: {
        rotulo: "DESTAQUE DO PÁTIO",
        titulo: "Toyota Hilux SRX 2020",
        texto: "Único dono, sempre revisada na autorizada, sem uso em lavoura. Pronta para puxar reboque.",
        cta: "Tenho interesse",
        itens: [
          { titulo: "Motor", texto: "2.8 turbodiesel, 204 cv" },
          { titulo: "Tração", texto: "4×4 com reduzida" },
          { titulo: "Câmbio", texto: "Automático, 6 marchas" },
          { titulo: "Quilometragem", texto: "68.300 km" },
          { titulo: "Carga útil", texto: "1.000 kg" },
          { titulo: "Reboque", texto: "até 3.500 kg" }
        ]
      },
      numeros: {
        itens: [
          { titulo: "40 min", detalhe: "para avaliar a sua usada" },
          { titulo: "6 meses", detalhe: "de garantia de motor e câmbio" },
          { titulo: "48×", detalhe: "no financiamento" }
        ]
      },
      vantagens: {
        rotulo: "POR QUE TROCAR AQUI",
        titulo: "A troca é o assunto.",
        itens: [
          { titulo: "Avaliação no sítio", texto: "Se precisar, a gente vai até a sua picape." },
          { titulo: "Usada vale entrada", texto: "O valor da troca abate direto na nova." },
          { titulo: "Frota e produtor", texto: "Troca de várias de uma vez, com nota para empresa." },
          { titulo: "Revisada de verdade", texto: "Suspensão, tração e embreagem conferidas." }
        ]
      },
      depoimentos: {
        rotulo: "QUEM TROCOU",
        titulo: "Da usada para a nova"
      },
      contato: {
        rotulo: "ONDE FICA O PÁTIO",
        titulo: "Venha ver as picapes",
        cta: "Chamar no WhatsApp",
        texto: "Conteúdo ilustrativo."
      }
    },
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
