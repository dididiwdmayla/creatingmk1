import localFont from "next/font/local";

/**
 * Dupla tipográfica da variante Terra: Young Serif no título, Karla
 * (variável) no corpo e Caveat na voz manuscrita da carta, da mesa e do
 * caderno — ver README deste diretório.
 *
 * A Young Serif não tem face itálica no pacote do Google Fonts: o `<em>`
 * sai em itálico sintético (mesmo critério da Dela Gothic One/Bricolage
 * Grotesque acima).
 */
// Nomes de variável ÚNICOS por variante — ver o comentário longo em
// ./aquarela.ts (o nome do binding vira o nome da família; repetido entre
// arquivos, as quatro variantes disputam a mesma família e o navegador
// baixa as quatro).
const terraDisplay = localFont({
  src: "./files/young-serif-latin-400-normal.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-pv-display",
  display: "swap",
  preload: false,
});

const terraCorpo = localFont({
  src: "./files/karla-latin-wght-normal.woff2",
  weight: "200 800",
  variable: "--font-pv-corpo",
  display: "swap",
  preload: false,
});

const terraManuscrita = localFont({
  src: "./files/caveat-latin-wght-normal.woff2",
  weight: "400 700",
  variable: "--font-pv-manuscrita",
  display: "swap",
  preload: false,
});

export const pigmentoFontClassName = `${terraDisplay.variable} ${terraCorpo.variable} ${terraManuscrita.variable}`;