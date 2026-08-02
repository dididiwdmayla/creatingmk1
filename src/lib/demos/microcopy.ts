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
 * todas. Textos de VENDA (taglines, CTAs com voz própria da skin, mensagens
 * de WhatsApp pré-preenchidas) continuam fora daqui: são conteúdo, e vivem
 * em `DemoData`/`exemplo.ts`, não nesta camada de apresentação.
 */

type RaizMicrocopia = "pt" | "en" | "es" | "fr" | "de" | "it" | "nl";

export interface DemoMicrocopia {
  /** Indicador de scroll em caixa alta, sem seta (ex.: lancheria "ROLE"). */
  role: string;
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
  navegue: string;
  redes: string;
}

const PT: DemoMicrocopia = {
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
  navegue: "Navegue",
  redes: "Redes",
};

const EN: DemoMicrocopia = {
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
  navegue: "Explore",
  redes: "Social",
};

const ES: DemoMicrocopia = {
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
  navegue: "Explora",
  redes: "Redes",
};

const FR: DemoMicrocopia = {
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
  navegue: "Explorer",
  redes: "Réseaux",
};

const DE: DemoMicrocopia = {
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
  navegue: "Entdecken",
  redes: "Social Media",
};

const IT: DemoMicrocopia = {
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
  navegue: "Esplora",
  redes: "Social",
};

const NL: DemoMicrocopia = {
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
  navegue: "Ontdek",
  redes: "Social",
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
