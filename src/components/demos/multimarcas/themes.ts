import type { Theme, ThemeFontes } from "@/lib/demos/types";

/**
 * Presets de tema da skin "Multimarcas Vórtice". As fontes referenciam as
 * CSS vars carregadas via next/font em src/app/demo/fonts/core.ts
 * (--font-demo-*), com fallback de sistema.
 *
 * O material bruto usa três famílias (display serifada dramática, corpo
 * sans editorial, mono condensado tabular para preços/contadores) —
 * `serif`/`decorativa` reaproveitam `display` (o wordmark "VÓRTICE." usa a
 * mesma serifada do H1) e `citacao`/`destaque` reaproveitam `corpo` (não
 * existe família separada pra citação/subtítulo no original).
 */
const FONTES_MULTIMARCAS: ThemeFontes = {
  display: "var(--font-demo-bodoni), Georgia, 'Times New Roman', serif",
  corpo: "var(--font-demo-archivo), Arial, sans-serif",
  mono: "var(--font-demo-oswald), 'Arial Narrow', sans-serif",
  serif: "var(--font-demo-bodoni), Georgia, 'Times New Roman', serif",
  decorativa: "var(--font-demo-bodoni), Georgia, 'Times New Roman', serif",
  citacao: "var(--font-demo-archivo), Arial, sans-serif",
  destaque: "var(--font-demo-archivo), Arial, sans-serif",
};

/**
 * Micro-interações fiéis ao original: intro ligada (o preloader do
 * velocímetro SEMPRE aparece no material bruto), hover com lift (cards
 * sobem 8px), clique com leve pressão (`data-press` = scale .96) e sem
 * efeito de fundo/LED extra (recursos só da Forja). Hero nasce alinhado
 * à esquerda, fiel ao layout original.
 */
const INTERACOES_ORIGINAIS = {
  intro: true,
  hover: "lift",
  clique: "pressao",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, espacamento: 0, alinhamento: "esquerda" },
  led: "desligado",
  ledEstilo: "barra",
} as const;

/** Paleta original do material bruto: creme quente, vermelho de ação, tinta escura. */
const VORTICE: Theme = {
  id: "vortice",
  nome: "Vórtice (creme e vermelho)",
  ...INTERACOES_ORIGINAIS,
  paleta: {
    fundo: "#F5F0E6",
    fundoAlt: "#EDE5D2",
    fundoElevado: "#FBF6EA",
    destaque: "#D40000",
    destaqueInk: "#F5F0E6",
    texto: "#1E1712",
    textoSuave: "rgba(30, 23, 18, 0.65)",
    borda: "rgba(30, 23, 18, 0.16)",
    acentoSecundario: "#1B5E3B",
    acentoTerciario: "#A0741F",
  },
  fontes: FONTES_MULTIMARCAS,
  raio: "8px",
  densidade: "arejada",
  animacao: "marcante",
};

/** Variante "meia-noite": showroom fechado à noite, verde-esmeralda no lugar do vermelho de ação. */
const MEIA_NOITE: Theme = {
  id: "meia-noite",
  nome: "Meia-noite (escuro e esmeralda)",
  ...INTERACOES_ORIGINAIS,
  fundoEfeito: "gradiente",
  led: "sutil",
  ledEstilo: "barra",
  paleta: {
    fundo: "#15110D",
    fundoAlt: "#1E1712",
    fundoElevado: "#241C15",
    destaque: "#0C6B44",
    destaqueInk: "#FBF6EA",
    texto: "#F5F0E6",
    textoSuave: "rgba(245, 240, 230, 0.62)",
    borda: "rgba(245, 240, 230, 0.12)",
    acentoSecundario: "#D40000",
    acentoTerciario: "#C9A227",
  },
  fontes: FONTES_MULTIMARCAS,
  raio: "10px",
  densidade: "confortavel",
  animacao: "marcante",
};

/** Variante "grafite": premium noturno com destaque em dourado, vermelho vira acento. */
const GRAFITE: Theme = {
  id: "grafite",
  nome: "Grafite (preto e dourado)",
  ...INTERACOES_ORIGINAIS,
  hover: "brilho",
  clique: "pulso",
  fundoEfeito: "particulas",
  led: "marcante",
  ledEstilo: "barra",
  heroTitulo: { fonte: "", escala: 1, espacamento: 0, alinhamento: "centro" },
  paleta: {
    fundo: "#131313",
    fundoAlt: "#1C1C1C",
    fundoElevado: "#242424",
    destaque: "#C9A227",
    destaqueInk: "#131313",
    texto: "#F2F0EC",
    textoSuave: "rgba(242, 240, 236, 0.6)",
    borda: "rgba(242, 240, 236, 0.12)",
    acentoSecundario: "#D40000",
    acentoTerciario: "#1B5E3B",
  },
  fontes: FONTES_MULTIMARCAS,
  raio: "4px",
  densidade: "arejada",
  animacao: "sutil",
};

/** Variante "azul-classico": showroom clássico, destaque em azul-aço sobre creme. */
const AZUL_CLASSICO: Theme = {
  id: "azul-classico",
  nome: "Azul Clássico (creme e aço)",
  ...INTERACOES_ORIGINAIS,
  hover: "zoom",
  paleta: {
    fundo: "#F3F1EA",
    fundoAlt: "#E7E4D8",
    fundoElevado: "#FAF8F1",
    destaque: "#1D4E89",
    destaqueInk: "#FFFFFF",
    texto: "#1B1F26",
    textoSuave: "rgba(27, 31, 38, 0.62)",
    borda: "rgba(27, 31, 38, 0.14)",
    acentoSecundario: "#1B5E3B",
    acentoTerciario: "#A0741F",
  },
  fontes: FONTES_MULTIMARCAS,
  raio: "12px",
  densidade: "confortavel",
  animacao: "sutil",
};

export const MULTIMARCAS_THEME_DEFAULT: Theme = VORTICE;
export const MULTIMARCAS_THEME_PRESETS: Theme[] = [VORTICE, MEIA_NOITE, GRAFITE, AZUL_CLASSICO];
