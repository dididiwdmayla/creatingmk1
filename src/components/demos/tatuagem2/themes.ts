import type { Theme, ThemeFontes } from "@/lib/demos/types";

/**
 * Presets de tema da skin de tatuagem "Pigmento Vivo" — quatro TINTAS
 * (fundo, fontes locais por variante — ver `./fontes.ts` — e paleta legível)
 * consumidas por `./variantes.ts` (`criarVariante`), que monta o `Theme`
 * final de cada uma (id/nome/descrição da variante, arranjo, exemplo).
 *
 * A paleta aqui já é a versão REMEDIDA em
 * docs/plano-tatuagem-pigmento-vivo.md §2/§6: `destaque`/`acentoSecundario`/
 * `acentoTerciario` guardam as TINTAS (a mesma cor do pigmento, escurecida/
 * clareada até ≥4,5:1 sobre fundo, alt, elevado e a pílula do próprio
 * pigmento a 16%) — nunca o vivo. Os vivos moram em `Theme.pigmento.manchas`
 * (só mancha e campo de cor os usam — ver `PigmentoTokens` em
 * `lib/demos/types.ts`). `textoSuave` é cor SÓLIDA (regra 2 do §2), não mais
 * alfa sobre preto/branco — o valor muda por variante porque precisa ler
 * ≥4,5:1 nas três superfícies E sobre a própria mancha a α 0,30.
 *
 * Verificado por `pigmento-paletas.test.ts` (contrasteWcag, composto sobre
 * as superfícies reais) — nenhum par de leitura abaixo de 4,5:1.
 */

/** Fontes locais da Aquarela (DM Serif Display + Archivo) — ver ./fontes.ts. */
const FONTES_AQUARELA: ThemeFontes = {
  display: "var(--font-pv-display), Georgia, serif",
  corpo: "var(--font-pv-corpo), system-ui, sans-serif",
  mono: "var(--font-pv-corpo), system-ui, sans-serif",
  serif: "var(--font-pv-display), Georgia, serif",
  decorativa: "var(--font-pv-display), Georgia, serif",
  citacao: "var(--font-pv-display), Georgia, serif",
  destaque: "var(--font-pv-corpo), system-ui, sans-serif",
};

/** Fontes locais da Boreal (Bricolage Grotesque + Figtree) — ver ./fontes.ts. */
const FONTES_BOREAL: ThemeFontes = {
  display: "var(--font-pv-display), system-ui, sans-serif",
  corpo: "var(--font-pv-corpo), system-ui, sans-serif",
  mono: "var(--font-pv-corpo), system-ui, sans-serif",
  serif: "var(--font-pv-display), system-ui, sans-serif",
  decorativa: "var(--font-pv-display), system-ui, sans-serif",
  citacao: "var(--font-pv-display), system-ui, sans-serif",
  destaque: "var(--font-pv-corpo), system-ui, sans-serif",
};

/** Fontes locais da Meia-noite (Dela Gothic One + Space Grotesk) — ver ./fontes.ts. */
const FONTES_MEIA_NOITE: ThemeFontes = {
  display: "var(--font-pv-display), system-ui, sans-serif",
  corpo: "var(--font-pv-corpo), system-ui, sans-serif",
  mono: "var(--font-pv-corpo), system-ui, sans-serif",
  serif: "var(--font-pv-display), system-ui, sans-serif",
  decorativa: "var(--font-pv-display), system-ui, sans-serif",
  citacao: "var(--font-pv-display), system-ui, sans-serif",
  destaque: "var(--font-pv-corpo), system-ui, sans-serif",
};

/** Fontes locais da Terra (Young Serif + Karla) — ver ./fontes.ts. */
const FONTES_TERRA: ThemeFontes = {
  display: "var(--font-pv-display), Georgia, serif",
  corpo: "var(--font-pv-corpo), system-ui, sans-serif",
  mono: "var(--font-pv-corpo), system-ui, sans-serif",
  serif: "var(--font-pv-display), Georgia, serif",
  decorativa: "var(--font-pv-display), Georgia, serif",
  citacao: "var(--font-pv-display), Georgia, serif",
  destaque: "var(--font-pv-corpo), system-ui, sans-serif",
};

/** Paleta original do material bruto, remedida: creme + tintas de rosa/azul/laranja. */
const AQUARELA: Theme = {
  id: "aquarela",
  nome: "Aquarela (creme, rosa e azul)",
  paleta: {
    fundo: "#FAF6F0",
    fundoAlt: "#F2EADC",
    fundoElevado: "#EADFCB",
    destaque: "#A51C4C",
    destaqueInk: "#FFFFFF",
    texto: "#141414",
    textoSuave: "#534D46",
    borda: "rgba(20, 20, 20, 0.12)",
    acentoSecundario: "#2440D0",
    acentoTerciario: "#94380B",
  },
  pigmento: {
    manchas: ["#E0336F", "#2B4EFF", "#FF6B35"],
    abertura: "mancha",
    portfolio: "trilha",
    investimento: "gotas",
    processo: "onda",
    manifesto: "circulo",
    estilos: "mostruario",
    artistas: "assinaturas",
    depoimentos: "bilhetes",
    faq: "acordeao",
    agendar: "gota",
    contato: "assinatura",
  },
  fontes: FONTES_AQUARELA,
  raio: "4px",
  densidade: "arejada",
  animacao: "marcante",
  intro: false,
  hover: "lift",
  clique: "pressao",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, espacamento: 0, alinhamento: "esquerda" },
  led: "desligado",
  ledEstilo: "barra",
};

/** Variante "boreal" — undertone frio, verde-azulado e violeta sobre cinza-claro. */
const BOREAL: Theme = {
  id: "boreal",
  nome: "Boreal (cinza, verde e violeta)",
  paleta: {
    fundo: "#F4F6F5",
    fundoAlt: "#E6ECE9",
    fundoElevado: "#DAE3DF",
    destaque: "#0A6B50",
    destaqueInk: "#FFFFFF",
    texto: "#0F1513",
    textoSuave: "#434E4A",
    borda: "rgba(16, 22, 20, 0.12)",
    acentoSecundario: "#5A2BBE",
    acentoTerciario: "#1F4FC4",
  },
  pigmento: {
    manchas: ["#12A57C", "#6A35D6", "#2B6BFF"],
    abertura: "sobreposicao",
    portfolio: "vitrine",
    investimento: "regua",
    processo: "camadas",
    manifesto: "grifo",
    estilos: "bento",
    artistas: "monogramas",
    depoimentos: "conversa",
    faq: "fichas",
    agendar: "talao",
    contato: "recibo",
  },
  fontes: FONTES_BOREAL,
  raio: "8px",
  densidade: "confortavel",
  animacao: "sutil",
  intro: false,
  hover: "brilho",
  clique: "nenhum",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, espacamento: 0, alinhamento: "centro" },
  led: "desligado",
  ledEstilo: "barra",
};

/** Variante noturna — pigmento vivo em ciano elétrico sobre fundo quase preto. */
const MEIA_NOITE: Theme = {
  id: "meia-noite",
  nome: "Meia-noite (preto, ciano e magenta)",
  paleta: {
    fundo: "#0D0A12",
    fundoAlt: "#16111D",
    fundoElevado: "#211A2B",
    destaque: "#3FD0EE",
    destaqueInk: "#07141A",
    texto: "#F6F2EE",
    textoSuave: "#B9B2BF",
    borda: "rgba(245, 241, 236, 0.10)",
    acentoSecundario: "#FF6CC4",
    acentoTerciario: "#FFA86A",
  },
  pigmento: {
    manchas: ["#22C3E6", "#FF4FB8", "#FF9A52"],
    abertura: "cartela",
    portfolio: "manchas",
    investimento: "etiquetas",
    processo: "quadrinhos",
    manifesto: "pilha",
    estilos: "paleta",
    artistas: "bandeiras",
    depoimentos: "coro",
    faq: "manchete",
    agendar: "diagonal",
    contato: "letreiro",
  },
  fontes: FONTES_MEIA_NOITE,
  raio: "12px",
  densidade: "confortavel",
  animacao: "sutil",
  intro: false,
  hover: "zoom",
  clique: "pulso",
  fundoEfeito: "particulas",
  heroTitulo: { fonte: "", escala: 1, espacamento: 0, alinhamento: "esquerda" },
  led: "sutil",
  ledEstilo: "barra",
};

/** Variante terrosa — terracota, mostarda e verde-petróleo sobre bege. */
const TERRA: Theme = {
  id: "terra",
  nome: "Terra (bege, terracota e petróleo)",
  paleta: {
    fundo: "#F5EFE6",
    fundoAlt: "#EBE1D2",
    fundoElevado: "#E0D2BD",
    destaque: "#963A1B",
    destaqueInk: "#FFFFFF",
    texto: "#221A13",
    textoSuave: "#54483C",
    borda: "rgba(36, 28, 20, 0.14)",
    acentoSecundario: "#6E5210",
    acentoTerciario: "#275A4F",
  },
  pigmento: {
    manchas: ["#C4552F", "#C9961E", "#2F6B5E"],
    abertura: "medalhao",
    portfolio: "mesa",
    investimento: "selos",
    processo: "ciclo",
    manifesto: "carta",
    estilos: "baralho",
    artistas: "livro",
    depoimentos: "caderno",
    faq: "respostas",
    agendar: "postal",
    contato: "colofao",
  },
  fontes: FONTES_TERRA,
  raio: "16px",
  densidade: "arejada",
  animacao: "marcante",
  intro: false,
  hover: "lift",
  clique: "pressao",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, espacamento: 0, alinhamento: "esquerda" },
  led: "desligado",
  ledEstilo: "barra",
};

export const TATUAGEM2_THEME_PRESETS: Theme[] = [AQUARELA, BOREAL, MEIA_NOITE, TERRA];
