import type { Theme, ThemeFontes } from "@/lib/demos/types";

/**
 * Paleta e tipografia das quatro variantes da `multimarcas-vortice` — uma
 * por TIPO DE LOJA (docs/plano-multimarcas.md §4), com o mesmo id da
 * variante. As fontes referenciam as CSS vars de src/app/demo/fonts/core.ts
 * (--font-demo-*), com fallback de sistema.
 *
 * CONTRASTE pelas regras do §2 (três dos quatro presets antigos
 * reprovavam): `textoSuave` medido COMPOSTO sobre fundo, fundoAlt,
 * fundoElevado e sobre o chip (elevado + 3% de texto); todo acento usado
 * como texto medido contra as três superfícies, não só contra o fundo; e
 * nada de opacidade em texto sobre o acento — a avaliação usa o ink
 * inteiro. As quatro passam 4,5:1 em todos os pares (o teste de contrato
 * refaz a conta).
 *
 * Os ids antigos (`azul-classico`, `grafite`, `meia-noite`) continuam
 * abrindo pela `SkinDefinition.themeAliases` do registro, na variante de
 * mesma luminância (§4).
 */

/** Vórtice: a tipografia do material bruto — Bodoni dramática, Archivo, Oswald tabular. */
const FONTES_VORTICE: ThemeFontes = {
  display: "var(--font-demo-bodoni), Georgia, 'Times New Roman', serif",
  corpo: "var(--font-demo-archivo), Arial, sans-serif",
  mono: "var(--font-demo-oswald), 'Arial Narrow', sans-serif",
  serif: "var(--font-demo-bodoni), Georgia, 'Times New Roman', serif",
  decorativa: "var(--font-demo-bodoni), Georgia, 'Times New Roman', serif",
  citacao: "var(--font-demo-archivo), Arial, sans-serif",
  destaque: "var(--font-demo-archivo), Arial, sans-serif",
};

/** Pátio: letreiro de loja de bairro — grotesca pesada, Inter para ler rápido. */
const FONTES_PATIO: ThemeFontes = {
  display: "var(--font-demo-archivo), 'Arial Black', Arial, sans-serif",
  corpo: "var(--font-demo-inter), Arial, sans-serif",
  mono: "var(--font-demo-oswald), 'Arial Narrow', sans-serif",
  serif: "var(--font-demo-archivo), Arial, sans-serif",
  decorativa: "var(--font-demo-archivo), Arial, sans-serif",
  citacao: "var(--font-demo-inter), Arial, sans-serif",
  destaque: "var(--font-demo-inter), Arial, sans-serif",
};

/** Garagem: catálogo de boutique — Playfair Black editorial, Instrument Sans. */
const FONTES_GARAGEM: ThemeFontes = {
  display: "var(--font-demo-playfair-black), Georgia, serif",
  corpo: "var(--font-demo-instrument-sans), Arial, sans-serif",
  mono: "var(--font-demo-oswald), 'Arial Narrow', sans-serif",
  serif: "var(--font-demo-playfair-black), Georgia, serif",
  decorativa: "var(--font-demo-playfair-black), Georgia, serif",
  citacao: "var(--font-demo-playfair-black), Georgia, serif",
  destaque: "var(--font-demo-instrument-sans), Arial, sans-serif",
};

/** Campo: letra de caçamba — Oswald condensada, Hanken para o corpo. */
const FONTES_CAMPO: ThemeFontes = {
  display: "var(--font-demo-oswald), 'Arial Narrow', sans-serif",
  corpo: "var(--font-demo-hanken), Arial, sans-serif",
  mono: "var(--font-demo-oswald), 'Arial Narrow', sans-serif",
  serif: "var(--font-demo-oswald), 'Arial Narrow', sans-serif",
  decorativa: "var(--font-demo-oswald), 'Arial Narrow', sans-serif",
  citacao: "var(--font-demo-hanken), Arial, sans-serif",
  destaque: "var(--font-demo-hanken), Arial, sans-serif",
};

/**
 * Micro-interações de base, fiéis ao original: hover com lift, clique com
 * pressão, sem efeito de fundo nem LED extra. A intro, o hover e a
 * densidade de cada variante são ajustados na declaração dela
 * (./variantes.ts, camada `tema`).
 */
const INTERACOES_ORIGINAIS = {
  intro: true,
  hover: "lift",
  clique: "pressao",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, espacamento: 0, alinhamento: "esquerda" },
  led: "desligado",
  ledEstilo: "barra",
} as const;

/**
 * Vórtice (claro): creme e vermelho do material bruto. O vermelho desce de
 * #D40000 para #C10000 — o original media 4,41 contra o `fundoAlt` (rótulo
 * de vantagens e contato); o `textoSuave` sobe de 65% para 68%.
 */
const VORTICE: Theme = {
  id: "vortice",
  nome: "Vórtice (creme e vermelho)",
  ...INTERACOES_ORIGINAIS,
  paleta: {
    fundo: "#F5F0E6",
    fundoAlt: "#EDE5D2",
    fundoElevado: "#FBF6EA",
    destaque: "#C10000",
    destaqueInk: "#FBF6EA",
    texto: "#1E1712",
    textoSuave: "rgba(30, 23, 18, 0.68)",
    borda: "rgba(30, 23, 18, 0.16)",
    acentoSecundario: "#1B5E3B",
    acentoTerciario: "#7A5716",
  },
  fontes: FONTES_VORTICE,
  raio: "8px",
  densidade: "arejada",
  animacao: "marcante",
};

/** Pátio (claro): branco de vitrine, azul de placa e amarelo de faixa na calçada. */
const PATIO: Theme = {
  id: "patio",
  nome: "Pátio (branco, azul e amarelo)",
  ...INTERACOES_ORIGINAIS,
  paleta: {
    fundo: "#F3F4F1",
    fundoAlt: "#E4E7E0",
    fundoElevado: "#FFFFFF",
    destaque: "#1446A0",
    destaqueInk: "#FFFFFF",
    texto: "#14171C",
    textoSuave: "rgba(20, 23, 28, 0.72)",
    borda: "rgba(20, 23, 28, 0.14)",
    acentoSecundario: "#F2C300",
    acentoTerciario: "#0F5C3A",
  },
  fontes: FONTES_PATIO,
  raio: "6px",
  densidade: "compacta",
  animacao: "sutil",
};

/** Garagem (escuro): grafite de estúdio e ouro velho. */
const GARAGEM: Theme = {
  id: "garagem",
  nome: "Garagem (grafite e ouro)",
  ...INTERACOES_ORIGINAIS,
  paleta: {
    fundo: "#0E0E0F",
    fundoAlt: "#17171A",
    fundoElevado: "#202024",
    destaque: "#D6B04C",
    destaqueInk: "#0E0E0F",
    texto: "#F2F0EC",
    textoSuave: "rgba(242, 240, 236, 0.68)",
    borda: "rgba(242, 240, 236, 0.12)",
    acentoSecundario: "#B3262B",
    acentoTerciario: "#8C8F96",
  },
  fontes: FONTES_GARAGEM,
  raio: "2px",
  densidade: "arejada",
  animacao: "sutil",
};

/**
 * Campo (escuro): terra batida e âmbar de farol. Substitui a Meia-noite,
 * cujo verde #0C6B44 media 2,6–2,9 como texto sobre o marrom (§2).
 */
const CAMPO: Theme = {
  id: "campo",
  nome: "Campo (terra e âmbar)",
  ...INTERACOES_ORIGINAIS,
  paleta: {
    fundo: "#15130E",
    fundoAlt: "#1F1C14",
    fundoElevado: "#29251B",
    destaque: "#E8962F",
    destaqueInk: "#15130E",
    texto: "#F4EFE3",
    textoSuave: "rgba(244, 239, 227, 0.68)",
    borda: "rgba(244, 239, 227, 0.13)",
    acentoSecundario: "#8FA14A",
    acentoTerciario: "#C8B89A",
  },
  fontes: FONTES_CAMPO,
  raio: "4px",
  densidade: "confortavel",
  animacao: "sutil",
};

export const MULTIMARCAS_THEME_DEFAULT: Theme = VORTICE;
export const MULTIMARCAS_THEME_PRESETS: Theme[] = [VORTICE, PATIO, GARAGEM, CAMPO];
