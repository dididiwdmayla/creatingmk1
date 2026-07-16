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
  style: ["normal", "italic"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-demo-cormorant",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

const playfair = Playfair_Display({
  variable: "--font-demo-playfair",
  subsets: ["latin"],
});

const limelight = Limelight({
  variable: "--font-demo-limelight",
  subsets: ["latin"],
  weight: "400",
});

export const demoFontsClassName = [
  bebas.variable,
  inter.variable,
  mono.variable,
  crimson.variable,
  cormorant.variable,
  playfair.variable,
  limelight.variable,
].join(" ");
