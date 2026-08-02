import type { Theme, ThemeFontes } from "@/lib/demos/types";

/**
 * Presets de tema da skin de lancheria. As fontes referenciam as CSS vars
 * carregadas via next/font em src/app/demo/fonts/core.ts (--font-demo-*),
 * com fallback de sistema.
 *
 * O material bruto usa só três famílias (display poster arredondada, corpo
 * neutro, mono para preços) — `serif`/`decorativa`/`citacao`/`destaque`
 * reaproveitam display/corpo (igual ao critério já usado em tatuagem/
 * themes.ts): não existe uma família separada para logotipo ou citação no
 * original, então inventar uma quebraria a fidelidade tipográfica.
 */
const FONTES_LANCHONETE: ThemeFontes = {
  display: "var(--font-demo-fugaz), Impact, 'Arial Black', sans-serif",
  corpo: "var(--font-demo-inter), system-ui, sans-serif",
  mono: "var(--font-demo-mono), ui-monospace, monospace",
  serif: "var(--font-demo-inter), system-ui, sans-serif",
  decorativa: "var(--font-demo-fugaz), Impact, 'Arial Black', sans-serif",
  citacao: "var(--font-demo-inter), system-ui, sans-serif",
  destaque: "var(--font-demo-inter), system-ui, sans-serif",
};

/**
 * Papel de cada cor, fiel ao original: `destaque` é a cor de AÇÃO (CTAs —
 * "VER CARDÁPIO", "ESCOLHER", "+"), sempre com `destaqueInk` legível por
 * cima; `acentoSecundario` é a cor de MARCA (títulos, hero, logo — o
 * amarelo do material bruto); `acentoTerciario` é sempre um verde "de
 * dinheiro" (preço — a cor `alface` do original, sem exceção entre
 * presets, igual ao papel fixo que ela tinha lá).
 *
 * Micro-interações default: o material bruto não tem splash de abertura
 * (intro fica desligada em todos os presets — ao contrário das outras
 * skins), hover com leve zoom (CTA do hero usa whileHover scale 1.05) e
 * clique com leve pressão (whileTap scale 0.98). Sem efeito de fundo extra
 * e sem LED (recursos só da Forja, não do material bruto). Hero nasce
 * centralizado, fiel ao layout original.
 */
const INTERACOES_ORIGINAIS = {
  intro: false,
  hover: "zoom",
  clique: "pressao",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, alinhamento: "centro" },
  led: "desligado",
  ledEstilo: "barra",
} as const;

/** Paleta original do material bruto: chapa quente, marrom escuro + amarelo/laranja/verde. */
const CHAPA: Theme = {
  id: "chapa",
  nome: "Chapa (marrom, amarelo e laranja)",
  ...INTERACOES_ORIGINAIS,
  paleta: {
    fundo: "#1A0F0A",
    fundoAlt: "#2B1A10",
    fundoElevado: "#3A2215",
    destaque: "#FF6321",
    destaqueInk: "#FFFFFF",
    texto: "#FAF7F2",
    textoSuave: "rgba(250, 247, 242, 0.65)",
    borda: "rgba(250, 247, 242, 0.10)",
    acentoSecundario: "#FFD93D",
    acentoTerciario: "#4ADE80",
  },
  fontes: FONTES_LANCHONETE,
  raio: "24px",
  densidade: "confortavel",
  animacao: "marcante",
};

/** Variante "Nebulosa": lilás claro e violeta, destaque bem afastado do laranja das demais. */
const BRASA: Theme = {
  id: "brasa",
  nome: "Nebulosa (lilás, violeta e neon)",
  ...INTERACOES_ORIGINAIS,
  hover: "lift",
  paleta: {
    fundo: "#F4EFFB",
    fundoAlt: "#E8DFF5",
    fundoElevado: "#DCCFF0",
    destaque: "#6C4AB6",
    destaqueInk: "#FFFFFF",
    texto: "#211735",
    textoSuave: "rgba(33, 23, 53, 0.62)",
    borda: "rgba(33, 23, 53, 0.14)",
    acentoSecundario: "#FFD93D",
    acentoTerciario: "#7ED957",
  },
  fontes: FONTES_LANCHONETE,
  raio: "20px",
  densidade: "compacta",
  animacao: "sutil",
};

/** Variante clara "diner": fundo creme, destaque ciano-turquesa — cartaz clássico de lanchonete de esquina. */
const DINER: Theme = {
  id: "diner",
  nome: "Diner (creme, ciano e verde)",
  ...INTERACOES_ORIGINAIS,
  hover: "lift",
  paleta: {
    fundo: "#FAF3E7",
    fundoAlt: "#F1E4CC",
    fundoElevado: "#E7D6B0",
    destaque: "#1C8CA0",
    destaqueInk: "#241407",
    texto: "#241407",
    textoSuave: "rgba(36, 20, 7, 0.62)",
    borda: "rgba(36, 20, 7, 0.14)",
    acentoSecundario: "#F2B705",
    acentoTerciario: "#2F8F46",
  },
  fontes: FONTES_LANCHONETE,
  raio: "16px",
  densidade: "arejada",
  animacao: "sutil",
};

/** Variante noturna vibrante: mostra fundoEfeito/led (recursos da Forja) ligados. */
const NEON: Theme = {
  id: "neon",
  nome: "Neon Noite (preto, amarelo e rosa)",
  ...INTERACOES_ORIGINAIS,
  hover: "brilho",
  clique: "pulso",
  fundoEfeito: "particulas",
  led: "sutil",
  ledEstilo: "barra",
  paleta: {
    fundo: "#10080C",
    fundoAlt: "#1B0F14",
    fundoElevado: "#26141A",
    destaque: "#FF3D6E",
    destaqueInk: "#FFFFFF",
    texto: "#FBF3F6",
    textoSuave: "rgba(251, 243, 246, 0.62)",
    borda: "rgba(251, 243, 246, 0.10)",
    acentoSecundario: "#FFE14D",
    acentoTerciario: "#35D07F",
  },
  fontes: FONTES_LANCHONETE,
  raio: "28px",
  densidade: "confortavel",
  animacao: "marcante",
};

export const LANCHERIA_THEME_DEFAULT: Theme = CHAPA;
export const LANCHERIA_THEME_PRESETS: Theme[] = [CHAPA, BRASA, DINER, NEON];
