import type { Theme, ThemeFontes } from "@/lib/demos/types";

/**
 * Presets de tema da skin de imobiliária. As fontes referenciam as CSS
 * vars carregadas via next/font em src/app/demo/fonts/core.ts
 * (--font-demo-*), com fallback de sistema.
 *
 * O material bruto usa só duas famílias (Fraunces serif variável no
 * display — incluindo itálico de verdade nos destaques — e Hanken Grotesk
 * sans no corpo inteiro) — `serif`/`decorativa`/`citacao` reaproveitam
 * Fraunces e `mono`/`destaque` reaproveitam Hanken Grotesk (mesmo critério
 * já usado em lancheria/tatuagem2: não existe família separada para
 * logotipo, citação ou dado tabular no original).
 */
const FONTES_VIVENDA: ThemeFontes = {
  display: "var(--font-demo-fraunces), Georgia, serif",
  corpo: "var(--font-demo-hanken), system-ui, sans-serif",
  mono: "var(--font-demo-hanken), system-ui, sans-serif",
  serif: "var(--font-demo-fraunces), Georgia, serif",
  decorativa: "var(--font-demo-fraunces), Georgia, serif",
  citacao: "var(--font-demo-fraunces), Georgia, serif",
  destaque: "var(--font-demo-hanken), system-ui, sans-serif",
};

/**
 * Papel de cada cor, fiel ao original: `destaque` é a terracota de marca
 * (CTAs, etiquetas "Casa"/"Apartamento", selo do card, seção de
 * depoimento inteira) sempre com `destaqueInk` legível por cima;
 * `acentoSecundario` é o mostarda decorativo (selo, badge giratório do
 * hero, card de estatística, hover de links) e `acentoTerciario` é o
 * verde estrutural (seção do manifesto, blobs, selo "Cobertura", texto de
 * apoio) — o par de cores raras que o material bruto usa em blocos
 * inteiros, não só em detalhes, então aqui elas também servem de fundo de
 * seção (ver Skin.tsx), não só de acento pontual.
 *
 * Micro-interações default: o material bruto não tem splash de abertura
 * (a página abre direto no hero) — `intro` fica desligada em todos os
 * presets, igual ao critério de lancheria/barbearia2. Hover é sempre
 * "crescer" (padding dos botões, escala da imagem do card) e clique não
 * tem animação própria no original. Hero nasce alinhado à esquerda (grid
 * texto+imagem), fiel ao layout original.
 */
const INTERACOES_ORIGINAIS = {
  intro: false,
  hover: "lift",
  clique: "nenhum",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, alinhamento: "esquerda" },
  led: "desligado",
} as const;

/** Paleta original do material bruto: creme, terracota, mostarda e verde-oliva. */
const TERRACOTA: Theme = {
  id: "terracota",
  nome: "Terracota (creme, terracota e verde-oliva)",
  ...INTERACOES_ORIGINAIS,
  paleta: {
    fundo: "#F7F1E8",
    fundoAlt: "#2C3524",
    fundoElevado: "#E7DCC8",
    destaque: "#C4572E",
    destaqueInk: "#F7F1E8",
    texto: "#2B2318",
    textoSuave: "rgba(43, 35, 24, 0.68)",
    borda: "rgba(43, 35, 24, 0.14)",
    acentoSecundario: "#F2B33D",
    acentoTerciario: "#3E4A34",
  },
  fontes: FONTES_VIVENDA,
  raio: "24px",
  densidade: "confortavel",
  animacao: "marcante",
};

/** Variante "Sálvia": bege mais frio, destaque verde-azulado, marrom no lugar do oliva. */
const SALVIA: Theme = {
  id: "salvia",
  nome: "Sálvia (bege, verde-azulado e marrom)",
  ...INTERACOES_ORIGINAIS,
  hover: "zoom",
  paleta: {
    fundo: "#F1F0E6",
    fundoAlt: "#17302E",
    fundoElevado: "#E1DDC8",
    destaque: "#2E6F6B",
    destaqueInk: "#F1F0E6",
    texto: "#221D14",
    textoSuave: "rgba(34, 29, 20, 0.66)",
    borda: "rgba(34, 29, 20, 0.14)",
    acentoSecundario: "#E8B04B",
    acentoTerciario: "#5C4A3A",
  },
  fontes: FONTES_VIVENDA,
  raio: "16px",
  densidade: "compacta",
  animacao: "sutil",
};

/** Variante "Cobalto": creme azulado, azul-cobalto no lugar da terracota, mostarda mantida. */
const ARGILA: Theme = {
  id: "argila",
  nome: "Cobalto (creme-azulado, cobalto e mostarda)",
  ...INTERACOES_ORIGINAIS,
  hover: "zoom",
  paleta: {
    fundo: "#F0F1F6",
    fundoAlt: "#16223D",
    fundoElevado: "#E2E5EF",
    destaque: "#2A4B8C",
    destaqueInk: "#F0F1F6",
    texto: "#171C28",
    textoSuave: "rgba(23, 28, 40, 0.66)",
    borda: "rgba(23, 28, 40, 0.14)",
    acentoSecundario: "#E0A63A",
    acentoTerciario: "#4B5D46",
  },
  fontes: FONTES_VIVENDA,
  raio: "32px",
  densidade: "arejada",
  animacao: "sutil",
};

/** Variante noturna dourada: mostra fundoEfeito/led (recursos da Forja) ligados. */
const NOTURNO: Theme = {
  id: "noturno",
  nome: "Noturno Dourado (carvão, dourado e bronze)",
  ...INTERACOES_ORIGINAIS,
  hover: "brilho",
  clique: "pulso",
  fundoEfeito: "gradiente",
  led: "sutil",
  paleta: {
    fundo: "#12100D",
    fundoAlt: "#1C1812",
    fundoElevado: "#241F17",
    destaque: "#D9A24B",
    destaqueInk: "#12100D",
    texto: "#F3EEE4",
    textoSuave: "rgba(243, 238, 228, 0.62)",
    borda: "rgba(243, 238, 228, 0.12)",
    acentoSecundario: "#8C6A3F",
    acentoTerciario: "#4B5B4A",
  },
  fontes: FONTES_VIVENDA,
  raio: "12px",
  densidade: "confortavel",
  animacao: "marcante",
};

export const IMOBILIARIA_THEME_DEFAULT: Theme = TERRACOTA;
export const IMOBILIARIA_THEME_PRESETS: Theme[] = [TERRACOTA, SALVIA, ARGILA, NOTURNO];
