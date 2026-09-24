import localFont from "next/font/local";

/**
 * Dupla tipográfica da variante Meia-noite: Dela Gothic One no título,
 * Space Grotesk (variável) no corpo — ver README deste diretório.
 *
 * A Dela Gothic One só tem peso 400 e nenhum itálico no pacote (fonte de
 * origem japonesa, subset `latin` = Basic Latin + Latin-1 Supplement — ver
 * `unicode.json` do pacote): o `<em>` sai em itálico SINTÉTICO. Conferida
 * visualmente (print "ÇÃO ÁÉÍÓÚ ÂÊÔ ÃÕ") antes de adotar — ver relatório da
 * sessão; se algum acento faltar, `anton-latin-400-normal.woff2` (já neste
 * diretório) é o fallback já conferido.
 */
const display = localFont({
  src: "./files/dela-gothic-one-latin-400-normal.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-pv-display",
  display: "swap",
});

const corpo = localFont({
  src: "./files/space-grotesk-latin-wght-normal.woff2",
  weight: "300 700",
  variable: "--font-pv-corpo",
  display: "swap",
});

export const pigmentoFontClassName = `${display.variable} ${corpo.variable}`;
