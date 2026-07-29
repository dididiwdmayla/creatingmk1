import type { DemoData } from "@/lib/demos/types";

/**
 * DemoData de exemplo da skin de barbearia2 — a base que a ficha do lead
 * pré-preenche e sobrescreve. Copy autoral inspirado no tom editorial
 * minimalista do material bruto (skins-raw/barbearia2): frases curtas,
 * declarativas, sem adjetivo à toa. Marca, endereço, nomes e números são
 * genéricos — nada aqui identifica o cliente original.
 */
export const BARBEARIA2_EXEMPLO: DemoData = {
  nome: "BARBEARIA SUL",
  slogan: "Navalha, tesoura e tempo.",
  endereco: "Av. Brasil, 500 — Zona 3",
  telefone: "(00) 0000-0000",
  whatsapp: "(00) 90000-0000",
  instagram: "@suabarbearia",
  cidade: "Sua Cidade — UF",
  horarios: "SEG–SEX 9H–20H · SÁB 9H–18H · DOM FECHADO",
  servicos: [
    {
      nome: "Corte clássico",
      preco: "R$ 70",
      descricao: "Tesoura e máquina, acabamento na navalha.",
    },
    {
      nome: "Barba completa",
      preco: "R$ 55",
      descricao: "Toalha quente, óleo, navalha livre.",
    },
    {
      nome: "Corte + barba",
      preco: "R$ 110",
      descricao: "O ritual completo, sem pressa.",
    },
    {
      nome: "Estilo do mês",
      preco: "R$ 85",
      descricao: "Um corte novo por mês, escolhido pela casa.",
    },
  ],
  depoimentos: [],
  secoes: {
    hero: {
      titulo: "BARBEARIA\n& SUL",
    },
    manifesto: {
      titulo: "Um corte não se apressa.",
      texto: "Trinta e cinco anos afiando o mesmo ofício.",
    },
    servicos: {
      rotulo: "Serviços",
    },
    ritual: {
      rotulo: "O ritual",
      itens: [
        { titulo: "A conversa", texto: "Todo corte começa ouvindo." },
        { titulo: "A lâmina", texto: "Aço afiado, mão firme, zero atalho." },
        { titulo: "O espelho", texto: "Você só levanta quando estiver certo." },
      ],
    },
    galeria: {
      rotulo: "Galeria — arraste",
      itens: [
        { titulo: "CORTE Nº 014" },
        { titulo: "CORTE Nº 022" },
        { titulo: "CORTE Nº 031" },
        { titulo: "CORTE Nº 047" },
        { titulo: "CORTE Nº 058" },
      ],
    },
    barbeiros: {
      rotulo: "Barbeiros",
      itens: [
        { titulo: "Seu Vicente", subtitulo: "Fundador — navalha livre desde 1990" },
        { titulo: "Bruno", subtitulo: "Segunda geração — clássico com atitude" },
      ],
    },
    agendamento: {
      rotulo: "Agendamento",
      titulo: "Marque seu horário.",
      texto: "Sem telefone, sem espera. Escolha e apareça.",
      cta: "Agendar pelo WhatsApp",
    },
    contato: {
      rotulo: "Siga",
    },
  },
  imagens: {
    "galeria-1": "/demos/barbearia2/galeria-1.svg",
    "galeria-2": "/demos/barbearia2/galeria-2.svg",
    "galeria-3": "/demos/barbearia2/galeria-3.svg",
    "galeria-4": "/demos/barbearia2/galeria-4.svg",
    "galeria-5": "/demos/barbearia2/galeria-5.svg",
    "equipe-1": "/demos/barbearia2/equipe-1.svg",
    "equipe-2": "/demos/barbearia2/equipe-2.svg",
  },
};
