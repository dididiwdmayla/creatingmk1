import type { DemoData } from "@/lib/demos/types";

/**
 * DemoData de exemplo da skin de tatuagem — a base que a ficha do lead
 * pré-preenche e sobrescreve. Copy original inspirada no tom editorial do
 * material bruto (skins-raw/tatuagem), com marca e fotos genéricas: nada
 * aqui identifica o estúdio/cliente original.
 *
 * `investimento` (preços) e `depoimentos` não existiam no material bruto
 * — são acréscimos exigidos pelo contrato universal de DemoData (ver
 * secoes.ts) — o resto segue a estrutura original (hero, sobre, manifesto,
 * portfólio, faixa rolante, processo, contato).
 */
export const TATUAGEM_EXEMPLO: DemoData = {
  nome: "ÓSSEA STUDIO",
  slogan: "A pele é o registro.",
  endereco: "Rua das Palmeiras, 512 — Zona 07",
  servicos: [
    {
      nome: "SESSÃO — PEQUENA",
      preco: "R$ 350",
      descricao: "Até 3h. Peças de até 10cm: linework, dotwork ou blackwork de menor escala.",
    },
    {
      nome: "SESSÃO — MÉDIA",
      preco: "R$ 700",
      descricao: "Sessão de dia inteiro. Peças autorais de 10 a 25cm, com estudo prévio incluso.",
    },
    {
      nome: "FECHAMENTO",
      preco: "A partir de R$ 1.800",
      descricao: "Projetos de grande escala — braço, costas, perna. Orçado após consulta presencial.",
    },
    {
      nome: "FLASH DAY",
      preco: "R$ 250",
      descricao: "Peças de tamanho único, escolhidas de um catálogo fechado. Datas avulsas divulgadas no Instagram.",
    },
    {
      nome: "RETOQUE",
      preco: "Sob consulta",
      descricao: "Manutenção de peças feitas no estúdio dentro de 12 meses.",
    },
    {
      nome: "CONSULTORIA DE PROJETO",
      preco: "R$ 120",
      descricao: "Sessão de estudo e referência antes de fechar orçamento — abatido no valor final.",
    },
  ],
  depoimentos: [
    {
      autor: "Marina T.",
      texto: "Peça autoral, do jeito que eu queria. O estudo prévio fez toda diferença no resultado.",
      nota: 5,
    },
    {
      autor: "Igor P.",
      texto: "Ambiente sério, higiene impecável e uma mão pesada em linework que eu nunca tinha visto de perto.",
      nota: 5,
    },
    {
      autor: "Bianca S.",
      texto: "Fechamento de braço em três sessões, cada uma valeu a espera. Sem pressa, sem economizar detalhe.",
      nota: 5,
    },
  ],
  secoes: {
    hero: {
      texto: "Estúdio de tatuagem autoral. Blackwork, realismo dark e iconografia.",
      cta: "INICIAR CONVERSA",
    },
    sobre: {
      rotulo: "O ARTISTA",
      titulo: "Duda Ferraz",
      texto:
        "Tatuador há 11 anos, dedicado exclusivamente ao blackwork e ao realismo dark.\n\nTrabalha em sessões longas, marcadas com antecedência. Estuda gravura, anatomia comparada e iconografia medieval — referências que voltam à pele como linguagem.",
      itens: [
        { titulo: "Blackwork" },
        { titulo: "Realismo Dark" },
        { titulo: "Dotwork" },
        { titulo: "Iconografia" },
        { titulo: "Linework Pesado" },
      ],
    },
    statement: {
      texto: "TATUAGEM NÃO É DECORAÇÃO. É MEMÓRIA.",
    },
    portfolio: {
      rotulo: "ARQUIVO",
      titulo: "Trabalhos",
      itens: [
        { titulo: "Blackwork", subtitulo: "18cm", detalhe: "Antebraço" },
        { titulo: "Realismo Dark", subtitulo: "25cm", detalhe: "Costela" },
        { titulo: "Iconografia", subtitulo: "15cm", detalhe: "Panturrilha" },
        { titulo: "Blackwork", subtitulo: "Fechamento", detalhe: "Braço" },
        { titulo: "Dotwork", subtitulo: "12cm", detalhe: "Costas" },
        { titulo: "Linework", subtitulo: "20cm", detalhe: "Peito" },
        { titulo: "Realismo Dark", subtitulo: "Fechamento", detalhe: "Perna" },
        { titulo: "Blackwork", subtitulo: "10cm", detalhe: "Mão" },
      ],
    },
    investimento: {
      rotulo: "INVESTIMENTO",
      titulo: "O que fazemos, com agulha e tinta.",
    },
    depoimentos: {
      rotulo: "DEPOIMENTOS",
      titulo: "Quem senta na cadeira, volta.",
    },
    marquee: {
      itens: [
        { titulo: "BLACKWORK" },
        { titulo: "REALISMO DARK" },
        { titulo: "ICONOGRAFIA" },
        { titulo: "DOTWORK" },
        { titulo: "LINEWORK PESADO" },
        { titulo: "AUTORAL" },
        { titulo: "2026" },
      ],
    },
    processo: {
      rotulo: "PROTOCOLO",
      titulo: "O Processo",
      itens: [
        {
          titulo: "ENVIE SUA REFERÊNCIA",
          subtitulo: "01",
          texto: "Texto, imagem ou ideia bruta, pelo WhatsApp.",
        },
        {
          titulo: "CONVERSAMOS",
          subtitulo: "02",
          texto: "Alinhamos estilo, tamanho, posicionamento e orçamento.",
        },
        {
          titulo: "RESERVAMOS A DATA",
          subtitulo: "03",
          texto: "Sinal de 30% confirma a sessão.",
        },
        {
          titulo: "SESSÃO NO ESTÚDIO",
          subtitulo: "04",
          texto: "Café, conversa, agulha. Sem pressa.",
        },
      ],
    },
    contato: {
      titulo: "AGENDAR SESSÃO",
      cta: "INICIAR CONVERSA",
    },
  },
  imagens: {
    hero: "/demos/tatuagem/hero.svg",
    sobre: "/demos/tatuagem/sobre.svg",
    "portfolio-1": "/demos/tatuagem/portfolio-1.svg",
    "portfolio-2": "/demos/tatuagem/portfolio-2.svg",
    "portfolio-3": "/demos/tatuagem/portfolio-3.svg",
    "portfolio-4": "/demos/tatuagem/portfolio-4.svg",
    "portfolio-5": "/demos/tatuagem/portfolio-5.svg",
    "portfolio-6": "/demos/tatuagem/portfolio-6.svg",
    "portfolio-7": "/demos/tatuagem/portfolio-7.svg",
    "portfolio-8": "/demos/tatuagem/portfolio-8.svg",
  },
};
