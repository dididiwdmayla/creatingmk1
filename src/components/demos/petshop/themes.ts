import type { Theme, ThemeFontes } from "@/lib/demos/types";

/**
 * Presets de tema da skin de petshop. As fontes referenciam as CSS vars
 * carregadas via next/font em src/app/demo/fonts/core.ts (--font-demo-*),
 * com fallback de sistema.
 *
 * O material bruto usa só duas famílias (Instrument Serif itálica para
 * display/números/citações, Instrument Sans para corpo/nav/botões) —
 * `mono`/`serif`/`decorativa`/`citacao`/`destaque` reaproveitam
 * display/corpo (mesmo critério já usado em lancheria/tatuagem2/themes.ts):
 * não existe família separada para preço, logotipo ou citação no original.
 */
const FONTES_PETSHOP: ThemeFontes = {
  display: "var(--font-demo-instrument-serif), Georgia, serif",
  corpo: "var(--font-demo-instrument-sans), system-ui, sans-serif",
  mono: "var(--font-demo-instrument-sans), system-ui, sans-serif",
  serif: "var(--font-demo-instrument-serif), Georgia, serif",
  decorativa: "var(--font-demo-instrument-serif), Georgia, serif",
  citacao: "var(--font-demo-instrument-serif), Georgia, serif",
  destaque: "var(--font-demo-instrument-sans), system-ui, sans-serif",
};

/**
 * Micro-interações fiéis ao material bruto: splash de sessão ligada
 * ("au au" / "miau miau" saltitante, ver IntroExperience.tsx), hover com
 * leve levitação (`.card-lift`/`.team-card`/`.quote-card` do original,
 * todos `translateY` no hover) e clique com leve pressão (os botões do
 * original não tinham um `:active` explícito, mas a pressão sutil combina
 * com o resto da linguagem de micro-interação sem contradizer nada visto).
 * Sem efeito de fundo extra e sem LED por padrão (recursos só da Forja,
 * não do material bruto) — ligados no preset "Meia-noite" pra demonstrá-los.
 */
const INTERACOES_ORIGINAIS = {
  intro: true,
  hover: "lift",
  clique: "pressao",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, alinhamento: "esquerda" },
  led: "desligado",
} as const;

/** Paleta original do material bruto: creme, laranja, roxo, amarelo e rosa. */
const PASTEL: Theme = {
  id: "pastel",
  nome: "Pastel (creme, laranja e roxo)",
  ...INTERACOES_ORIGINAIS,
  paleta: {
    fundo: "#FFF6EA",
    fundoAlt: "#EFEBFF",
    fundoElevado: "#FFEFDD",
    destaque: "#FF6B2C",
    destaqueInk: "#FFF6EA",
    texto: "#2B2277",
    textoSuave: "#55517D",
    borda: "rgba(43,34,119,0.14)",
    acentoSecundario: "#4535E8",
    acentoTerciario: "#FFC93C",
  },
  fontes: FONTES_PETSHOP,
  raio: "24px",
  densidade: "confortavel",
  animacao: "marcante",
};

/** Variante "Menta": fresca, verde-menta e coral no lugar de roxo/laranja. */
const MENTA: Theme = {
  id: "menta",
  nome: "Menta (creme, coral e verde-água)",
  ...INTERACOES_ORIGINAIS,
  hover: "zoom",
  paleta: {
    fundo: "#F5FBF4",
    fundoAlt: "#E1F3EA",
    fundoElevado: "#FFD9C7",
    destaque: "#FF7A5C",
    destaqueInk: "#FFF9F6",
    texto: "#0F3D33",
    textoSuave: "#3E6B60",
    borda: "rgba(15,61,51,0.14)",
    acentoSecundario: "#1E9E82",
    acentoTerciario: "#FFD23F",
  },
  fontes: FONTES_PETSHOP,
  raio: "28px",
  densidade: "arejada",
  animacao: "sutil",
};

/** Variante "Blush": rosa-claro e terracota, mais suave que o original. */
const BLUSH: Theme = {
  id: "blush",
  nome: "Blush (rosa-claro e terracota)",
  ...INTERACOES_ORIGINAIS,
  hover: "lift",
  clique: "pulso",
  paleta: {
    fundo: "#FFF2EE",
    fundoAlt: "#FDE2E4",
    fundoElevado: "#FBEAF5",
    destaque: "#E2624B",
    destaqueInk: "#FFF6F3",
    texto: "#452A2A",
    textoSuave: "#7A5C5A",
    borda: "rgba(69,42,42,0.14)",
    acentoSecundario: "#9C6ADE",
    acentoTerciario: "#F4A63A",
  },
  fontes: FONTES_PETSHOP,
  raio: "20px",
  densidade: "compacta",
  animacao: "sutil",
};

/** Variante "Meia-noite": escura e vibrante, mostra fundoEfeito/led (recursos da Forja) ligados. */
const MEIA_NOITE: Theme = {
  id: "meia-noite",
  nome: "Meia-noite (roxo bem escuro e neon)",
  ...INTERACOES_ORIGINAIS,
  hover: "brilho",
  clique: "pulso",
  fundoEfeito: "particulas",
  led: "sutil",
  paleta: {
    fundo: "#120B24",
    fundoAlt: "#1D1338",
    fundoElevado: "#2A1B48",
    destaque: "#FF8A3D",
    destaqueInk: "#1A0F0A",
    texto: "#F4F1FF",
    textoSuave: "rgba(244,241,255,0.65)",
    borda: "rgba(244,241,255,0.12)",
    acentoSecundario: "#6E5BFF",
    acentoTerciario: "#FFD23F",
  },
  fontes: FONTES_PETSHOP,
  raio: "24px",
  densidade: "confortavel",
  animacao: "marcante",
};

export const PETSHOP_THEME_DEFAULT: Theme = PASTEL;
export const PETSHOP_THEME_PRESETS: Theme[] = [PASTEL, MENTA, BLUSH, MEIA_NOITE];
