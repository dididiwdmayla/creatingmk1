import type { DemoData } from "@/lib/demos/types";

/**
 * DemoData de exemplo da skin de imobiliária — a base que a ficha do lead
 * pré-preenche e sobrescreve. O copy segue o tom do material bruto
 * (skins-raw/imobiliaria), com marca e endereço genéricos: nada aqui
 * identifica o negócio original (Vivenda, São Paulo). Os imóveis mantêm
 * bairros reais de São Paulo só como pano de fundo realista de nicho — o
 * mesmo critério de "Maringá - PR" em tatuagem/exemplo.ts — não a
 * identidade do cliente.
 *
 * `descricao` dos imóveis usa a convenção "Selo • especificações" (ver
 * ./propriedade.ts); o fallback "Sob consulta" para `preco` vazio é
 * exercitado no teste de ./propriedade.test.ts, não aqui — o exemplo
 * segue a regra geral do registro (todo `servico.preco` é truthy).
 */
export const IMOBILIARIA_EXEMPLO: DemoData = {
  nome: "RAIZ IMÓVEIS",
  slogan: "Curadoria de casas com história.",
  endereco: "Rua Principal, 100 — Centro",
  servicos: [
    {
      nome: "Casa-jardim em Alto de Pinheiros",
      preco: "R$ 2.980.000",
      descricao: "Casa • 4 suítes · 420 m² · piscina de borda verde",
    },
    {
      nome: "Cobertura com terraço no Itaim",
      preco: "R$ 4.200.000",
      descricao: "Cobertura • 3 suítes · 280 m² · pôr do sol garantido",
    },
    {
      nome: "Studio-ateliê na Vila Madalena",
      preco: "R$ 890.000",
      descricao: "Studio • 70 m² · pé-direito duplo · luz norte",
    },
    {
      nome: "Clássico reformado em Higienópolis",
      preco: "R$ 1.450.000",
      descricao: "Apartamento • 3 quartos · 190 m² · piso de taco original",
    },
    {
      nome: "Cobertura duplex em Moema",
      preco: "R$ 3.650.000",
      descricao: "Cobertura • 4 suítes · 340 m² · vista para o parque",
    },
  ],
  depoimentos: [
    {
      autor: "Marina e Caio Duarte — compraram em 2025",
      texto:
        "A RAIZ não nos vendeu uma casa. Nos apresentou a uma vida que a gente nem sabia que cabia nesse bairro — com quintal, figueira e vizinho que dá bom-dia.",
    },
  ],
  secoes: {
    hero: {
      rotulo: "Imobiliária boutique",
      texto:
        "Curadoria de casas e apartamentos com história, luz e lugar. Poucos imóveis, escolhidos a dedo — e uma conversa de verdade antes de qualquer visita.",
      cta: "Ver imóveis",
      ctaSecundaria: "Como trabalhamos",
    },
    imoveis: {
      titulo: "Imóveis em destaque",
      // Texto do bloco "Nosso manifesto" (fundo verde, revelado palavra a
      // palavra no scroll — ver ManifestoReveal.tsx), não descrição da seção.
      texto:
        "Acreditamos que uma casa não se mede em metros quadrados — se mede em manhãs de sol na cozinha, em jantares que atravessam a noite e em silêncios que abraçam. Nós encontramos os lugares onde a vida acontece devagar, e bem.",
      cta: "Receber a curadoria completa",
      ctaSecundaria: "Falar com um curador →",
      itens: [
        { titulo: "340+", texto: "famílias moram melhor desde 2019." },
        {
          titulo:
            "Curadoria enxuta, de verdade: nunca mais de trinta imóveis no portfólio.",
        },
      ],
    },
    bairros: {
      titulo: "Bairros que a gente conhece pelo nome",
      texto: "Arraste para o lado →",
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
          texto:
            "Um café — presencial ou não — para entender seu momento: quem mora, como vive, o que a casa precisa abraçar.",
        },
        {
          titulo: "A curadoria",
          texto:
            "No máximo cinco imóveis, visitados por nós antes de você. Nada de listas infinitas — só o que faz sentido.",
        },
        {
          titulo: "A chave",
          texto:
            "Negociação, papelada e cartório com a gente do lado. Você só se preocupa com a mudança — e com a festa de inauguração.",
        },
      ],
    },
    depoimento: {},
    contato: {
      titulo: "Sua próxima casa está te esperando.",
      texto:
        "Deixe seu e-mail e receba a curadoria da semana — poucos imóveis, muita alma, zero spam.",
      cta: "Quero receber",
    },
  },
  ordemSecoes: ["imoveis", "bairros", "como", "depoimento", "contato"],
  imagens: {
    hero: "/demos/imobiliaria/hero.svg",
    "imovel-1": "/demos/imobiliaria/imovel-1.svg",
    "imovel-2": "/demos/imobiliaria/imovel-2.svg",
    "imovel-3": "/demos/imobiliaria/imovel-3.svg",
    "imovel-4": "/demos/imobiliaria/imovel-4.svg",
    "imovel-5": "/demos/imobiliaria/imovel-5.svg",
    "bairro-1": "/demos/imobiliaria/bairro-1.svg",
    "bairro-2": "/demos/imobiliaria/bairro-2.svg",
    "bairro-3": "/demos/imobiliaria/bairro-3.svg",
    "bairro-4": "/demos/imobiliaria/bairro-4.svg",
    "bairro-5": "/demos/imobiliaria/bairro-5.svg",
    "depoimento-1": "/demos/imobiliaria/depoimento-1.svg",
  },
};
