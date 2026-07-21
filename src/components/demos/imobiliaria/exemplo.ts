import type { DemoData } from "@/lib/demos/types";

/**
 * DemoData de exemplo da skin de imobiliária — a base que a ficha do lead
 * pré-preenche e sobrescreve. O copy editorial vem do material bruto
 * (skins-raw/imobiliaria), com marca, endereço e fotos genéricos: nada
 * aqui identifica o cliente original.
 *
 * `servicos` carrega os imóveis em destaque (nome/preço/descrição — o
 * contrato não tem um campo dedicado a "categoria", então a descrição
 * combina categoria e specs, ex. "Casa · 4 suítes · 420 m² · piscina de
 * borda verde"; a skin usa o primeiro segmento antes de " · " como
 * etiqueta e o resto como legenda, ver Skin.tsx). `itens` de "imoveis"
 * carrega o card de estatística (340 famílias) e a legenda de fechamento
 * da grade, nessa ordem.
 */
export const IMOBILIARIA_EXEMPLO: DemoData = {
  nome: "Raiz Imóveis",
  slogan: "Curadoria de imóveis com alma.",
  endereco: "Av. Principal, 500 — Centro",
  telefone: "(00) 0000-0000",
  whatsapp: "(00) 90000-0000",
  instagram: "@suaimobiliaria",
  cidade: "Sua Cidade — Seu Estado",
  horarios: "Seg–Sex · 9h às 19h · Sáb · 9h às 14h",
  servicos: [
    {
      nome: "Casa-jardim em Alto de Pinheiros",
      preco: "R$ 2.980.000",
      descricao: "Casa · 4 suítes · 420 m² · piscina de borda verde",
    },
    {
      nome: "Cobertura com terraço no Itaim",
      preco: "R$ 4.200.000",
      descricao: "Cobertura · 3 suítes · 280 m² · pôr do sol garantido",
    },
    {
      nome: "Studio-ateliê na Vila Madalena",
      preco: "R$ 890.000",
      descricao: "Studio · 70 m² · pé-direito duplo · luz norte",
    },
    {
      nome: "Clássico reformado em Higienópolis",
      preco: "R$ 1.450.000",
      descricao: "Apartamento · 3 quartos · 190 m² · piso de taco original",
    },
  ],
  depoimentos: [
    {
      autor: "Beatriz e Rafael Nunes — compraram a casa da figueira em 2025",
      texto:
        "A Raiz não nos vendeu uma casa. Nos apresentou a uma vida que a gente nem sabia que cabia em Perdizes — com quintal, figueira e vizinho que dá bom-dia.",
    },
  ],
  secoes: {
    hero: {
      rotulo: "Imobiliária boutique · São Paulo",
      titulo: "Morar bem é uma arte.",
      texto:
        "Curadoria de casas e apartamentos com história, luz e lugar. Poucos imóveis, escolhidos a dedo — e uma conversa de verdade antes de qualquer visita.",
      cta: "Ver imóveis",
      ctaSecundaria: "Como trabalhamos",
    },
    manifesto: {
      rotulo: "Nosso manifesto",
      texto:
        "Acreditamos que uma casa não se mede em metros quadrados — se mede em manhãs de sol na cozinha, em jantares que atravessam a noite e em silêncios que abraçam. Nós encontramos os lugares onde a vida acontece devagar, e bem.",
    },
    imoveis: {
      titulo: "Imóveis em destaque",
      cta: "Receber a curadoria completa",
      ctaSecundaria: "Falar com um curador",
      itens: [
        { titulo: "340", texto: "famílias moram melhor desde 2019." },
        { titulo: "Curadoria enxuta, de verdade: nunca mais de trinta imóveis no portfólio." },
      ],
    },
    bairros: {
      titulo: "Bairros que a gente conhece pelo nome",
      itens: [
        { titulo: "Jardins", subtitulo: "Clássico, arborizado, eterno" },
        { titulo: "Vila Madalena", subtitulo: "Ateliês, vielas e vida na calçada" },
        { titulo: "Pinheiros", subtitulo: "O bairro que nunca fica pronto — ainda bem" },
        { titulo: "Moema", subtitulo: "Calma de interior, a dez minutos do parque" },
        { titulo: "Higienópolis", subtitulo: "Modernismo, padarias e prédios com nome" },
      ],
    },
    como: {
      titulo: "Como funciona",
      itens: [
        {
          titulo: "A conversa",
          subtitulo: "01",
          texto:
            "Um café — presencial ou não — para entender seu momento: quem mora, como vive, o que a casa precisa abraçar.",
        },
        {
          titulo: "A curadoria",
          subtitulo: "02",
          texto:
            "No máximo cinco imóveis, visitados por nós antes de você. Nada de listas infinitas — só o que faz sentido.",
        },
        {
          titulo: "A chave",
          subtitulo: "03",
          texto:
            "Negociação, papelada e cartório com a gente do lado. Você só se preocupa com a mudança — e com a festa de inauguração.",
        },
      ],
    },
    depoimento: {},
    contato: {
      titulo: "Sua próxima casa está te esperando.",
      texto: "Deixe seu e-mail e receba a curadoria da semana — poucos imóveis, muita alma, zero spam.",
      cta: "Quero receber",
    },
  },
  ordemSecoes: ["manifesto", "imoveis", "bairros", "como", "depoimento", "contato"],
  imagens: {
    hero: "/demos/imobiliaria/hero.svg",
    "imovel-1": "/demos/imobiliaria/imovel-1.svg",
    "imovel-2": "/demos/imobiliaria/imovel-2.svg",
    "imovel-3": "/demos/imobiliaria/imovel-3.svg",
    "imovel-4": "/demos/imobiliaria/imovel-4.svg",
    "bairro-1": "/demos/imobiliaria/bairro-1.svg",
    "bairro-2": "/demos/imobiliaria/bairro-2.svg",
    "bairro-3": "/demos/imobiliaria/bairro-3.svg",
    "bairro-4": "/demos/imobiliaria/bairro-4.svg",
    "bairro-5": "/demos/imobiliaria/bairro-5.svg",
    "depoimento-1": "/demos/imobiliaria/depoimento-1.svg",
  },
};
