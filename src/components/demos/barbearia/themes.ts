import type { Theme, ThemeFontes } from "@/lib/demos/types";

/**
 * Presets de tema da skin de barbearia. As fontes referenciam as CSS vars
 * carregadas via next/font em src/app/demo/fonts.ts (--font-demo-*), com
 * fallback de sistema para o caso de a var não estar definida.
 */

const FONTES_EDITORIAIS: ThemeFontes = {
  display: "var(--font-demo-bebas), 'Arial Narrow', sans-serif",
  corpo: "var(--font-demo-inter), system-ui, sans-serif",
  mono: "var(--font-demo-mono), ui-monospace, monospace",
  serif: "var(--font-demo-crimson), Georgia, serif",
  decorativa: "var(--font-demo-limelight), 'Georgia', serif",
};

/** Paleta original do material bruto: madeira escura, couro e dourado. */
const NORTE: Theme = {
  id: "norte",
  nome: "Norte (madeira e ouro)",
  paleta: {
    fundo: "#1A1411",
    fundoAlt: "#2B2118",
    fundoElevado: "#3D3025",
    destaque: "#B8862D",
    destaqueInk: "#1A1411",
    texto: "#E8DCC4",
    textoSuave: "#A89882",
    borda: "rgba(232, 220, 196, 0.10)",
  },
  fontes: FONTES_EDITORIAIS,
  raio: "0px",
  densidade: "confortavel",
};

const MEIA_NOITE: Theme = {
  id: "meia-noite",
  nome: "Meia-noite (aço e prata)",
  paleta: {
    fundo: "#10131A",
    fundoAlt: "#171C26",
    fundoElevado: "#232B3A",
    destaque: "#A9BDD3",
    destaqueInk: "#10131A",
    texto: "#E4E9F0",
    textoSuave: "#93A0B3",
    borda: "rgba(228, 233, 240, 0.10)",
  },
  fontes: FONTES_EDITORIAIS,
  raio: "4px",
  densidade: "compacta",
};

const CREME: Theme = {
  id: "creme",
  nome: "Creme (clássico claro)",
  paleta: {
    fundo: "#F4EDE0",
    fundoAlt: "#ECE1CC",
    fundoElevado: "#E2D4B8",
    destaque: "#8C4A2B",
    destaqueInk: "#F7F1E6",
    texto: "#2B2118",
    textoSuave: "#6E5F4B",
    borda: "rgba(43, 33, 24, 0.14)",
  },
  fontes: {
    ...FONTES_EDITORIAIS,
    display: "var(--font-demo-playfair), Georgia, serif",
    serif: "var(--font-demo-cormorant), Georgia, serif",
  },
  raio: "0px",
  densidade: "arejada",
};

const OLIVA: Theme = {
  id: "oliva",
  nome: "Oliva (verde e latão)",
  paleta: {
    fundo: "#12160F",
    fundoAlt: "#1B2216",
    fundoElevado: "#2A3420",
    destaque: "#C9A227",
    destaqueInk: "#12160F",
    texto: "#E7E4D3",
    textoSuave: "#A3A488",
    borda: "rgba(231, 228, 211, 0.10)",
  },
  fontes: {
    ...FONTES_EDITORIAIS,
    serif: "var(--font-demo-cormorant), Georgia, serif",
  },
  raio: "8px",
  densidade: "confortavel",
};

export const BARBEARIA_THEME_DEFAULT: Theme = NORTE;
export const BARBEARIA_THEME_PRESETS: Theme[] = [NORTE, MEIA_NOITE, CREME, OLIVA];
