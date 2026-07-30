import type { DemoData } from "@/lib/demos/types";

/**
 * DemoData de exemplo da skin "Pigmento Vivo" — a base que a ficha do
 * lead pré-preenche e sobrescreve. Copy autoral inspirada no tom
 * editorial-colorido do material bruto (skins-raw/tatuagem2), com marca e
 * fotos genéricas: nada aqui identifica o estúdio/cliente original.
 *
 * `investimento` (preços) e `depoimentos` não existiam no material bruto
 * — acréscimos exigidos pelo contrato universal de DemoData (mesmo
 * critério de tatuagem/exemplo.ts) — o resto segue a estrutura original
 * (hero, manifesto, estilos, portfólio, artistas, processo, faq, cta
 * final, rodapé). O hero e os cartões de "estilos"/"artistas" não têm
 * slot de imagem — fiel ao original, que também não usa foto nenhuma
 * nesses blocos (blobs de cor e rabiscos SVG só); só o Portfólio tem
 * imagens de verdade (o que o lead de fato sobe).
 */
export const TATUAGEM2_EXEMPLO: DemoData = {
  nome: "MATIZ STUDIO",
  slogan: "Cor que você carrega pra vida toda.",
  endereco: "Rua das Aquarelas, 88 — Centro",
  servicos: [
    {
      nome: "SESSÃO — PEQUENA",
      preco: "R$ 380",
      descricao: "Até 3h. Peças de até 10cm em qualquer estilo do estúdio.",
    },
    {
      nome: "SESSÃO — MÉDIA",
      preco: "R$ 750",
      descricao: "Dia inteiro. Peças autorais de 10 a 25cm, com estudo prévio incluso.",
    },
    {
      nome: "FECHAMENTO",
      preco: "A partir de R$ 2.000",
      descricao: "Projetos de grande escala — braço, costas, perna. Orçado após consulta presencial.",
    },
    {
      nome: "FLASH DAY",
      preco: "R$ 280",
      descricao: "Peças de tamanho único, escolhidas de um catálogo fechado. Datas avulsas no Instagram.",
    },
    {
      nome: "RETOQUE",
      preco: "Sob consulta",
      descricao: "Manutenção de peças feitas no estúdio dentro de 12 meses.",
    },
  ],
  depoimentos: [
    {
      autor: "Marina T.",
      texto: "Peça autoral, exatamente como eu queria — o estudo prévio fez toda diferença no resultado.",
      nota: 5,
    },
    {
      autor: "Igor P.",
      texto: "Ambiente sério, higiene impecável e uma mão pesada em linework que eu nunca tinha visto de perto.",
      nota: 5,
    },
    {
      autor: "Bianca S.",
      texto: "Fechamento de braço em três sessões — sem pressa, sem economizar detalhe.",
      nota: 5,
    },
  ],
  secoes: {
    hero: {
      rotulo: "Estúdio de tatuagem autoral",
      texto: "Cor viva, traço autoral. Sessões por agendamento, desde 2018.",
      cta: "Agendar sessão",
    },
    manifesto: {
      texto:
        "Tatuagem não é moda passageira. É registro, é escolha, é a única arte que você carrega pra sempre.",
    },
    estilos: {
      rotulo: "Estilos",
      titulo: "Cinco linguagens, uma pele.",
      itens: [
        { titulo: "Aquarela", texto: "Pigmento diluído, borda solta — tinta que escorre de propósito." },
        { titulo: "Neo-Tradicional", texto: "Traço firme, paleta saturada. O clássico, vivo de novo." },
        { titulo: "Fineline", texto: "Uma agulha, um fio. Precisão que quase sussurra." },
        { titulo: "Old School", texto: "Âncora, andorinha, rosa — o vocabulário que fundou tudo." },
        { titulo: "Blackwork", texto: "Aqui o preto é exceção. E é por isso que pesa." },
      ],
    },
    investimento: {
      rotulo: "Investimento",
      titulo: "O que sai da agulha.",
    },
    portfolio: {
      rotulo: "Arquivo",
      titulo: "Pigmento em movimento.",
      itens: [
        { titulo: "Aquarela", subtitulo: "Cora Vidal", detalhe: "4h" },
        { titulo: "Neo-Tradicional", subtitulo: "Bento Aoki", detalhe: "6h" },
        { titulo: "Fineline botânico", subtitulo: "Íris Weiss", detalhe: "2h30" },
        { titulo: "Old School", subtitulo: "Bento Aoki", detalhe: "3h" },
        { titulo: "Blackwork", subtitulo: "Cora Vidal", detalhe: "5h" },
        { titulo: "Aquarela abstrata", subtitulo: "Íris Weiss", detalhe: "4h30" },
        { titulo: "Neo-Tradicional", subtitulo: "Bento Aoki", detalhe: "5h" },
        { titulo: "Fineline", subtitulo: "Íris Weiss", detalhe: "2h" },
      ],
    },
    artistas: {
      rotulo: "Artistas",
      titulo: "Três mãos, três assinaturas.",
      itens: [
        {
          titulo: "Cora Vidal",
          subtitulo: "Aquarela · Blackwork",
          texto: "Veio da pintura antes da agulha. Trabalha mancha e respingo como quem não pede licença.",
        },
        {
          titulo: "Bento Aoki",
          subtitulo: "Neo-Tradicional · Old School",
          texto:
            "Dez anos de traço grosso e cor fechada — composição que envelhece bem, como as boas.",
        },
        {
          titulo: "Íris Weiss",
          subtitulo: "Fineline · Botânico",
          texto:
            "Desenha plantas há mais tempo do que tatua. Cada folha no lugar, cada linha com propósito.",
        },
      ],
    },
    depoimentos: {
      rotulo: "Depoimentos",
      titulo: "Quem senta, volta.",
    },
    processo: {
      rotulo: "Processo",
      titulo: "Da ideia à tinta.",
      itens: [
        { titulo: "Ideia", subtitulo: "01", texto: "Você conta a história. A gente escuta antes de desenhar." },
        { titulo: "Desenho", subtitulo: "02", texto: "Arte autoral, feita pra você. Ajustamos até ficar certo." },
        {
          titulo: "Decalque",
          subtitulo: "03",
          texto: "O desenho na pele, ainda em roxo. Última chance de mudar tudo.",
        },
        { titulo: "Tinta", subtitulo: "04", texto: "Agulha, pigmento, silêncio. Sai com arte pra vida inteira." },
      ],
    },
    faq: {
      titulo: "Antes de marcar.",
      itens: [
        {
          titulo: "Dói?",
          texto:
            "Dói, mas menos do que você imagina — depende da região e do seu dia. Fazemos pausas sempre que precisar.",
        },
        {
          titulo: "Quanto custa?",
          texto:
            "Cada projeto é orçado individualmente — tamanho, cor e complexidade contam. Orçamento fechado antes, sem surpresa no fim.",
        },
        {
          titulo: "Como cicatriza?",
          texto:
            "De 15 a 30 dias. Você sai com o protocolo completo de cuidado — cor bem cuidada é cor que dura décadas.",
        },
        {
          titulo: "Cobre tatuagem antiga?",
          texto: "Sim — cobertura é quase uma especialidade da casa. Traga uma foto e avaliamos na hora.",
        },
      ],
    },
    agendar: {
      titulo: "Pronto pra marcar história?",
      cta: "Agendar sessão",
      ctaSecundaria: "WhatsApp",
    },
    contato: {},
  },
  imagens: {
    "portfolio-1": "/demos/tatuagem2/portfolio-1.svg",
    "portfolio-2": "/demos/tatuagem2/portfolio-2.svg",
    "portfolio-3": "/demos/tatuagem2/portfolio-3.svg",
    "portfolio-4": "/demos/tatuagem2/portfolio-4.svg",
    "portfolio-5": "/demos/tatuagem2/portfolio-5.svg",
    "portfolio-6": "/demos/tatuagem2/portfolio-6.svg",
    "portfolio-7": "/demos/tatuagem2/portfolio-7.svg",
    "portfolio-8": "/demos/tatuagem2/portfolio-8.svg",
  },
};
