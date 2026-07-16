import type { DemoData } from "@/lib/demos/types";

/**
 * DemoData de exemplo da skin de barbearia — a base que a ficha do lead
 * pré-preenche e sobrescreve. O copy editorial vem do material bruto
 * (skins-raw/barbearia), com marca e fotos genéricas: nada aqui identifica
 * o cliente original.
 */
export const BARBEARIA_EXEMPLO: DemoData = {
  nome: "BARBEARIA NORTE",
  slogan: "Ofício, tesoura e navalha.",
  endereco: "Av. Principal, 100 — Centro",
  telefone: "(00) 0000-0000",
  whatsapp: "(00) 90000-0000",
  instagram: "@suabarbearia",
  horarios: "Terça a sábado, 10h às 20h. Atendimento por agendamento.",
  servicos: [
    {
      nome: "CORTE CLÁSSICO",
      preco: "R$ 80",
      descricao: "Tesoura e navalha. Acabamento limpo no pescoço e contornos.",
    },
    {
      nome: "CORTE + BARBA",
      preco: "R$ 140",
      descricao:
        "Combinação completa. Corte personalizado seguido de barba artesanal com toalha quente, óleo essencial e finalização.",
    },
    {
      nome: "BARBA TRADICIONAL",
      preco: "R$ 75",
      descricao:
        "Barba feita com navalha, toalha quente, óleo de barba e hidratação. 40 minutos de ritual.",
    },
    {
      nome: "NAVALHA COMPLETA",
      preco: "R$ 90",
      descricao: "Barba inteira removida com navalha tradicional. Para quem quer recomeçar.",
    },
    {
      nome: "SOBRANCELHA MASCULINA",
      preco: "R$ 35",
      descricao: "Design discreto. Apenas o necessário.",
    },
    {
      nome: "PIGMENTAÇÃO DE BARBA",
      preco: "R$ 120",
      descricao:
        "Disfarce de falhas, intensificação de tom. Resultado natural, duração de 4 a 6 semanas.",
    },
  ],
  depoimentos: [
    {
      autor: "Ricardo M.",
      texto:
        "Corte impecável e atendimento no horário marcado. Café bom e conversa melhor ainda.",
      nota: 5,
    },
    {
      autor: "Felipe A.",
      texto: "A barba nunca esteve tão bem cuidada. Toalha quente muda tudo.",
      nota: 5,
    },
    {
      autor: "Marcos V.",
      texto: "Ambiente de respeito, sem pressa. Saio novo toda vez.",
      nota: 5,
    },
  ],
  secoes: {
    hero: {
      titulo: "OFÍCIO. TESOURA. NAVALHA.",
      texto:
        "Cortes clássicos, barbas artesanais e atendimento sob agendamento. Sem fila, sem pressa.",
      cta: "AGENDAR HORÁRIO",
      ctaSecundaria: "VER SERVIÇOS",
    },
    filosofia: {
      rotulo: "FILOSOFIA",
      titulo: "TRÊS COISAS NÃO NEGOCIÁVEIS",
      itens: [
        {
          titulo: "OFÍCIO",
          subtitulo: "01",
          texto:
            "Não somos técnicos. Somos artesãos. Cada corte é decidido junto ao cliente, considerando rosto, estilo de vida e tempo. Aqui não tem máquina sem propósito.",
        },
        {
          titulo: "RITUAL",
          subtitulo: "02",
          texto:
            "Toalha quente, conversa baixa, café preto. O atendimento dura o tempo certo, não o tempo do relógio. Você sai diferente de quando entrou.",
        },
        {
          titulo: "TEMPO",
          subtitulo: "03",
          texto:
            "Trabalhamos sob agendamento. Sem fila, sem pressa. Quem entra aqui tem um horário reservado pra ele — e nada nem ninguém toma esse tempo.",
        },
      ],
    },
    servicos: {
      rotulo: "SERVIÇOS",
      titulo: "O QUE FAZEMOS, COM AS MÃOS.",
    },
    equipe: {
      rotulo: "EQUIPE",
      titulo: "HOMENS DE OFÍCIO.",
      itens: [
        {
          titulo: "Alan",
          subtitulo: "Cortes clássicos e navalha tradicional · 14 anos de ofício",
          texto:
            "Aprendeu o ofício com o avô. Trabalha com navalha de barbeiro tradicional e tem mão firme nos cortes clássicos masculinos — pompadour, side part, slick back.",
        },
        {
          titulo: "Rogério",
          subtitulo: "Barbas artísticas e design de barba · 9 anos de ofício",
          texto:
            "Vem do mundo das tatuagens e trouxe o olhar de artista pro design de barbas. Especialista em barbas longas, lineup preciso e hidratação artesanal.",
        },
        {
          titulo: "João",
          subtitulo: "Cortes modernos e fades complexos · 7 anos de ofício",
          texto:
            "Formação internacional. Domina fades complexos, taper, texturização e cortes modernos inspirados em barbearia europeia contemporânea.",
        },
      ],
    },
    ritual: {
      rotulo: "RITUAL",
      texto: "Você entra com pressa. Sai com calma.",
      ctaSecundaria: "ATENDIMENTO POR AGENDAMENTO",
    },
    depoimentos: {
      rotulo: "DEPOIMENTOS",
      titulo: "QUEM SENTA NA CADEIRA, VOLTA.",
    },
    agendamento: {
      rotulo: "COMO FUNCIONA",
      titulo: "TRÊS PASSOS, NADA MAIS.",
      cta: "AGENDAR PELO WHATSAPP",
      itens: [
        {
          titulo: "ESCOLHA",
          subtitulo: "01",
          texto: "Pelo Instagram ou WhatsApp, escolha o barbeiro e o serviço.",
        },
        {
          titulo: "CONFIRME",
          subtitulo: "02",
          texto: "Agendamos via WhatsApp com data, horário e detalhes da sua preferência.",
        },
        {
          titulo: "APAREÇA",
          subtitulo: "03",
          texto: "Chegue 10 minutos antes. Café por nossa conta.",
        },
      ],
    },
    contato: {
      rotulo: "CONTATO",
      titulo: "ONDE A MÁGICA ACONTECE.",
      cta: "TRAÇAR ROTA",
    },
  },
  imagens: {
    hero: "/demos/barbearia/hero.svg",
    servicos: "/demos/barbearia/servicos.svg",
    "equipe-1": "/demos/barbearia/equipe-1.svg",
    "equipe-2": "/demos/barbearia/equipe-2.svg",
    "equipe-3": "/demos/barbearia/equipe-3.svg",
    mapa: "/demos/barbearia/mapa.svg",
  },
};
