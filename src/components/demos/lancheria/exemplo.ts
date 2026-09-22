import type { DemoData } from "@/lib/demos/types";

/**
 * DemoData de exemplo da skin de lancheria — a base que a ficha do lead
 * pré-preenche e sobrescreve. O copy vem do material bruto
 * (skins-raw/lancheria), com marca e fotos genéricas: nada aqui identifica
 * o cliente original (Ingarandi Burger, Sarandi/PR).
 *
 * **Sem `endereco`.** Um endereço fictício no exemplo não é conteúdo
 * neutro: `dadosDoLead` omite campo ausente em vez de apagá-lo, então um
 * lead SEM endereço herdava "Av. Principal, 500 — Centro" e a demo pública
 * publicava uma rua inventada como se fosse a do negócio. `CAMPOS_IDENTIDADE`
 * — endereço, cidade, telefone, whatsapp, instagram, horários — não tem
 * default plausível: ou vem do lead, ou não existe.
 *
 * Com isso, a escada de identidade (ver `escadaDeDados` em ./Skin.tsx) nasce
 * VAZIA no exemplo, e a regra do vazio da §7 do plano passa a ser o caminho
 * NORMAL do harness e da demo avulsa, não uma borda que só um teste visita.
 */
export const LANCHERIA_EXEMPLO: DemoData = {
  nome: "CHAPA BURGER",
  slogan: "Hambúrgueres artesanais feitos com obsessão.",
  servicos: [
    {
      nome: "Smash Clássico",
      preco: "",
      precoValor: 29,
      descricao:
        "Dois smash burgers de 90g, queijo cheddar derretido, cebola na chapa e molho especial no pão brioche tostado.",
    },
    {
      nome: "Cheddar Bacon",
      preco: "",
      precoValor: 44,
      descricao:
        "Hambúrguer artesanal de 160g, creme de cheddar artesanal e tiras de bacon crocante no pão australiano.",
    },
    {
      nome: "Onion Crunch",
      preco: "",
      precoValor: 39,
      descricao: "Hambúrguer 160g, queijo prato, onion rings crocantes e molho barbecue rústico no pão brioche.",
    },
    {
      nome: "Clássico da Casa",
      preco: "",
      precoValor: 19,
      descricao:
        "Hambúrguer 160g, queijo prato, alface americana, tomate italiano e maionese verde no pão tradicional.",
    },
    {
      nome: "Frango Crispy",
      preco: "",
      precoValor: 24,
      descricao: "Sobrecoxa desossada empanada e hiper crocante, alface, picles e maionese de limão siciliano.",
    },
    {
      nome: "Veggie do Chef",
      preco: "",
      precoValor: 34,
      descricao: "Hambúrguer de falafel crocante, queijo prato, rúcula fresca e maionese de alho assado.",
    },
  ],
  depoimentos: [],
  secoes: {
    hero: {
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
      texto: "FEITO COM OBSESSÃO",
    },
  },
  /**
   * Um alt por slot de imagem — os VINTE (opt-in por skin, ver
   * `DemoData.imagensAlt`). Antes disso o alt era DERIVADO da copy
   * (`"Ambiente de " + nome`, o nome do serviço, o título do item, `""` no
   * prato vazio e nos flutuantes): texto em português cravado no
   * componente, invisível para quem edita e impossível de traduzir. Aqui
   * ele é conteúdo, como qualquer outro.
   *
   * Os três flutuantes nascem VAZIOS de propósito: são decoração, e alt
   * vazio é o que diz isso a um leitor de tela. O campo existe no editor
   * para quem troca a imagem por algo que signifique alguma coisa — e é
   * por isso que o elemento deixou de ser `aria-hidden` (ver
   * ./interactive/DecorativeFloat.tsx): com `aria-hidden`, um alt
   * preenchido não chegaria a ninguém.
   *
   * As quatro variantes compartilham estes alts: as FOTOS são as mesmas nas
   * quatro (a trava de `variantes.test.tsx` exige chave e valor iguais), e
   * um alt descreve a foto, não a cópia em volta dela.
   */
  imagensAlt: {
    hero: "Ambiente da casa",
    "prato-vazio": "Prato vazio, revelado sob a foto do lanche",
    "lanche-1": "Foto do 1º lanche do cardápio",
    "lanche-2": "Foto do 2º lanche do cardápio",
    "lanche-3": "Foto do 3º lanche do cardápio",
    "lanche-4": "Foto do 4º lanche do cardápio",
    "lanche-5": "Foto do 5º lanche do cardápio",
    "lanche-6": "Foto do 6º lanche do cardápio",
    "bebida-1": "Foto da 1ª bebida",
    "bebida-2": "Foto da 2ª bebida",
    "bebida-3": "Foto da 3ª bebida",
    "bebida-4": "Foto da 4ª bebida",
    "bebida-5": "Foto da 5ª bebida",
    "acompanhamento-1": "Foto do 1º acompanhamento",
    "acompanhamento-2": "Foto do 2º acompanhamento",
    "acompanhamento-3": "Foto do 3º acompanhamento",
    "acompanhamento-4": "Foto do 4º acompanhamento",
    "flutuante-bacon": "",
    "flutuante-queijo": "",
    "flutuante-bebida": "",
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
