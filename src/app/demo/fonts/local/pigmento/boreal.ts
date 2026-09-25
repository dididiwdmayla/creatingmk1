import localFont from "next/font/local";

/**
 * Dupla tipográfica da variante Boreal: Bricolage Grotesque (variável, eixo
 * óptico) no título, Figtree (variável) no corpo — ver README deste
 * diretório. Nenhuma das duas tem face itálica própria no pacote do
 * Google Fonts; o itálico dos títulos sai sintético (mesmo critério já
 * usado em `core.ts` para a Playfair Display 900/Dela Gothic One).
 */
// Nomes de variável ÚNICOS por variante — ver o comentário longo em
// ./aquarela.ts (o nome do binding vira o nome da família; repetido entre
// arquivos, as quatro variantes disputam a mesma família e o navegador
// baixa as quatro).
const borealDisplay = localFont({
  src: "./files/bricolage-grotesque-latin-standard-normal.woff2",
  weight: "200 800",
  variable: "--font-pv-display",
  display: "swap",
  preload: false,
});

const borealCorpo = localFont({
  src: "./files/figtree-latin-wght-normal.woff2",
  weight: "300 900",
  variable: "--font-pv-corpo",
  display: "swap",
  preload: false,
});

export const pigmentoFontClassName = `${borealDisplay.variable} ${borealCorpo.variable}`;
