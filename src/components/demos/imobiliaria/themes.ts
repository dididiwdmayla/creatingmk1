import type { Theme, ThemeFontes } from "@/lib/demos/types";

/**
 * Presets de tema da skin de imobiliária. As fontes referenciam as CSS
 * vars carregadas via next/font em src/app/demo/fonts/core.ts
 * (--font-demo-*), com fallback de sistema.
 *
 * O material bruto usa só duas famílias (Fraunces serif editorial para
 * títulos/citações, Hanken Grotesk para o corpo) — `serif`/`citacao`
 * reaproveitam `display` (Fraunces) e `mono`/`destaque` reaproveitam
 * `corpo` (Hanken Grotesk), mesmo critério já usado em lancheria/themes.ts
 * quando o original não tem uma família própria para o papel.
 */
const FONTES_RAIZ: ThemeFontes = {
  display: "var(--font-demo-fraunces), Georgia, serif",
  corpo: "var(--font-demo-hanken-grotesk), system-ui, sans-serif",
  mono: "var(--font-demo-hanken-grotesk), system-ui, sans-serif",
  serif: "var(--font-demo-fraunces), Georgia, serif",
  decorativa: "var(--font-demo-fraunces), Georgia, serif",
  citacao: "var(--font-demo-fraunces), Georgia, serif",
  destaque: "var(--font-demo-hanken-grotesk), system-ui, sans-serif",
};

/**
 * Micro-interações fiéis ao material bruto: sem splash de abertura (a
 * página original carrega direto no hero), hover com zoom sutil na
 * imagem do card (`[data-card-img] { transform: scale(1.05) }`) e sem
 * animação de clique dedicada (os CTAs só expandem padding no hover, não
 * há estado `:active` separado no original). Sem efeito de fundo extra e
 * sem LED (recursos só da Forja). Hero nasce alinhado à esquerda, fiel ao
 * grid assimétrico do original.
 */
const INTERACOES_ORIGINAIS = {
  intro: false,
  hover: "zoom",
  clique: "nenhum",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, alinhamento: "esquerda" },
  led: "desligado",
} as const;

/** Paleta original do material bruto: creme quente, terracota, oliva e mostarda. */
const TERRA: Theme = {
  id: "terra",
  nome: "Terra (creme, terracota e oliva)",
  ...INTERACOES_ORIGINAIS,
  paleta: {
    fundo: "#F7F1E8",
    fundoAlt: "#EFE6D6",
    fundoElevado: "#E7DCC8",
    destaque: "#C4572E",
    destaqueInk: "#F7F1E8",
    texto: "#2B2318",
    textoSuave: "rgba(43, 35, 24, 0.72)",
    borda: "rgba(43, 35, 24, 0.14)",
    acentoSecundario: "#3E4A34",
    acentoTerciario: "#F2B33D",
  },
  fontes: FONTES_RAIZ,
  raio: "24px",
  densidade: "arejada",
  animacao: "sutil",
};

/** Variante noturna: verde-oliva profundo com destaque terracota, mesma alma editorial. */
const NOTURNA: Theme = {
  id: "noturna",
  nome: "Noturna (oliva profundo e terracota)",
  ...INTERACOES_ORIGINAIS,
  hover: "brilho",
  led: "sutil",
  paleta: {
    fundo: "#1E2318",
    fundoAlt: "#272D1F",
    fundoElevado: "#333B29",
    destaque: "#E2825A",
    destaqueInk: "#1E2318",
    texto: "#F3EEE2",
    textoSuave: "rgba(243, 238, 226, 0.68)",
    borda: "rgba(243, 238, 226, 0.12)",
    acentoSecundario: "#F2B33D",
    acentoTerciario: "#C4572E",
  },
  fontes: FONTES_RAIZ,
  raio: "20px",
  densidade: "confortavel",
  animacao: "sutil",
};

/** Variante "Jade": esverdeada clara, destaque oliva — boutique de bairro arborizado. */
const JADE: Theme = {
  id: "jade",
  nome: "Jade (verde-claro e oliva)",
  ...INTERACOES_ORIGINAIS,
  hover: "lift",
  paleta: {
    fundo: "#EEF1E6",
    fundoAlt: "#E3E9D6",
    fundoElevado: "#D6E0C4",
    destaque: "#3E4A34",
    destaqueInk: "#F7F1E8",
    texto: "#232A1D",
    textoSuave: "rgba(35, 42, 29, 0.68)",
    borda: "rgba(35, 42, 29, 0.14)",
    acentoSecundario: "#C4572E",
    acentoTerciario: "#F2B33D",
  },
  fontes: FONTES_RAIZ,
  raio: "28px",
  densidade: "arejada",
  animacao: "marcante",
};

/** Variante "Sol": mostarda em destaque, mais contraste e movimento — mostra o LED marcante da Forja. */
const SOL: Theme = {
  id: "sol",
  nome: "Sol (mostarda e terracota)",
  ...INTERACOES_ORIGINAIS,
  hover: "brilho",
  clique: "pressao",
  led: "marcante",
  paleta: {
    fundo: "#FBF4E4",
    fundoAlt: "#F5E9CB",
    fundoElevado: "#EFDCA9",
    destaque: "#F2B33D",
    destaqueInk: "#2B2318",
    texto: "#2B2318",
    textoSuave: "rgba(43, 35, 24, 0.7)",
    borda: "rgba(43, 35, 24, 0.16)",
    acentoSecundario: "#C4572E",
    acentoTerciario: "#3E4A34",
  },
  fontes: FONTES_RAIZ,
  raio: "16px",
  densidade: "confortavel",
  animacao: "marcante",
};

export const IMOBILIARIA_THEME_DEFAULT: Theme = TERRA;
export const IMOBILIARIA_THEME_PRESETS: Theme[] = [TERRA, NOTURNA, JADE, SOL];
