import type { DemoData } from "@/lib/demos/types";

/**
 * DemoData de exemplo da skin de petshop — a base que a ficha do lead
 * pré-preenche e sobrescreve. O copy vem do material bruto
 * (skins-raw/petshop, "Aumigo & Cia"), com marca e fotos genéricas: nada
 * aqui identifica o cliente original (Rua das Acácias, Vila Mariana etc.
 * viraram endereço/bairro fictícios).
 */
export const PETSHOP_EXEMPLO: DemoData = {
  nome: "Focinho Feliz",
  slogan: "Banho, tosa, spa e mimos para quem te recebe abanando o rabo.",
  endereco: "Rua das Begônias, 240 — Jardim das Flores",
  servicos: [
    {
      nome: "Banho & Tosa",
      preco: "a partir de R$ 60",
      descricao: "Banho morno, shampoo hipoalergênico e tosa no estilo que combina com ele.",
    },
    {
      nome: "Hidratação & Spa",
      preco: "a partir de R$ 90",
      descricao: "Máscara hidratante, escovação profunda e aquele brilho de comercial.",
    },
    {
      nome: "Day Care",
      preco: "a partir de R$ 75",
      descricao: "Um dia inteiro de brincadeira supervisionada enquanto você trabalha.",
    },
    {
      nome: "Táxi Pet",
      preco: "a partir de R$ 25",
      descricao: "Buscamos e devolvemos seu pet em casa, com cinto e ar-condicionado.",
    },
  ],
  depoimentos: [
    {
      autor: "Nina — golden retriever, tutora Carla M.",
      texto:
        "A Nina entra correndo e nem olha pra trás. Fico até com ciúmes, mas passa quando ela volta cheirosa.",
      nota: 5,
    },
    {
      autor: "Thor — bulldog francês, tutor Rafael S.",
      texto: "O Thor odiava banho. Hoje ele senta na porta do carro esperando o dia de spa. Inexplicável.",
      nota: 5,
    },
    {
      autor: "Mel — SRD, tutora Juliana P.",
      texto:
        "A tosa da Mel ficou tão boa que a vizinha perguntou se era outra cachorra. Era só a Mel, deslumbrante.",
      nota: 5,
    },
  ],
  secoes: {
    hero: {
      rotulo: "Banho · Tosa · Spa · Day care",
      texto: "Banho quentinho, tosa com estilo e um time que trata cada pet como o pet favorito. Spoiler: aqui, são todos.",
      cta: "Agendar horário",
      ctaSecundaria: "Conhecer serviços",
      itens: [
        { titulo: "4,9★", subtitulo: "480 avaliações no Google" },
        { titulo: "agende hoje · rabo abanando · agende hoje ·" },
      ],
    },
    faixa: {
      itens: [
        { titulo: "amor de verdade" },
        { titulo: "secagem sem gaiola" },
        { titulo: "produtos hipoalergênicos" },
        { titulo: "câmeras ao vivo pro tutor" },
        { titulo: "táxi pet porta a porta" },
        { titulo: "petiscos no final" },
      ],
    },
    numeros: {
      itens: [
        { titulo: "+3.000", subtitulo: "pets atendidos (e cheirados)" },
        { titulo: "12", subtitulo: "anos de carinho no bairro" },
        { titulo: "4,9★", subtitulo: "de nota no Google" },
      ],
    },
    servicos: {
      rotulo: "Serviços",
      titulo: "Do banho rápido ao dia de spa completo",
      cta: "Ver todos os serviços",
    },
    comoFunciona: {
      rotulo: "Como funciona",
      titulo: "Simples assim, em três passos",
      itens: [
        {
          titulo: "Agende em 2 minutos",
          texto: "Escolha serviço, dia e horário direto pelo site. Sem telefone ocupado.",
        },
        {
          titulo: "Traga seu melhor amigo",
          texto: "Recepção com carinho, ficha de cuidados e câmera ao vivo pra você espiar.",
        },
        {
          titulo: "Busque ele feliz",
          texto: "Cheiroso, macio e convencido. Prepare-se para muitos elogios na rua.",
        },
      ],
    },
    depoimentos: {
      rotulo: "Depoimentos",
      titulo: "Quem já saiu daqui abanando o rabo",
    },
    equipe: {
      rotulo: "Equipe",
      titulo: "Gente que fala “quem é o bebê?” sem vergonha",
      texto: "Nossa equipe é contratada por dois critérios: competência técnica e quantidade de fotos de animais no celular.",
      itens: [
        {
          titulo: "Marina Duarte",
          subtitulo: "Fundadora",
          texto: "“Tutora de três resgatados. Chora em comercial de ração.”",
        },
        {
          titulo: "Beto Sales",
          subtitulo: "Groomer sênior",
          texto: "“12 anos de tesoura. Pai de 3 gatos resgatados — sim, ele insiste no 'pai'.”",
        },
        {
          titulo: "Dra. Fernanda Lima",
          subtitulo: "Veterinária parceira",
          texto: "“Especialista em pets idosos. Fala com os pacientes em voz de bebê, sem exceção.”",
        },
        {
          titulo: "Kaique Rocha",
          subtitulo: "Recreador do day care",
          texto: "“Corre 5km por dia — 4 deles atrás de cachorro no quintal. Ídolo da turma da tarde.”",
        },
      ],
    },
    diferenciais: {
      rotulo: "Diferenciais",
      titulo: "No que a gente não abre mão",
      itens: [
        {
          titulo: "Secagem sem gaiola",
          texto: "Nunca tivemos, nunca teremos. Secagem é manual, no colo ou na mesa, no ritmo de cada pet.",
        },
        {
          titulo: "Produtos hipoalergênicos",
          texto: "Linha completa hipoalergênica e vegana. Pele sensível não é problema, é só uma informação.",
        },
        {
          titulo: "Câmeras ao vivo",
          texto: "Acompanhe tudo pelo app, em tempo real. Transparência total — e vídeos fofos de bônus.",
        },
        {
          titulo: "Um pet por vez",
          texto: "Nada de linha de produção. Cada pet tem seu horário, seu profissional e sua atenção exclusiva.",
        },
        {
          titulo: "Manejo gentil, sempre",
          texto: "Sem contenção forçada. Pet estressado ganha pausa, paciência e outra tentativa — nunca força.",
        },
        {
          titulo: "Preço transparente",
          texto: "O valor combinado é o valor cobrado. Qualquer acréscimo é avisado antes, nunca na hora de pagar.",
        },
      ],
    },
    galeria: {
      rotulo: "Clientes da semana",
      titulo: "Clientes da semana",
      texto: "Passe o mouse para conhecer a turma que saiu daqui cheirosa.",
      itens: [
        { titulo: "Pipoca" },
        { titulo: "Baguete" },
        { titulo: "Frida" },
        { titulo: "Simba" },
        { titulo: "Olívia" },
        { titulo: "Jorge" },
      ],
    },
    ctaFinal: {
      titulo: "Bora marcar aquele banho que ele finge que odeia?",
      texto: "Agende online em dois minutos. A gente cuida do resto — inclusive dos beijos de despedida.",
      cta: "Agendar horário",
    },
    contato: {
      cta: "Chamar no WhatsApp",
      texto: "Feito com carinho e pelos de pet no teclado.",
    },
  },
  ordemSecoes: [
    "faixa",
    "numeros",
    "servicos",
    "comoFunciona",
    "depoimentos",
    "equipe",
    "diferenciais",
    "galeria",
    "ctaFinal",
    "contato",
  ],
  imagens: {
    hero: "/demos/petshop/hero.svg",
    "servico-1": "/demos/petshop/servico-1.svg",
    "servico-2": "/demos/petshop/servico-2.svg",
    "servico-3": "/demos/petshop/servico-3.svg",
    "servico-4": "/demos/petshop/servico-4.svg",
    "equipe-1": "/demos/petshop/equipe-1.svg",
    "equipe-2": "/demos/petshop/equipe-2.svg",
    "equipe-3": "/demos/petshop/equipe-3.svg",
    "equipe-4": "/demos/petshop/equipe-4.svg",
    "galeria-1": "/demos/petshop/galeria-1.svg",
    "galeria-2": "/demos/petshop/galeria-2.svg",
    "galeria-3": "/demos/petshop/galeria-3.svg",
    "galeria-4": "/demos/petshop/galeria-4.svg",
    "galeria-5": "/demos/petshop/galeria-5.svg",
    "galeria-6": "/demos/petshop/galeria-6.svg",
  },
};
