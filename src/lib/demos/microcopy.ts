import { IDIOMA_PADRAO } from "@/lib/idioma";

/**
 * Microcópia de CHROME das skins (indicadores de scroll, rodapé, rótulos de
 * acessibilidade, "X de 5 estrelas"…) — texto fixo no COMPONENTE, não em
 * `DemoData`, então nunca passava pelo idioma da IA (ver "Idioma da IA na
 * demo" em ARCHITECTURE.md). Este módulo é o equivalente, para essas
 * strings, do que `resumirHorarios` já faz para horários: troca só a
 * APRESENTAÇÃO por raiz do BCP-47, de forma determinística e sem IA —
 * reaproveita a MESMA raiz (`idioma.split("-")[0]`) que `idiomaLabel` usa em
 * `@/lib/idioma`. Raiz sem entrada (ou idioma ausente) cai em `pt`, o mesmo
 * default de `IDIOMA_PADRAO`.
 *
 * Cada skin escolhe, entre estas chaves, só as que usa — nenhuma skin usa
 * todas. Textos de VENDA (taglines, CTAs com voz própria da skin) continuam
 * fora daqui: são conteúdo, e vivem em `DemoData`/`exemplo.ts`, não nesta
 * camada de apresentação.
 *
 * A linha divisória é o SLOT, não o assunto. Uma mensagem de WhatsApp que a
 * skin expõe como slot editável é conteúdo e fica em `DemoData`; uma que
 * está cravada no componente, sem slot nenhum, é cromo e mora aqui — senão
 * uma demo em de-CH manda o visitante abrir o WhatsApp com uma frase em
 * português, e não há onde corrigir isso.
 */

type RaizMicrocopia = "pt" | "en" | "es" | "fr" | "de" | "it" | "nl";

export interface DemoMicrocopia {
  /** Indicador de scroll em caixa alta, sem seta (ex.: lancheria "ROLE"). */
  role: string;
  pular: string;
  /**
   * Indicador de scroll em caixa alta "estilizado" (mantém o anglicismo
   * "SCROLL" também em pt-BR — voz de marca do painel da multimarcas,
   * fiel ao material bruto — mas ainda traduz nas demais raízes).
   */
  scrollEstilizado: string;
  /** Indicador de scroll em frase (ex.: barbearia2 "↓ Desça" — a seta é decorativa, fica no componente). */
  desca: string;
  /** "Todos os direitos reservados." — frase de rodapé; UPPERCASE fica a cargo do componente. */
  direitosReservados: string;
  /** `"${nota} de 5 estrelas"` — aria-label de avaliação por estrelas. */
  avaliacaoEstrelas: (nota: number) => string;
  galeria: string;
  fazerPedido: string;
  agendarHorario: string;
  conversarNoWhatsapp: string;
  menu: string;
  fecharMenu: string;
  todos: string;
  disponivelNaVersaoCompleta: string;
  /** Fallback quando o preço fica vazio (nem prefixo nem valor) — ex.: card de imóvel sem preço informado. */
  semPreco: string;
  endereco: string;
  horario: string;
  telefone: string;
  faleComAGente: string;
  /** Rótulo neutro de uma seção de contato, quando o título dela está vazio. */
  contato: string;
  navegue: string;
  redes: string;
  /** Rótulo do botão que escolhe um item do cardápio; a CAIXA ALTA é do componente. */
  escolher: string;
  /** `aria-label` do botão de escolher um item nomeado. */
  escolherItem: (item: string) => string;
  /** `aria-label` do botão de somar um item nomeado ao pedido. */
  adicionarItem: (item: string) => string;
  /** Mensagem pronta de WhatsApp, sem item — o botão genérico de pedido. */
  pedidoMensagem: string;
  /** Mensagem pronta de WhatsApp para um item nomeado. */
  pedidoDoItem: (item: string) => string;
  /**
   * As frases que aparecem sobre a foto quando a LENTE do cardápio da
   * chapa burger abre. São decoração cravada no componente — não têm slot,
   * ninguém as edita —, e por isso são cromo: numa demo em outro idioma,
   * uma piada em português sobre a foto é só uma frase que ninguém lê.
   */
  frasesDaLente: readonly string[];
  /** Faixa de preço aberta embaixo (multimarcas): `"Até R$ 60.000"`; o valor já vem formatado. */
  faixaAte: (valor: string) => string;
  /** Faixa de preço fechada: `"R$ 60.000 a R$ 90.000"`. */
  faixaEntre: (de: string, ate: string) => string;
  /** Faixa de preço aberta em cima: `"Acima de R$ 120.000"`. */
  faixaAcima: (valor: string) => string;
  /** `aria-label` do grupo de filtros por faixa de preço. */
  faixaDePreco: string;
  /** Botão do card de veículo que leva o preço dele ao simulador (multimarcas). */
  simularEsteCarro: string;
  /** Rótulos do formulário de troca (multimarcas): marca, modelo, ano, km. */
  trocaMarca: string;
  trocaModelo: string;
  trocaAno: string;
  trocaKm: string;
  /** Mensagem de WhatsApp de avaliação SEM dado do carro (e o envio sem JavaScript). */
  trocaMensagem: string;
  /** Mensagem de WhatsApp de avaliação com a descrição do carro já montada. */
  trocaMensagemCarro: (carro: string) => string;
  /*
   * ── Multimarcas: rótulos de seção da nav (fallback quando a seção não
   * tem `rotulo`), do simulador, das rotas e das mensagens de WhatsApp
   * cravadas no componente (sem slot — por isso cromo, ver o topo).
   */
  navEstoque: string;
  navVantagens: string;
  navDestaque: string;
  navSimulador: string;
  navAvaliacao: string;
  navDepoimentos: string;
  simValorDoVeiculo: string;
  /** Rótulo da entrada com o percentual: `"ENTRADA · 20%"` (a caixa alta é do componente). */
  simEntrada: (pct: number) => string;
  simParcelas: string;
  simParcelaEstimada: string;
  /** Sufixo da parcela: `"/mês"`. */
  simPorMes: string;
  /** `"Financiado: R$ 96.000 em 48× · taxa ref. 1,49% a.m."` — valores já formatados. */
  simFinanciado: (valor: string, parcelas: number, taxa: string) => string;
  simAviso: string;
  /** Rótulo do botão quando o slot do CTA está vazio. */
  simSolicitarProposta: string;
  /** Mensagem de WhatsApp da simulação — valores já formatados com a moeda. */
  simMensagem: (veiculo: string, entrada: string, parcelas: number, parcela: string) => string;
  abrirNoWaze: string;
  abrirNoMaps: string;
  /** Mensagem genérica de WhatsApp (nav, botão flutuante). */
  maisInformacoes: string;
  /** Mensagem de WhatsApp do contato, com o nome do negócio. */
  maisInformacoesDe: (nome: string) => string;
  /** Interesse num carro do estoque — nome e preço já formatado. */
  interesseNoCarro: (carro: string, preco: string) => string;
  /** Interesse no veículo em destaque — carro e nome do negócio. */
  interesseNoDestaque: (carro: string, nome: string) => string;
  /** Carro genérico quando o destaque não tem título. */
  veiculoEmDestaque: string;
  /** Legenda do mostrador do velocímetro (conta-giros): `"RPM ×1000"`. */
  rpm: string;
}

const PT: DemoMicrocopia = {
  pular: "Pular",
  role: "ROLE",
  scrollEstilizado: "SCROLL",
  desca: "Desça",
  direitosReservados: "Todos os direitos reservados.",
  avaliacaoEstrelas: (nota) => `${nota} de 5 estrelas`,
  galeria: "Galeria",
  fazerPedido: "Fazer pedido",
  agendarHorario: "Agendar horário",
  conversarNoWhatsapp: "Conversar no WhatsApp",
  menu: "Menu",
  fecharMenu: "Fechar menu",
  todos: "Todos",
  disponivelNaVersaoCompleta: "Disponível na versão completa",
  semPreco: "Sob consulta",
  endereco: "Endereço",
  horario: "Horário",
  telefone: "Telefone",
  faleComAGente: "Fale com a gente",
  contato: "Contato",
  navegue: "Navegue",
  redes: "Redes",
  escolher: "Escolher",
  escolherItem: (item) => `Escolher ${item}`,
  adicionarItem: (item) => `Adicionar ${item}`,
  pedidoMensagem: "Olá! Gostaria de fazer um pedido.",
  pedidoDoItem: (item) => `Olá! Quero pedir: ${item}.`,
  frasesDaLente: [
    "CUIDADO, LANCHE VICIANTE!",
    "PEDE LOGO, É UMA DELÍCIA!",
    "PEDE O SEU, QUE ESSE JÁ É MEU 😏",
  ],
  faixaAte: (v) => `Até ${v}`,
  faixaEntre: (de, ate) => `${de} a ${ate}`,
  faixaAcima: (v) => `Acima de ${v}`,
  faixaDePreco: "Faixa de preço",
  simularEsteCarro: "Simular este carro",
  trocaMarca: "Marca",
  trocaModelo: "Modelo",
  trocaAno: "Ano",
  trocaKm: "Quilometragem",
  trocaMensagem: "Olá! Quero uma avaliação do meu carro.",
  trocaMensagemCarro: (carro) => `Olá! Quero avaliar meu carro na troca: ${carro}.`,
  navEstoque: "Estoque",
  navVantagens: "Vantagens",
  navDestaque: "Destaque",
  navSimulador: "Simulador",
  navAvaliacao: "Avaliação",
  navDepoimentos: "Depoimentos",
  simValorDoVeiculo: "Valor do veículo",
  simEntrada: (pct) => `Entrada · ${pct}%`,
  simParcelas: "Parcelas",
  simParcelaEstimada: "Parcela estimada",
  simPorMes: "/mês",
  simFinanciado: (valor, n, taxa) => `Financiado: ${valor} em ${n}× · taxa ref. ${taxa}% a.m.`,
  simAviso: "Valores simulados, sujeitos a análise de crédito.",
  simSolicitarProposta: "Solicitar proposta",
  simMensagem: (v, e, n, p) => `Olá! Simulei no site: veículo ${v}, entrada ${e}, ${n}x de ${p}. Quero uma proposta.`,
  abrirNoWaze: "Abrir no Waze",
  abrirNoMaps: "Abrir no Google Maps",
  maisInformacoes: "Olá! Vim pelo site e quero mais informações.",
  maisInformacoesDe: (nome) => `Olá! Vim pelo site da ${nome} e quero mais informações.`,
  interesseNoCarro: (carro, preco) => `Olá! Tenho interesse no ${carro} (${preco}). Ainda está disponível?`,
  interesseNoDestaque: (carro, nome) => `Olá! Tenho interesse no ${carro} que vi no site da ${nome}.`,
  veiculoEmDestaque: "veículo em destaque",
  rpm: "RPM ×1000",
};

const EN: DemoMicrocopia = {
  pular: "Skip",
  role: "SCROLL",
  scrollEstilizado: "SCROLL",
  desca: "Scroll",
  direitosReservados: "All rights reserved.",
  avaliacaoEstrelas: (nota) => `${nota} out of 5 stars`,
  galeria: "Gallery",
  fazerPedido: "Place order",
  agendarHorario: "Book appointment",
  conversarNoWhatsapp: "Chat on WhatsApp",
  menu: "Menu",
  fecharMenu: "Close menu",
  todos: "All",
  disponivelNaVersaoCompleta: "Available in the full version",
  semPreco: "Price on request",
  endereco: "Address",
  horario: "Hours",
  telefone: "Phone",
  faleComAGente: "Get in touch",
  contato: "Contact",
  navegue: "Explore",
  redes: "Social",
  escolher: "Choose",
  escolherItem: (item) => `Choose ${item}`,
  adicionarItem: (item) => `Add ${item}`,
  pedidoMensagem: "Hi! I'd like to place an order.",
  pedidoDoItem: (item) => `Hi! I'd like to order: ${item}.`,
  frasesDaLente: [
    "CAREFUL, THIS ONE IS ADDICTIVE!",
    "ORDER IT ALREADY, IT IS SO GOOD!",
    "GET YOUR OWN, THIS ONE IS MINE 😏",
  ],
  faixaAte: (v) => `Up to ${v}`,
  faixaEntre: (de, ate) => `${de} to ${ate}`,
  faixaAcima: (v) => `Over ${v}`,
  faixaDePreco: "Price range",
  simularEsteCarro: "Simulate this car",
  trocaMarca: "Make",
  trocaModelo: "Model",
  trocaAno: "Year",
  trocaKm: "Mileage",
  trocaMensagem: "Hi! I'd like my car appraised.",
  trocaMensagemCarro: (carro) => `Hi! I'd like to trade in my car: ${carro}.`,
  navEstoque: "Inventory",
  navVantagens: "Why us",
  navDestaque: "Featured",
  navSimulador: "Finance",
  navAvaliacao: "Trade-in",
  navDepoimentos: "Reviews",
  simValorDoVeiculo: "Vehicle price",
  simEntrada: (pct) => `Down payment · ${pct}%`,
  simParcelas: "Term",
  simParcelaEstimada: "Estimated payment",
  simPorMes: "/mo",
  simFinanciado: (valor, n, taxa) => `Financed: ${valor} over ${n} months · ref. rate ${taxa}%/mo`,
  simAviso: "Simulated figures, subject to credit approval.",
  simSolicitarProposta: "Request a quote",
  simMensagem: (v, e, n, p) => `Hi! I ran the numbers on your site: vehicle ${v}, down payment ${e}, ${n} payments of ${p}. I'd like a quote.`,
  abrirNoWaze: "Open in Waze",
  abrirNoMaps: "Open in Google Maps",
  maisInformacoes: "Hi! I found you through your website and would like more information.",
  maisInformacoesDe: (nome) => `Hi! I found ${nome} through your website and would like more information.`,
  interesseNoCarro: (carro, preco) => `Hi! I'm interested in the ${carro} (${preco}). Is it still available?`,
  interesseNoDestaque: (carro, nome) => `Hi! I'm interested in the ${carro} I saw on the ${nome} website.`,
  veiculoEmDestaque: "featured vehicle",
  rpm: "RPM ×1000",
};

const ES: DemoMicrocopia = {
  pular: "Omitir",
  role: "DESLIZA",
  scrollEstilizado: "SCROLL",
  desca: "Desliza",
  direitosReservados: "Todos los derechos reservados.",
  avaliacaoEstrelas: (nota) => `${nota} de 5 estrellas`,
  galeria: "Galería",
  fazerPedido: "Hacer pedido",
  agendarHorario: "Reservar horario",
  conversarNoWhatsapp: "Chatear por WhatsApp",
  menu: "Menú",
  fecharMenu: "Cerrar menú",
  todos: "Todos",
  disponivelNaVersaoCompleta: "Disponible en la versión completa",
  semPreco: "Consultar precio",
  endereco: "Dirección",
  horario: "Horario",
  telefone: "Teléfono",
  faleComAGente: "Hablemos",
  contato: "Contacto",
  navegue: "Explora",
  redes: "Redes",
  escolher: "Elegir",
  escolherItem: (item) => `Elegir ${item}`,
  adicionarItem: (item) => `Añadir ${item}`,
  pedidoMensagem: "¡Hola! Me gustaría hacer un pedido.",
  pedidoDoItem: (item) => `¡Hola! Quiero pedir: ${item}.`,
  frasesDaLente: [
    "¡CUIDADO, ESTE ENGANCHA!",
    "¡PÍDELO YA, ESTÁ BUENÍSIMO!",
    "PIDE EL TUYO, QUE ESTE YA ES MÍO 😏",
  ],
  faixaAte: (v) => `Hasta ${v}`,
  faixaEntre: (de, ate) => `De ${de} a ${ate}`,
  faixaAcima: (v) => `Más de ${v}`,
  faixaDePreco: "Rango de precio",
  simularEsteCarro: "Simular este auto",
  trocaMarca: "Marca",
  trocaModelo: "Modelo",
  trocaAno: "Año",
  trocaKm: "Kilometraje",
  trocaMensagem: "¡Hola! Quiero una tasación de mi auto.",
  trocaMensagemCarro: (carro) => `¡Hola! Quiero tasar mi auto como parte de pago: ${carro}.`,
  navEstoque: "Inventario",
  navVantagens: "Ventajas",
  navDestaque: "Destacado",
  navSimulador: "Simulador",
  navAvaliacao: "Tasación",
  navDepoimentos: "Opiniones",
  simValorDoVeiculo: "Valor del vehículo",
  simEntrada: (pct) => `Pie · ${pct}%`,
  simParcelas: "Cuotas",
  simParcelaEstimada: "Cuota estimada",
  simPorMes: "/mes",
  simFinanciado: (valor, n, taxa) => `Financiado: ${valor} en ${n} cuotas · tasa ref. ${taxa}% mensual`,
  simAviso: "Valores simulados, sujetos a aprobación de crédito.",
  simSolicitarProposta: "Solicitar propuesta",
  simMensagem: (v, e, n, p) => `¡Hola! Simulé en el sitio: vehículo ${v}, pie ${e}, ${n} cuotas de ${p}. Quiero una propuesta.`,
  abrirNoWaze: "Abrir en Waze",
  abrirNoMaps: "Abrir en Google Maps",
  maisInformacoes: "¡Hola! Vengo del sitio web y quiero más información.",
  maisInformacoesDe: (nome) => `¡Hola! Vengo del sitio de ${nome} y quiero más información.`,
  interesseNoCarro: (carro, preco) => `¡Hola! Me interesa el ${carro} (${preco}). ¿Sigue disponible?`,
  interesseNoDestaque: (carro, nome) => `¡Hola! Me interesa el ${carro} que vi en el sitio de ${nome}.`,
  veiculoEmDestaque: "vehículo destacado",
  rpm: "RPM ×1000",
};

const FR: DemoMicrocopia = {
  pular: "Passer",
  role: "DÉFILEZ",
  scrollEstilizado: "SCROLL",
  desca: "Défiler",
  direitosReservados: "Tous droits réservés.",
  avaliacaoEstrelas: (nota) => `${nota} sur 5 étoiles`,
  galeria: "Galerie",
  fazerPedido: "Passer commande",
  agendarHorario: "Prendre rendez-vous",
  conversarNoWhatsapp: "Discuter sur WhatsApp",
  menu: "Menu",
  fecharMenu: "Fermer le menu",
  todos: "Tous",
  disponivelNaVersaoCompleta: "Disponible dans la version complète",
  semPreco: "Prix sur demande",
  endereco: "Adresse",
  horario: "Horaires",
  telefone: "Téléphone",
  faleComAGente: "Contactez-nous",
  contato: "Contact",
  navegue: "Explorer",
  redes: "Réseaux",
  escolher: "Choisir",
  escolherItem: (item) => `Choisir ${item}`,
  adicionarItem: (item) => `Ajouter ${item}`,
  pedidoMensagem: "Bonjour ! Je voudrais passer une commande.",
  pedidoDoItem: (item) => `Bonjour ! Je voudrais commander : ${item}.`,
  frasesDaLente: [
    "ATTENTION, C'EST ADDICTIF !",
    "COMMANDE-LE VITE, C'EST UN DÉLICE !",
    "PRENDS LE TIEN, CELUI-LÀ EST À MOI 😏",
  ],
  faixaAte: (v) => `Jusqu’à ${v}`,
  faixaEntre: (de, ate) => `De ${de} à ${ate}`,
  faixaAcima: (v) => `Plus de ${v}`,
  faixaDePreco: "Fourchette de prix",
  simularEsteCarro: "Simuler ce véhicule",
  trocaMarca: "Marque",
  trocaModelo: "Modèle",
  trocaAno: "Année",
  trocaKm: "Kilométrage",
  trocaMensagem: "Bonjour ! Je voudrais faire estimer ma voiture.",
  trocaMensagemCarro: (carro) => `Bonjour ! Je voudrais faire reprendre ma voiture : ${carro}.`,
  navEstoque: "Stock",
  navVantagens: "Nos atouts",
  navDestaque: "À la une",
  navSimulador: "Simulateur",
  navAvaliacao: "Reprise",
  navDepoimentos: "Avis",
  simValorDoVeiculo: "Prix du véhicule",
  simEntrada: (pct) => `Apport · ${pct} %`,
  simParcelas: "Mensualités",
  simParcelaEstimada: "Mensualité estimée",
  simPorMes: "/mois",
  simFinanciado: (valor, n, taxa) => `Financé : ${valor} sur ${n} mois · taux de réf. ${taxa} %/mois`,
  simAviso: "Montants simulés, sous réserve d’acceptation du crédit.",
  simSolicitarProposta: "Demander une offre",
  simMensagem: (v, e, n, p) => `Bonjour ! J’ai fait une simulation sur le site : véhicule ${v}, apport ${e}, ${n} mensualités de ${p}. Je voudrais une offre.`,
  abrirNoWaze: "Ouvrir dans Waze",
  abrirNoMaps: "Ouvrir dans Google Maps",
  maisInformacoes: "Bonjour ! Je viens du site et je voudrais plus d’informations.",
  maisInformacoesDe: (nome) => `Bonjour ! Je viens du site de ${nome} et je voudrais plus d’informations.`,
  interesseNoCarro: (carro, preco) => `Bonjour ! Le ${carro} (${preco}) m’intéresse. Est-il toujours disponible ?`,
  interesseNoDestaque: (carro, nome) => `Bonjour ! Le ${carro} vu sur le site de ${nome} m’intéresse.`,
  veiculoEmDestaque: "véhicule à la une",
  rpm: "TR/MIN ×1000",
};

const DE: DemoMicrocopia = {
  pular: "Überspringen",
  role: "SCROLLEN",
  scrollEstilizado: "SCROLL",
  desca: "Scrollen",
  direitosReservados: "Alle Rechte vorbehalten.",
  avaliacaoEstrelas: (nota) => `${nota} von 5 Sternen`,
  galeria: "Galerie",
  fazerPedido: "Bestellen",
  agendarHorario: "Termin buchen",
  conversarNoWhatsapp: "Auf WhatsApp chatten",
  menu: "Menü",
  fecharMenu: "Menü schließen",
  todos: "Alle",
  disponivelNaVersaoCompleta: "Verfügbar in der Vollversion",
  semPreco: "Preis auf Anfrage",
  endereco: "Adresse",
  horario: "Öffnungszeiten",
  telefone: "Telefon",
  faleComAGente: "Kontaktieren Sie uns",
  contato: "Kontakt",
  navegue: "Entdecken",
  redes: "Social Media",
  escolher: "Auswählen",
  escolherItem: (item) => `${item} auswählen`,
  adicionarItem: (item) => `${item} hinzufügen`,
  pedidoMensagem: "Hallo! Ich möchte gerne bestellen.",
  pedidoDoItem: (item) => `Hallo! Ich möchte bestellen: ${item}.`,
  frasesDaLente: [
    "VORSICHT, MACHT SÜCHTIG!",
    "BESTELL IHN, ER IST EIN TRAUM!",
    "HOL DIR DEINEN, DER HIER IST MEINER 😏",
  ],
  faixaAte: (v) => `Bis ${v}`,
  faixaEntre: (de, ate) => `${de} bis ${ate}`,
  faixaAcima: (v) => `Über ${v}`,
  faixaDePreco: "Preisspanne",
  simularEsteCarro: "Dieses Auto berechnen",
  trocaMarca: "Marke",
  trocaModelo: "Modell",
  trocaAno: "Baujahr",
  trocaKm: "Kilometerstand",
  trocaMensagem: "Hallo! Ich möchte mein Auto bewerten lassen.",
  trocaMensagemCarro: (carro) => `Hallo! Ich möchte mein Auto in Zahlung geben: ${carro}.`,
  navEstoque: "Bestand",
  navVantagens: "Vorteile",
  navDestaque: "Highlight",
  navSimulador: "Rechner",
  navAvaliacao: "Inzahlungnahme",
  navDepoimentos: "Bewertungen",
  simValorDoVeiculo: "Fahrzeugpreis",
  simEntrada: (pct) => `Anzahlung · ${pct} %`,
  simParcelas: "Laufzeit",
  simParcelaEstimada: "Geschätzte Rate",
  simPorMes: "/Monat",
  simFinanciado: (valor, n, taxa) => `Finanziert: ${valor} über ${n} Monate · Ref.-Zins ${taxa} %/Monat`,
  simAviso: "Simulierte Werte, vorbehaltlich Bonitätsprüfung.",
  simSolicitarProposta: "Angebot anfordern",
  simMensagem: (v, e, n, p) => `Hallo! Ich habe auf der Website gerechnet: Fahrzeug ${v}, Anzahlung ${e}, ${n} Raten à ${p}. Ich möchte ein Angebot.`,
  abrirNoWaze: "In Waze öffnen",
  abrirNoMaps: "In Google Maps öffnen",
  maisInformacoes: "Hallo! Ich komme von der Website und hätte gerne mehr Informationen.",
  maisInformacoesDe: (nome) => `Hallo! Ich komme von der Website von ${nome} und hätte gerne mehr Informationen.`,
  interesseNoCarro: (carro, preco) => `Hallo! Ich interessiere mich für den ${carro} (${preco}). Ist er noch verfügbar?`,
  interesseNoDestaque: (carro, nome) => `Hallo! Ich interessiere mich für den ${carro} von der Website von ${nome}.`,
  veiculoEmDestaque: "Fahrzeug im Highlight",
  rpm: "U/MIN ×1000",
};

const IT: DemoMicrocopia = {
  pular: "Salta",
  role: "SCORRI",
  scrollEstilizado: "SCROLL",
  desca: "Scorri",
  direitosReservados: "Tutti i diritti riservati.",
  avaliacaoEstrelas: (nota) => `${nota} su 5 stelle`,
  galeria: "Galleria",
  fazerPedido: "Ordina ora",
  agendarHorario: "Prenota un appuntamento",
  conversarNoWhatsapp: "Chatta su WhatsApp",
  menu: "Menu",
  fecharMenu: "Chiudi menu",
  todos: "Tutti",
  disponivelNaVersaoCompleta: "Disponibile nella versione completa",
  semPreco: "Prezzo su richiesta",
  endereco: "Indirizzo",
  horario: "Orario",
  telefone: "Telefono",
  faleComAGente: "Contattaci",
  contato: "Contatti",
  navegue: "Esplora",
  redes: "Social",
  escolher: "Scegli",
  escolherItem: (item) => `Scegli ${item}`,
  adicionarItem: (item) => `Aggiungi ${item}`,
  pedidoMensagem: "Ciao! Vorrei fare un ordine.",
  pedidoDoItem: (item) => `Ciao! Vorrei ordinare: ${item}.`,
  frasesDaLente: [
    "ATTENZIONE, CREA DIPENDENZA!",
    "ORDINALO SUBITO, È UNA DELIZIA!",
    "PRENDI IL TUO, QUESTO È GIÀ MIO 😏",
  ],
  faixaAte: (v) => `Fino a ${v}`,
  faixaEntre: (de, ate) => `Da ${de} a ${ate}`,
  faixaAcima: (v) => `Oltre ${v}`,
  faixaDePreco: "Fascia di prezzo",
  simularEsteCarro: "Simula questa auto",
  trocaMarca: "Marca",
  trocaModelo: "Modello",
  trocaAno: "Anno",
  trocaKm: "Chilometraggio",
  trocaMensagem: "Ciao! Vorrei una valutazione della mia auto.",
  trocaMensagemCarro: (carro) => `Ciao! Vorrei dare la mia auto in permuta: ${carro}.`,
  navEstoque: "Parco auto",
  navVantagens: "Vantaggi",
  navDestaque: "In evidenza",
  navSimulador: "Simulatore",
  navAvaliacao: "Valutazione",
  navDepoimentos: "Recensioni",
  simValorDoVeiculo: "Prezzo del veicolo",
  simEntrada: (pct) => `Anticipo · ${pct}%`,
  simParcelas: "Rate",
  simParcelaEstimada: "Rata stimata",
  simPorMes: "/mese",
  simFinanciado: (valor, n, taxa) => `Finanziato: ${valor} in ${n} rate · tasso rif. ${taxa}% mensile`,
  simAviso: "Valori simulati, soggetti ad approvazione del credito.",
  simSolicitarProposta: "Richiedi un preventivo",
  simMensagem: (v, e, n, p) => `Ciao! Ho fatto una simulazione sul sito: veicolo ${v}, anticipo ${e}, ${n} rate da ${p}. Vorrei un preventivo.`,
  abrirNoWaze: "Apri in Waze",
  abrirNoMaps: "Apri in Google Maps",
  maisInformacoes: "Ciao! Vengo dal sito e vorrei più informazioni.",
  maisInformacoesDe: (nome) => `Ciao! Vengo dal sito di ${nome} e vorrei più informazioni.`,
  interesseNoCarro: (carro, preco) => `Ciao! Mi interessa la ${carro} (${preco}). È ancora disponibile?`,
  interesseNoDestaque: (carro, nome) => `Ciao! Mi interessa la ${carro} vista sul sito di ${nome}.`,
  veiculoEmDestaque: "veicolo in evidenza",
  rpm: "GIRI ×1000",
};

const NL: DemoMicrocopia = {
  pular: "Overslaan",
  role: "SCROLL",
  scrollEstilizado: "SCROLL",
  desca: "Scrollen",
  direitosReservados: "Alle rechten voorbehouden.",
  avaliacaoEstrelas: (nota) => `${nota} van 5 sterren`,
  galeria: "Galerij",
  fazerPedido: "Bestellen",
  agendarHorario: "Afspraak maken",
  conversarNoWhatsapp: "Chatten via WhatsApp",
  menu: "Menu",
  fecharMenu: "Menu sluiten",
  todos: "Alle",
  disponivelNaVersaoCompleta: "Beschikbaar in de volledige versie",
  semPreco: "Prijs op aanvraag",
  endereco: "Adres",
  horario: "Openingstijden",
  telefone: "Telefoon",
  faleComAGente: "Neem contact op",
  contato: "Contact",
  navegue: "Ontdek",
  redes: "Social",
  escolher: "Kiezen",
  escolherItem: (item) => `${item} kiezen`,
  adicionarItem: (item) => `${item} toevoegen`,
  pedidoMensagem: "Hallo! Ik wil graag een bestelling plaatsen.",
  pedidoDoItem: (item) => `Hallo! Ik wil graag bestellen: ${item}.`,
  frasesDaLente: [
    "PAS OP, DIT IS VERSLAVEND!",
    "BESTEL SNEL, HIJ IS HEERLIJK!",
    "HAAL JE EIGEN, DEZE IS VAN MIJ 😏",
  ],
  faixaAte: (v) => `Tot ${v}`,
  faixaEntre: (de, ate) => `${de} tot ${ate}`,
  faixaAcima: (v) => `Boven ${v}`,
  faixaDePreco: "Prijsklasse",
  simularEsteCarro: "Deze auto berekenen",
  trocaMarca: "Merk",
  trocaModelo: "Model",
  trocaAno: "Bouwjaar",
  trocaKm: "Kilometerstand",
  trocaMensagem: "Hallo! Ik wil mijn auto laten taxeren.",
  trocaMensagemCarro: (carro) => `Hallo! Ik wil mijn auto inruilen: ${carro}.`,
  navEstoque: "Voorraad",
  navVantagens: "Voordelen",
  navDestaque: "Uitgelicht",
  navSimulador: "Rekentool",
  navAvaliacao: "Inruil",
  navDepoimentos: "Reviews",
  simValorDoVeiculo: "Prijs van de auto",
  simEntrada: (pct) => `Aanbetaling · ${pct}%`,
  simParcelas: "Looptijd",
  simParcelaEstimada: "Geschat maandbedrag",
  simPorMes: "/maand",
  simFinanciado: (valor, n, taxa) => `Gefinancierd: ${valor} in ${n} maanden · ref.-rente ${taxa}%/maand`,
  simAviso: "Gesimuleerde bedragen, onder voorbehoud van kredietgoedkeuring.",
  simSolicitarProposta: "Offerte aanvragen",
  simMensagem: (v, e, n, p) => `Hallo! Ik heb op de site gerekend: auto ${v}, aanbetaling ${e}, ${n} termijnen van ${p}. Graag een offerte.`,
  abrirNoWaze: "Openen in Waze",
  abrirNoMaps: "Openen in Google Maps",
  maisInformacoes: "Hallo! Ik kom via de website en wil graag meer informatie.",
  maisInformacoesDe: (nome) => `Hallo! Ik kom via de website van ${nome} en wil graag meer informatie.`,
  interesseNoCarro: (carro, preco) => `Hallo! Ik heb interesse in de ${carro} (${preco}). Is hij nog beschikbaar?`,
  interesseNoDestaque: (carro, nome) => `Hallo! Ik heb interesse in de ${carro} op de website van ${nome}.`,
  veiculoEmDestaque: "uitgelichte auto",
  rpm: "TPM ×1000",
};

const MICROCOPIA_POR_RAIZ: Record<RaizMicrocopia, DemoMicrocopia> = {
  pt: PT,
  en: EN,
  es: ES,
  fr: FR,
  de: DE,
  it: IT,
  nl: NL,
};

/**
 * Microcópia de chrome no idioma-alvo da demo (BCP-47, ver
 * `idiomaEfetivoDemo`). Mesma regra de fallback do resto do sistema: raiz
 * sem entrada (ou idioma ausente — ex.: skin renderizada sem `idioma`, como
 * o preview antigo/testes) cai no default `pt`.
 */
export function microcopiaDemo(idioma: string | undefined): DemoMicrocopia {
  const raiz = (idioma ?? IDIOMA_PADRAO).split("-")[0] as RaizMicrocopia;
  return MICROCOPIA_POR_RAIZ[raiz] ?? PT;
}
