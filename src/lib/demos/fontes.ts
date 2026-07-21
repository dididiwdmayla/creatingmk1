/**
 * Lista curada de fontes do editor de demos. Cada entrada referencia uma
 * CSS var carregada via next/font em src/app/demo/fonts.ts (--font-demo-*),
 * com fallback de sistema — nenhuma chamada externa em runtime. O TemaPatch
 * guarda só o `id`; aplicarTema (./tema.ts) resolve para o valor CSS.
 *
 * `papeis` diz onde a fonte funciona: "display" (títulos) e/ou "corpo"
 * (texto corrido) — o editor filtra o seletor por papel (uma display
 * condensada como Bebas seria ilegível como corpo de texto).
 */

export type FontePapel = "display" | "corpo";

export interface DemoFonte {
  id: string;
  nome: string;
  /** Valor CSS pronto (var + fallback), como Theme.fontes espera. */
  css: string;
  papeis: readonly FontePapel[];
}

export const DEMO_FONTES: readonly DemoFonte[] = [
  {
    id: "bebas",
    nome: "Bebas Neue (display condensada)",
    css: "var(--font-demo-bebas), 'Arial Narrow', sans-serif",
    papeis: ["display"],
  },
  {
    id: "playfair",
    nome: "Playfair Display (serif dramática)",
    css: "var(--font-demo-playfair), Georgia, serif",
    papeis: ["display"],
  },
  {
    id: "oswald",
    nome: "Oswald (display compacta)",
    css: "var(--font-demo-oswald), 'Arial Narrow', sans-serif",
    papeis: ["display"],
  },
  {
    id: "limelight",
    nome: "Limelight (letreiro art déco)",
    css: "var(--font-demo-limelight), Georgia, serif",
    papeis: ["display"],
  },
  {
    id: "cormorant",
    nome: "Cormorant Garamond (serif clássica)",
    css: "var(--font-demo-cormorant), Georgia, serif",
    papeis: ["display", "corpo"],
  },
  {
    id: "inter",
    nome: "Inter (sans neutra)",
    css: "var(--font-demo-inter), system-ui, sans-serif",
    papeis: ["corpo"],
  },
  {
    id: "poppins",
    nome: "Poppins (sans geométrica)",
    css: "var(--font-demo-poppins), system-ui, sans-serif",
    papeis: ["display", "corpo"],
  },
  {
    id: "lora",
    nome: "Lora (serif de leitura)",
    css: "var(--font-demo-lora), Georgia, serif",
    papeis: ["corpo"],
  },
  {
    id: "abril",
    nome: "Abril Fatface (display dramática)",
    css: "var(--font-demo-abril), Georgia, serif",
    papeis: ["display"],
  },
  {
    id: "archivo-black",
    nome: "Archivo Black (display robusta)",
    css: "var(--font-demo-archivo-black), 'Arial Black', sans-serif",
    papeis: ["display"],
  },
  {
    id: "cinzel",
    nome: "Cinzel (romana gravada)",
    css: "var(--font-demo-cinzel), Georgia, serif",
    papeis: ["display"],
  },
  {
    id: "dm-sans",
    nome: "DM Sans (sans limpa)",
    css: "var(--font-demo-dm-sans), system-ui, sans-serif",
    papeis: ["corpo"],
  },
  {
    id: "josefin",
    nome: "Josefin Sans (geométrica elegante)",
    css: "var(--font-demo-josefin), system-ui, sans-serif",
    papeis: ["display"],
  },
  {
    id: "libre-baskerville",
    nome: "Libre Baskerville (livro clássico)",
    css: "var(--font-demo-libre-baskerville), Georgia, serif",
    papeis: ["display", "corpo"],
  },
  {
    id: "merriweather",
    nome: "Merriweather (leitura serifada)",
    css: "var(--font-demo-merriweather), Georgia, serif",
    papeis: ["corpo"],
  },
  {
    id: "montserrat",
    nome: "Montserrat (geométrica versátil)",
    css: "var(--font-demo-montserrat), system-ui, sans-serif",
    papeis: ["display", "corpo"],
  },
  {
    id: "pirata",
    nome: "Pirata One (blackletter gótica)",
    css: "var(--font-demo-pirata), 'Times New Roman', serif",
    papeis: ["display"],
  },
  {
    id: "fugaz",
    nome: "Fugaz One (poster arredondada)",
    css: "var(--font-demo-fugaz), Impact, 'Arial Black', sans-serif",
    papeis: ["display"],
  },
  {
    id: "dm-serif",
    nome: "DM Serif Display (serif dramática)",
    css: "var(--font-demo-dm-serif), Georgia, serif",
    papeis: ["display"],
  },
  {
    id: "archivo",
    nome: "Archivo (sans editorial)",
    css: "var(--font-demo-archivo), Arial, sans-serif",
    papeis: ["display", "corpo"],
  },
];

export function getFonte(id: string | undefined): DemoFonte | undefined {
  return DEMO_FONTES.find((fonte) => fonte.id === id);
}

export function fontesPorPapel(papel: FontePapel): DemoFonte[] {
  return DEMO_FONTES.filter((fonte) => fonte.papeis.includes(papel));
}
