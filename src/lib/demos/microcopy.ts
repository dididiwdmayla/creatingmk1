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
