import {
  Archivo,
  Bebas_Neue,
  Cormorant_Garamond,
  Crimson_Pro,
  DM_Serif_Display,
  Fraunces,
  Fugaz_One,
  Inter,
  Instrument_Sans,
  Instrument_Serif,
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

// Serif variável (eixo óptico) da skin de barbearia2 — display do hero,
// headlines editoriais e o logotipo do rodapé. O material bruto usa pesos
// finos (330-400) ao longo do eixo `opsz`; aproximamos para os cortes
// estáticos 400/500 do next/font (mesmo critério do peso 340→400 já usado
// alhures neste arquivo).
const fraunces = Fraunces({
  variable: "--font-demo-fraunces",
  subsets: ["latin"],
  weight: ["400", "500"],
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

// Dupla tipográfica da skin "Tatuagem Pigmento Vivo" (CROMA Tattoo Studio):
// DM Serif Display cobre títulos/citações/wordmark; Archivo cobre corpo,
// rótulos e preços — o material bruto não tem uma família monoespaçada
// separada, então `mono`/`destaque` reaproveitam a mesma Archivo (ver
// components/demos/tatuagem2/themes.ts).
const dmSerif = DM_Serif_Display({
  variable: "--font-demo-dm-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

// Sans neutra compartilhada por duas skins: corpo de texto da barbearia2
// (Archivo 400/500, nunca itálico no material bruto dela) e corpo/rótulos/
// preços da "Tatuagem Pigmento Vivo" (400/500/600/700 + itálico — sem
// família monoespaçada separada lá, `mono`/`destaque` reaproveitam esta
// mesma fonte). Pesos e itálico somados cobrem os dois usos.
const archivo = Archivo({
  variable: "--font-demo-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

// Dupla tipográfica da skin de petshop (Focinho Feliz): Instrument Serif
// cobre display/números/citações/flutuantes (o material bruto usa o
// itálico dela em quase todo destaque de marca); Instrument Sans cobre
// corpo, nav e botões — mesmo critério de reaproveitamento de
// mono/serif/decorativa/citacao/destaque já usado em lancheria/tatuagem2
// (não existe família separada pra preço ou logotipo no original).
const instrumentSerif = Instrument_Serif({
  variable: "--font-demo-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-demo-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
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
  "dm-serif",
  "archivo",
  "instrument-serif",
  "instrument-sans",
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
  fraunces.variable,
  dmSerif.variable,
  archivo.variable,
  instrumentSerif.variable,
  instrumentSans.variable,
].join(" ");
