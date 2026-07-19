import type { DemoData } from "@/lib/demos/types";

/**
 * DemoData de exemplo da skin de lancheria — a base que a ficha do lead
 * pré-preenche e sobrescreve. O copy vem do material bruto
 * (skins-raw/lancheria), com marca e fotos genéricas: nada aqui identifica
 * o cliente original (Ingarandi Burger, Sarandi/PR).
 */
export const LANCHERIA_EXEMPLO: DemoData = {
  nome: "CHAPA BURGER",
  slogan: "Hambúrgueres artesanais feitos com obsessão.",
  endereco: "Av. Principal, 500 — Centro",
  telefone: "(00) 0000-0000",
  whatsapp: "(00) 90000-0000",
  instagram: "@sualancheria",
  cidade: "Sua Cidade — Seu Estado",
  horarios: "Terça a domingo, 18h às 23h",
  servicos: [
    {
      nome: "Smash Clássico",
      preco: "R$ 32,00",
      descricao:
        "Dois smash burgers de 90g, queijo cheddar derretido, cebola na chapa e molho especial no pão brioche tostado.",
    },
    {
      nome: "Cheddar Bacon",
      preco: "R$ 38,00",
      descricao:
        "Hambúrguer artesanal de 160g, creme de cheddar artesanal e tiras de bacon crocante no pão australiano.",
    },
    {
      nome: "Onion Crunch",
      preco: "R$ 36,00",
      descricao: "Hambúrguer 160g, queijo prato, onion rings crocantes e molho barbecue rústico no pão brioche.",
    },
    {
      nome: "Clássico da Casa",
      preco: "R$ 28,00",
      descricao:
        "Hambúrguer 160g, queijo prato, alface americana, tomate italiano e maionese verde no pão tradicional.",
    },
    {
      nome: "Frango Crispy",
      preco: "R$ 30,00",
      descricao: "Sobrecoxa desossada empanada e hiper crocante, alface, picles e maionese de limão siciliano.",
    },
    {
      nome: "Veggie do Chef",
      preco: "R$ 34,00",
      descricao: "Hambúrguer de falafel crocante, queijo prato, rúcula fresca e maionese de alho assado.",
    },
  ],
  depoimentos: [],
  secoes: {
    hero: {
      titulo: "CHAPA BURGER",
      texto: "Hambúrgueres artesanais feitos com obsessão.",
      cta: "VER CARDÁPIO",
    },
    cardapio: {
      rotulo: "CARDÁPIO",
      titulo: "Nosso Cardápio",
    },
    bebidas: {
      rotulo: "BEBIDAS",
      titulo: "Bebidas",
      itens: [
        { titulo: "Milkshake", subtitulo: "R$ 14,00" },
        { titulo: "Suco Natural", subtitulo: "R$ 9,00" },
        { titulo: "Refrigerante Cola", subtitulo: "R$ 7,00" },
        { titulo: "Refrigerante Guaraná", subtitulo: "R$ 7,00" },
        { titulo: "Água", subtitulo: "R$ 4,00" },
      ],
    },
    acompanhamentos: {
      rotulo: "ACOMPANHAMENTOS",
      titulo: "Acompanhamentos",
      itens: [
        { titulo: "Batata Grande", subtitulo: "R$ 22,00" },
        { titulo: "Onion Rings", subtitulo: "R$ 18,00" },
        { titulo: "Nuggets", subtitulo: "R$ 16,00" },
        { titulo: "Batata Pequena", subtitulo: "R$ 12,00" },
      ],
    },
    contato: {
      rotulo: "CONTATO",
      titulo: "Onde a chapa esquenta.",
      cta: "Fazer Pedido",
    },
  },
  ordemSecoes: ["cardapio", "bebidas", "acompanhamentos", "contato"],
  imagens: {
    hero: "/demos/lancheria/hero.svg",
    "prato-vazio": "/demos/lancheria/prato-vazio.svg",
    "lanche-1": "/demos/lancheria/lanche-1.svg",
    "lanche-2": "/demos/lancheria/lanche-2.svg",
    "lanche-3": "/demos/lancheria/lanche-3.svg",
    "lanche-4": "/demos/lancheria/lanche-4.svg",
    "lanche-5": "/demos/lancheria/lanche-5.svg",
    "lanche-6": "/demos/lancheria/lanche-6.svg",
    "bebida-1": "/demos/lancheria/bebida-1.svg",
    "bebida-2": "/demos/lancheria/bebida-2.svg",
    "bebida-3": "/demos/lancheria/bebida-3.svg",
    "bebida-4": "/demos/lancheria/bebida-4.svg",
    "bebida-5": "/demos/lancheria/bebida-5.svg",
    "acompanhamento-1": "/demos/lancheria/acompanhamento-1.svg",
    "acompanhamento-2": "/demos/lancheria/acompanhamento-2.svg",
    "acompanhamento-3": "/demos/lancheria/acompanhamento-3.svg",
    "acompanhamento-4": "/demos/lancheria/acompanhamento-4.svg",
    "flutuante-bacon": "/demos/lancheria/flutuante-bacon.svg",
    "flutuante-queijo": "/demos/lancheria/flutuante-queijo.svg",
    "flutuante-bebida": "/demos/lancheria/flutuante-bebida.svg",
  },
};
