import type { Theme, ThemeFontes } from "@/lib/demos/types";

/**
 * Presets de tema da skin de tatuagem (editorial sombrio). As fontes
 * referenciam as CSS vars carregadas via next/font em
 * src/app/demo/fonts/core.ts (--font-demo-*), com fallback de sistema.
 *
 * `display`/`decorativa` são a MESMA fonte no material bruto (Pirata One
 * cobre logo, wordmark do hero e assinatura do footer — não existe uma
 * família separada para "display de título" e "logotipo" como na
 * barbearia). `serif`/`citacao`/`destaque` reaproveitam a Playfair Black
 * (peso 400/900, sem itálico real — ver core.ts) nos três papéis, porque
 * o original também usa uma família só para toda a tipografia editorial
 * pesada (Manifesto, taglines).
 */
const FONTES_GOTICAS: ThemeFontes = {
  display: "var(--font-demo-pirata), 'Times New Roman', serif",
  corpo: "var(--font-demo-inter), system-ui, sans-serif",
  mono: "var(--font-demo-mono), ui-monospace, monospace",
  serif: "var(--font-demo-playfair-black), Georgia, serif",
  decorativa: "var(--font-demo-pirata), 'Times New Roman', serif",
  citacao: "var(--font-demo-playfair-black), Georgia, serif",
  destaque: "var(--font-demo-playfair-black), Georgia, serif",
};

/**
 * Micro-interações default de todos os presets — fiéis ao material bruto:
 * loader de entrada (letra a letra) ligado, hover com zoom (imagens do
 * portfólio escalam no hover), sem animação de clique, sem efeito de
 * fundo extra (o grão + as letras góticas de fundo já são chrome fixo da
 * skin, sempre ligados — ver BackgroundEffect.tsx). O editor sobrescreve
 * via TemaPatch.
 */
const INTERACOES_ORIGINAIS = {
  intro: true,
  hover: "zoom",
  clique: "nenhum",
  fundoEfeito: "nenhum",
  // fonte "" = herda fontes.display do preset. Hero nasce centralizado,
  // fiel ao material bruto (wordmark gigante centralizada).
  heroTitulo: { fonte: "", escala: 1, alinhamento: "centro" },
  led: "desligado",
} as const;

/** Paleta original do material bruto: preto profundo + sangue. */
const SANGUE: Theme = {
  id: "sangue",
  nome: "Sangue (preto e vermelho)",
  ...INTERACOES_ORIGINAIS,
  paleta: {
    fundo: "#0A0A0A",
    fundoAlt: "#141414",
    fundoElevado: "#1C1C1C",
    destaque: "#8B0000",
    destaqueInk: "#F5F5F5",
    texto: "#F5F5F5",
    textoSuave: "#8A8A8A",
    borda: "rgba(245, 245, 245, 0.08)",
    // Acentos raros do ciclo multicor do contorno do wordmark (ver Skin.tsx).
    acentoSecundario: "#3D0066",
    acentoTerciario: "#0A1A3D",
  },
  fontes: FONTES_GOTICAS,
  raio: "0px",
  densidade: "arejada",
  animacao: "marcante",
};

/** Variante violeta — mesma estrutura, undertone frio de ritual noturno. */
const VESPERAL: Theme = {
  id: "vesperal",
  nome: "Vesperal (preto e violeta)",
  ...INTERACOES_ORIGINAIS,
  paleta: {
    fundo: "#0B0810",
    fundoAlt: "#161022",
    fundoElevado: "#201A31",
    destaque: "#6A2C91",
    destaqueInk: "#F5F5F5",
    texto: "#F1EEF7",
    textoSuave: "#948AA3",
    borda: "rgba(241, 238, 247, 0.09)",
    acentoSecundario: "#8B0000",
    acentoTerciario: "#0A1A3D",
  },
  fontes: FONTES_GOTICAS,
  raio: "0px",
  densidade: "confortavel",
  animacao: "marcante",
};

/** Variante aço/noturna — accent azul-aço, mais contida. */
const CRIPTA: Theme = {
  id: "cripta",
  nome: "Cripta (preto e aço)",
  ...INTERACOES_ORIGINAIS,
  hover: "brilho",
  paleta: {
    fundo: "#090B0F",
    fundoAlt: "#12161D",
    fundoElevado: "#1B212B",
    destaque: "#5C7A9E",
    destaqueInk: "#090B0F",
    texto: "#E7ECF2",
    textoSuave: "#8792A0",
    borda: "rgba(231, 236, 242, 0.08)",
    acentoSecundario: "#8B0000",
    acentoTerciario: "#660033",
  },
  fontes: FONTES_GOTICAS,
  raio: "4px",
  densidade: "compacta",
  animacao: "sutil",
};

/** Variante clara — "lookbook" em marfim, agora com tinta verde-botânica no lugar do sangue. */
const MARFIM: Theme = {
  id: "marfim",
  nome: "Marfim (creme e verde-tinta)",
  ...INTERACOES_ORIGINAIS,
  hover: "lift",
  paleta: {
    fundo: "#F3EFE7",
    fundoAlt: "#E9E2D3",
    fundoElevado: "#DED3BC",
    destaque: "#2F6B4A",
    destaqueInk: "#F5F1E8",
    texto: "#161311",
    textoSuave: "#5B554C",
    borda: "rgba(22, 19, 17, 0.12)",
    acentoSecundario: "#7A0C0C",
    acentoTerciario: "#0A1A3D",
  },
  fontes: FONTES_GOTICAS,
  raio: "0px",
  densidade: "arejada",
  animacao: "sutil",
};

export const TATUAGEM_THEME_DEFAULT: Theme = SANGUE;
export const TATUAGEM_THEME_PRESETS: Theme[] = [SANGUE, VESPERAL, CRIPTA, MARFIM];
