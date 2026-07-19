import {
  Bebas_Neue,
  Cormorant_Garamond,
  Crimson_Pro,
  Fugaz_One,
  Inter,
  JetBrains_Mono,
  Limelight,
  Pirata_One,
  Playfair_Display,
} from "next/font/google";

/**
 * Fontes SEMPRE presentes nos presets das skins de barbearia e tatuagem
 * (themes.ts de cada uma) — carregadas estaticamente (preload default)
 * porque toda demo renderiza pelo menos uma delas, não importa o preset
 * escolhido. As demais fontes da lista curada (src/lib/demos/fontes.ts)
 * só existem para override opcional do editor e são carregadas sob
 * demanda (ver ./registry.ts).
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

// Blackletter gótica da skin de tatuagem — wordmark, logo do header e
// assinatura do footer (única fonte "display" do material bruto).
const pirata = Pirata_One({
  variable: "--font-demo-pirata",
  subsets: ["latin"],
  weight: "400",
});

// Display "poster" arredondada da skin de lancheria — logo do header, hero
// (contorno + drop-shadow) e assinatura do footer, igual ao material bruto
// (só existe peso 400 na família).
const fugaz = Fugaz_One({
  variable: "--font-demo-fugaz",
  subsets: ["latin"],
  weight: "400",
});

// Pesos 400/900, estilo normal only — igual ao material bruto (que também
// não carrega itálico real: o "font-light italic" do Manifesto usa itálico
// SINTÉTICO sobre a face normal, e peso 300 sem face própria cai no 400
// mais próximo, o mesmo comportamento que replicamos aqui). Var distinta
// da `--font-demo-playfair` da barbearia (essa é 900 itálico só).
const playfairBlack = Playfair_Display({
  variable: "--font-demo-playfair-black",
  subsets: ["latin"],
  weight: ["400", "900"],
});

/** Ids da lista curada (fontes.ts) já cobertos por este pacote estático. */
export const CORE_FONT_IDS: readonly string[] = [
  "bebas",
  "inter",
  "cormorant",
  "playfair",
  "limelight",
  "pirata",
  "fugaz",
];

export const demoCoreFontsClassName = [
  bebas.variable,
  inter.variable,
  mono.variable,
  crimson.variable,
  cormorant.variable,
  playfair.variable,
  limelight.variable,
  pirata.variable,
  playfairBlack.variable,
  fugaz.variable,
].join(" ");
