import {
  Bebas_Neue,
  Cormorant_Garamond,
  Crimson_Pro,
  Inter,
  JetBrains_Mono,
  Limelight,
  Lora,
  Oswald,
  Playfair_Display,
  Poppins,
} from "next/font/google";

/**
 * Fontes das skins de demo, carregadas via next/font (self-hosted no build,
 * nenhuma chamada externa em runtime). Os presets de tema referenciam estas
 * CSS vars (--font-demo-*); a página /demo aplica o className no wrapper.
 * Fontes do app (layout raiz) usam vars próprias — sem colisão.
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

// Fontes extras da lista curada do editor (src/lib/demos/fontes.ts) —
// opções de display/corpo além das que as skins já usavam.
const oswald = Oswald({
  variable: "--font-demo-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const poppins = Poppins({
  variable: "--font-demo-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const lora = Lora({
  variable: "--font-demo-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const demoFontsClassName = [
  bebas.variable,
  inter.variable,
  mono.variable,
  crimson.variable,
  cormorant.variable,
  playfair.variable,
  limelight.variable,
  oswald.variable,
  poppins.variable,
  lora.variable,
].join(" ");
