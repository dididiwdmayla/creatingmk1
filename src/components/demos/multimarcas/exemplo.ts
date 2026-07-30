import type { DemoData } from "@/lib/demos/types";

/**
 * DemoData de exemplo da skin "Multimarcas Vórtice" — a base que a ficha
 * do lead pré-preenche. Copy fiel ao material bruto (skins-raw/multimarcas
 * — "Vórtice Motors"), com endereço/telefone/CNPJ genéricos: nada aqui
 * identifica o cliente original. O estoque de exemplo (9 veículos) já era
 * dado fictício no material bruto (marcas/modelos/preços de mercado, sem
 * ligação com nenhum cliente real) — mantido como está.
 *
 * Cada veículo é um `DemoServico`: `categoria` alimenta o filtro de
 * estoque, `destaques` vira os chips (ano/km/câmbio/combustível) e
 * `descricao` vira o parágrafo do painel "detalhes" (motor/cor/placa).
 */
export const MULTIMARCAS_EXEMPLO: DemoData = {
  nome: "Vórtice Motors",
  slogan: "Seminovos premium com procedência auditada e garantia de 12 meses.",
  endereco: "Av. Principal, 1000 — Centro",
  telefone: "(00) 0000-0000",
  whatsapp: "(00) 90000-0000",
  instagram: "@suamultimarcas",
  cidade: "Sua Cidade — Seu Estado",
  horarios: "Seg–Sex 9h às 19h · Sáb 9h às 16h",
  servicos: [
    {
      nome: "Hyundai HB20 Platinum",
      preco: "R$ 89.900",
      categoria: "Hatch",
      destaques: ["2023", "18.200 km", "Automático", "Flex"],
      descricao: "Motor 1.0 Turbo · Cor Cinza Silk · Final de placa 4",
    },
    {
      nome: "VW Polo GTS",
      preco: "R$ 112.900",
      categoria: "Hatch",
      destaques: ["2022", "27.400 km", "Automático", "Flex"],
      descricao: "Motor 1.4 TSI · Cor Branco Puro · Final de placa 7",
    },
    {
      nome: "Honda Civic Touring",
      preco: "R$ 159.900",
      categoria: "Sedan",
      destaques: ["2021", "41.300 km", "CVT", "Gasolina"],
      descricao: "Motor 1.5 Turbo · Cor Preto Cristal · Final de placa 2",
    },
    {
      nome: "Toyota Corolla Altis Hybrid",
      preco: "R$ 154.900",
      categoria: "Sedan",
      destaques: ["2023", "22.800 km", "CVT", "Híbrido"],
      descricao: "Motor 1.8 Híbrido · Cor Prata Supernova · Final de placa 9",
    },
    {
      nome: "Jeep Compass Limited",
      preco: "R$ 142.900",
      categoria: "SUV",
      destaques: ["2022", "33.600 km", "Automático", "Flex"],
      descricao: "Motor 1.3 T270 · Cor Cinza Granite · Final de placa 1",
    },
    {
      nome: "VW T-Cross Highline",
      preco: "R$ 129.900",
      categoria: "SUV",
      destaques: ["2022", "35.100 km", "Automático", "Flex"],
      descricao: "Motor 1.4 TSI · Cor Azul Norway · Final de placa 5",
    },
    {
      nome: "Toyota Hilux SRX",
      preco: "R$ 219.900",
      categoria: "Picape",
      destaques: ["2021", "58.400 km", "Automático", "Diesel"],
      descricao: "Motor 2.8 Diesel · Cor Vermelho Volcano · Final de placa 3",
    },
    {
      nome: "Ford Ranger Limited",
      preco: "R$ 208.900",
      categoria: "Picape",
      destaques: ["2022", "44.700 km", "Automático", "Diesel"],
      descricao: "Motor 3.2 Diesel · Cor Preto Bristol · Final de placa 8",
    },
    {
      nome: "BMW M240i Coupé",
      preco: "R$ 389.900",
      categoria: "Esportivo",
      destaques: ["2022", "15.900 km", "Automático", "Gasolina"],
      descricao: "Motor 3.0 Turbo 6cil · Cor Thundernight · Final de placa 6",
    },
  ],
  depoimentos: [
    {
      autor: "Renata Albuquerque",
      contexto: "Jeep Compass Limited 2022",
      texto:
        "Cheguei desconfiada, saí com o carro no mesmo dia. O laudo cautelar na mesa antes de eu pedir foi o que me ganhou.",
    },
    {
      autor: "Carlos Menezes",
      contexto: "Toyota Hilux SRX 2021",
      texto:
        "Terceira compra na Vórtice. A avaliação da minha antiga foi justa e a diferença caiu no PIX na hora.",
    },
    {
      autor: "Fernanda Ito",
      contexto: "Honda Civic Touring 2021",
      texto: "Financiamento aprovado enquanto eu tomava café. Voltei pra casa dirigindo o Civic.",
    },
    {
      autor: "Diego Rocha",
      contexto: "BMW M240i 2022",
      texto: "Carro de sonho exige confiança. Revisaram tudo comigo do lado, item por item, sem pressa.",
    },
    {
      autor: "Patrícia Lemos",
      contexto: "VW T-Cross Highline 2022",
      texto: "Entregaram em Campinas num sábado, com documento pronto. Zero dor de cabeça.",
    },
  ],
  secoes: {
    hero: {
      rotulo: "SEMINOVOS PREMIUM",
      titulo: "Seu próximo carro já está aqui",
      texto:
        "Procedência auditada, revisão de 150 itens e garantia de 12 meses. Sem surpresa, sem letra miúda — só carro bom.",
      cta: "Ver estoque",
      ctaSecundaria: "Falar no WhatsApp",
    },
    estoque: {
      rotulo: "ESTOQUE",
      titulo: "Máquinas prontas pra rodar",
      texto: "Revisão de 150 itens ✓",
      cta: "Tenho interesse",
      ctaSecundaria: "Detalhes",
    },
    vantagens: {
      rotulo: "POR QUE A VÓRTICE",
      titulo: "Comprar bem não é sorte. É processo.",
      itens: [
        {
          titulo: "Procedência verificada",
          texto: "Laudo cautelar aprovado e histórico completo, na mesa, antes de você pedir.",
        },
        {
          titulo: "Garantia de 12 meses",
          texto: "Motor e câmbio cobertos por um ano. Sem asterisco, sem pegadinha.",
        },
        {
          titulo: "Financiamento ágil",
          texto: "Aprovação em até 30 minutos com os principais bancos do mercado.",
        },
        {
          titulo: "Entrega assistida",
          texto: "Documentação, transferência e entrega onde você estiver, em todo o Brasil.",
        },
      ],
    },
    numeros: {
      itens: [
        { titulo: "+1.200", detalhe: "carros entregues" },
        { titulo: "4,9★", detalhe: "avaliação no Google" },
        { titulo: "15 anos", detalhe: "de estrada" },
      ],
    },
    simulador: {
      rotulo: "SIMULADOR",
      titulo: "Quanto fica por mês?",
      texto: "Um plano sob medida pro seu bolso.",
      cta: "Solicitar proposta",
    },
    avaliacao: {
      rotulo: "QUERO VENDER MEU CARRO",
      titulo: "Avaliamos seu carro na hora",
      texto: "Pagamento à vista ou na troca. Avaliação presencial em 40 minutos, sem compromisso.",
      cta: "Receber avaliação",
      itens: [
        { titulo: "Fiat" },
        { titulo: "Volkswagen" },
        { titulo: "Chevrolet" },
        { titulo: "Toyota" },
        { titulo: "Honda" },
        { titulo: "Hyundai" },
        { titulo: "Jeep" },
        { titulo: "Renault" },
        { titulo: "Nissan" },
        { titulo: "Ford" },
        { titulo: "BMW" },
        { titulo: "Audi" },
      ],
    },
    depoimentos: {
      rotulo: "DEPOIMENTOS",
      titulo: "Quem já assinou embaixo",
    },
    contato: {
      rotulo: "ONDE ESTAMOS",
      titulo: "Vem tomar um café",
      cta: "Chamar no WhatsApp",
    },
  },
  ordemSecoes: ["estoque", "vantagens", "numeros", "simulador", "avaliacao", "depoimentos", "contato"],
  imagens: {
    "carro-1": "/demos/multimarcas/carro-1.svg",
    "carro-2": "/demos/multimarcas/carro-2.svg",
    "carro-3": "/demos/multimarcas/carro-3.svg",
    "carro-4": "/demos/multimarcas/carro-4.svg",
    "carro-5": "/demos/multimarcas/carro-5.svg",
    "carro-6": "/demos/multimarcas/carro-6.svg",
    "carro-7": "/demos/multimarcas/carro-7.svg",
    "carro-8": "/demos/multimarcas/carro-8.svg",
    "carro-9": "/demos/multimarcas/carro-9.svg",
  },
};
