import type { Theme, ThemeFontes } from "@/lib/demos/types";

/**
 * Presets de tema da skin de tatuagem "Pigmento Vivo" (conversão de
 * skins-raw/tatuagem2 — CROMA Tattoo Studio): fundo claro, blobs
 * coloridos borrados, manifesto editorial e trilha de portfólio
 * horizontal. O material bruto usa só duas famílias (DM Serif Display
 * para títulos, Archivo pro resto) — `serif`/`decorativa`/`citacao`
 * reaproveitam a display, `mono`/`destaque` reaproveitam o corpo (não
 * existe uma família tabular/monoespaçada no original: rótulos e preços
 * usam a mesma Archivo em caixa alta), igual ao critério já usado em
 * tatuagem/lancheria quando a família não existe separada no original.
 */
const FONTES_PIGMENTO: ThemeFontes = {
  display: "var(--font-demo-dm-serif), Georgia, serif",
  corpo: "var(--font-demo-archivo), system-ui, sans-serif",
  mono: "var(--font-demo-archivo), system-ui, sans-serif",
  serif: "var(--font-demo-dm-serif), Georgia, serif",
  decorativa: "var(--font-demo-dm-serif), Georgia, serif",
  citacao: "var(--font-demo-dm-serif), Georgia, serif",
  destaque: "var(--font-demo-archivo), system-ui, sans-serif",
};

/** Paleta original do material bruto: creme + rosa/azul/laranja vivos. */
const AQUARELA: Theme = {
  id: "aquarela",
  nome: "Aquarela (creme, rosa e azul)",
  paleta: {
    fundo: "#FAF6F0",
    fundoAlt: "#F1E9DB",
    fundoElevado: "#E9DFC9",
    destaque: "#D6336C",
    destaqueInk: "#FFFFFF",
    texto: "#141414",
    textoSuave: "rgba(20, 20, 20, 0.65)",
    borda: "rgba(20, 20, 20, 0.12)",
    acentoSecundario: "#2B4EFF",
    acentoTerciario: "#FF6B35",
  },
  fontes: FONTES_PIGMENTO,
  raio: "4px",
  densidade: "arejada",
  animacao: "marcante",
  intro: false,
  hover: "lift",
  clique: "pressao",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, alinhamento: "esquerda" },
  led: "desligado",
};

/** Variante "boreal" — undertone frio, verde-azulado e violeta sobre cinza-claro. */
const BOREAL: Theme = {
  id: "boreal",
  nome: "Boreal (cinza, verde e violeta)",
  paleta: {
    fundo: "#F5F7F6",
    fundoAlt: "#E9EEEC",
    fundoElevado: "#DEE7E3",
    destaque: "#0F9D6E",
    destaqueInk: "#FFFFFF",
    texto: "#101614",
    textoSuave: "rgba(16, 22, 20, 0.62)",
    borda: "rgba(16, 22, 20, 0.12)",
    acentoSecundario: "#6633CC",
    acentoTerciario: "#2B4EFF",
  },
  fontes: FONTES_PIGMENTO,
  raio: "8px",
  densidade: "confortavel",
  animacao: "sutil",
  intro: false,
  hover: "brilho",
  clique: "nenhum",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, alinhamento: "centro" },
  led: "desligado",
};

/** Variante noturna — mesmo pigmento vivo, agora sobre fundo quase preto. */
const MEIA_NOITE: Theme = {
  id: "meia-noite",
  nome: "Meia-noite (preto, rosa e azul)",
  paleta: {
    fundo: "#0E0B10",
    fundoAlt: "#17121C",
    fundoElevado: "#221B29",
    destaque: "#FF4F8B",
    destaqueInk: "#14060D",
    texto: "#F5F1EC",
    textoSuave: "rgba(245, 241, 236, 0.62)",
    borda: "rgba(245, 241, 236, 0.10)",
    acentoSecundario: "#5B7CFF",
    acentoTerciario: "#FF9152",
  },
  fontes: FONTES_PIGMENTO,
  raio: "12px",
  densidade: "confortavel",
  animacao: "sutil",
  intro: false,
  hover: "zoom",
  clique: "pulso",
  fundoEfeito: "particulas",
  heroTitulo: { fonte: "", escala: 1, alinhamento: "esquerda" },
  led: "sutil",
};

/** Variante terrosa — tons muito mais contidos, terracota + mostarda + verde-petróleo. */
const TERRA: Theme = {
  id: "terra",
  nome: "Terra (bege, terracota e petróleo)",
  paleta: {
    fundo: "#F4EDE2",
    fundoAlt: "#E9DCC7",
    fundoElevado: "#DDCBAE",
    destaque: "#C1512F",
    destaqueInk: "#FFFFFF",
    texto: "#241C14",
    textoSuave: "rgba(36, 28, 20, 0.62)",
    borda: "rgba(36, 28, 20, 0.14)",
    acentoSecundario: "#8A6D1E",
    acentoTerciario: "#2F6B5E",
  },
  fontes: FONTES_PIGMENTO,
  raio: "16px",
  densidade: "arejada",
  animacao: "marcante",
  intro: false,
  hover: "lift",
  clique: "pressao",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, alinhamento: "esquerda" },
  led: "desligado",
};

export const TATUAGEM2_THEME_DEFAULT: Theme = AQUARELA;
export const TATUAGEM2_THEME_PRESETS: Theme[] = [AQUARELA, BOREAL, MEIA_NOITE, TERRA];
