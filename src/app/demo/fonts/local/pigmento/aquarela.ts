import localFont from "next/font/local";

/**
 * Dupla tipográfica da variante Aquarela (fiel ao material bruto): DM Serif
 * Display no título/citações, Archivo no corpo/rótulos/preços — ver README
 * deste diretório. Reaproveita o `.woff2` de Archivo já trazido pela
 * `lancheria-2` (`public/fontes/`) em vez de duplicar o arquivo.
 */
// Nomes de variável ÚNICOS por variante (aquarelaDisplay/aquarelaCorpo, e o
// mesmo padrão nos outros três arquivos deste diretório) — de propósito:
// `next/font/local` deriva o nome da família (a string dentro de
// `--font-pv-display`) do binding local, e as quatro variantes CARREGAM
// JUNTAS na mesma página (o import() dinâmico só isola a classe CSS que
// resolve pra `theme.fontes`, não o bundle — Next anexa o `@font-face` de
// todo módulo alcançável, ativo ou não). Um nome repetido entre arquivos
// (`display`/`corpo` nos quatro, como esta função tinha antes) faz as
// quatro declararem a MESMA família: o navegador testa as quatro fontes
// pra decidir qual usar, baixa as quatro e a que "ganha" é a mesma nas
// quatro variantes — o defeito visto no print da sessão (todas com a
// serifada da Aquarela). Nome único por arquivo resolve os dois problemas:
// cada variante usa a fonte certa, e só ela é baixada (a família da
// variante ATIVA é a única referenciada por `--font-pv-display`/`-corpo`
// no documento; as outras três, sem nenhum texto pedindo a família delas,
// nunca disparam o fetch, que é lazy por família).
const aquarelaDisplay = localFont({
  src: [
    { path: "./files/dm-serif-display-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./files/dm-serif-display-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-pv-display",
  display: "swap",
  preload: false,
});

const aquarelaCorpo = localFont({
  src: "../../../../../../public/fontes/archivo-latin-standard-normal.woff2",
  weight: "100 900",
  variable: "--font-pv-corpo",
  display: "swap",
  preload: false,
});

export const pigmentoFontClassName = `${aquarelaDisplay.variable} ${aquarelaCorpo.variable}`;
