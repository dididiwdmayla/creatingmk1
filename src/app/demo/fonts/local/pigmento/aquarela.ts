import localFont from "next/font/local";

/**
 * Dupla tipográfica da variante Aquarela (fiel ao material bruto): DM Serif
 * Display no título/citações, Archivo no corpo/rótulos/preços — ver README
 * deste diretório. Reaproveita o `.woff2` de Archivo já trazido pela
 * `lancheria-2` (`public/fontes/`) em vez de duplicar o arquivo.
 */
const display = localFont({
  src: [
    { path: "./files/dm-serif-display-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./files/dm-serif-display-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-pv-display",
  display: "swap",
});

const corpo = localFont({
  src: "../../../../../../public/fontes/archivo-latin-standard-normal.woff2",
  weight: "100 900",
  variable: "--font-pv-corpo",
  display: "swap",
});

export const pigmentoFontClassName = `${display.variable} ${corpo.variable}`;
