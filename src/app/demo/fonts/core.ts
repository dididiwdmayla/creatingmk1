import {
  Bebas_Neue,
  Cormorant_Garamond,
  Crimson_Pro,
  Inter,
  JetBrains_Mono,
  Limelight,
  Playfair_Display,
} from "next/font/google";

/**
 * Fontes SEMPRE presentes nos presets da skin de barbearia (themes.ts) —
 * carregadas estaticamente (preload default) porque toda demo renderiza
 * pelo menos uma delas, não importa o preset escolhido. As demais fontes
 * da lista curada (src/lib/demos/fontes.ts) só existem para override
 * opcional do editor e são carregadas sob demanda (ver ./registry.ts).
 */

const bebas = Bebas_Neue({
  variable: "--font-demo-bebas",
  subsets: ["latin"],
  weight: "400",
});

const inter = Inter({
  variable: "--font-demo-inter",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-demo-mono",
  subsets: ["latin"],
});

const crimson = Crimson_Pro({
  variable: "--font-demo-crimson",
  subsets: ["latin"],
  weight: "400",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-demo-cormorant",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

// Peso 900 itálico only — igual ao material bruto: um display serif bem
// pesado e inclinado, usado só na linha de abertura do hero.
const playfair = Playfair_Display({
  variable: "--font-demo-playfair",
  subsets: ["latin"],
  weight: "900",
  style: "italic",
});

const limelight = Limelight({
  variable: "--font-demo-limelight",
  subsets: ["latin"],
  weight: "400",
});

/** Ids da lista curada (fontes.ts) já cobertos por este pacote estático. */
export const CORE_FONT_IDS: readonly string[] = [
  "bebas",
  "inter",
  "cormorant",
  "playfair",
  "limelight",
];

export const demoCoreFontsClassName = [
  bebas.variable,
  inter.variable,
  mono.variable,
  crimson.variable,
  cormorant.variable,
  playfair.variable,
  limelight.variable,
].join(" ");
