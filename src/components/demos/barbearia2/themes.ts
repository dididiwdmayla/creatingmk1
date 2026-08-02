import type { Theme, ThemeFontes } from "@/lib/demos/types";

/**
 * Presets de tema da skin de barbearia2. As fontes referenciam as CSS vars
 * carregadas via next/font em src/app/demo/fonts/core.ts (--font-demo-*),
 * com fallback de sistema.
 *
 * O material bruto usa só três famílias (Fraunces serif no display, Archivo
 * sans no corpo, JetBrains Mono nas etiquetas/preços) — `serif`/`decorativa`/
 * `citacao` reaproveitam Fraunces e `destaque` reaproveita Archivo (mesmo
 * critério já usado em lancheria/tatuagem: não existe família separada para
 * logotipo ou citação no original, então inventar uma quebraria a fidelidade
 * tipográfica).
 */
const FONTES_NAVALHA: ThemeFontes = {
  display: "var(--font-demo-fraunces), Georgia, serif",
  corpo: "var(--font-demo-archivo), system-ui, sans-serif",
  mono: "var(--font-demo-mono), ui-monospace, monospace",
  serif: "var(--font-demo-fraunces), Georgia, serif",
  decorativa: "var(--font-demo-fraunces), Georgia, serif",
  citacao: "var(--font-demo-fraunces), Georgia, serif",
  destaque: "var(--font-demo-archivo), system-ui, sans-serif",
};

/**
 * Micro-interações default: o material bruto não tem splash de abertura (a
 * página abre direto no hero, com um stagger de fade/rise/sweep só em CSS —
 * `intro` fica desligada em todos os presets, igual ao critério de
 * lancheria). Hover era só troca de cor/filtro (sem lift/scale/glow
 * declarado); "lift" é o hover-padrão da Forja, aplicado por cima do
 * comportamento fixo (cor/filtro) que a skin já reproduz sem depender do
 * tema. Sem clique nem efeito de fundo no original. Hero nasce centralizado
 * (h1 com text-align:center), fiel ao layout original.
 */
const INTERACOES_ORIGINAIS = {
  intro: false,
  hover: "lift",
  clique: "nenhum",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, alinhamento: "centro" },
  led: "desligado",
} as const;

/** Paleta original do material bruto: verde-musgo escuro, latão e creme. */
const MUSGO: Theme = {
  id: "musgo",
  nome: "Musgo (verde escuro e latão)",
  ...INTERACOES_ORIGINAIS,
  paleta: {
    fundo: "#101613",
    fundoAlt: "#17201B",
    fundoElevado: "#1E2A22",
    destaque: "#B8863B",
    destaqueInk: "#101613",
    texto: "#EDE6D6",
    textoSuave: "#8A9186",
    borda: "#2A332D",
    acentoSecundario: "#8C4A2B",
    acentoTerciario: "#4A5D42",
  },
  fontes: FONTES_NAVALHA,
  raio: "2px",
  densidade: "arejada",
  animacao: "marcante",
};

/** Variante aço: cinza-ardósia frio, destaque azul-acinzentado. */
const ARDOSIA: Theme = {
  id: "ardosia",
  nome: "Ardósia (cinza e aço)",
  ...INTERACOES_ORIGINAIS,
  paleta: {
    fundo: "#12161A",
    fundoAlt: "#1A2126",
    fundoElevado: "#232C33",
    destaque: "#8FA6B8",
    destaqueInk: "#12161A",
    texto: "#E7ECEF",
    textoSuave: "#8C9AA3",
    borda: "rgba(231, 236, 239, 0.10)",
    acentoSecundario: "#B25C42",
    acentoTerciario: "#516B63",
  },
  fontes: FONTES_NAVALHA,
  raio: "0px",
  densidade: "compacta",
  animacao: "sutil",
};

/** Variante clara "marfim": creme claro, destaque espresso. */
const MARFIM: Theme = {
  id: "marfim",
  nome: "Marfim (claro e espresso)",
  ...INTERACOES_ORIGINAIS,
  hover: "zoom",
  paleta: {
    fundo: "#F4EFE4",
    fundoAlt: "#EAE1CC",
    fundoElevado: "#DED2B4",
    destaque: "#7A4A25",
    destaqueInk: "#F7F1E6",
    texto: "#241C14",
    textoSuave: "#6E5F4B",
    borda: "rgba(36, 28, 20, 0.14)",
    acentoSecundario: "#8C4A2B",
    acentoTerciario: "#556B45",
  },
  fontes: FONTES_NAVALHA,
  raio: "4px",
  densidade: "arejada",
  animacao: "sutil",
};

/** Variante noturna violeta: mostra fundoEfeito/led (recursos da Forja) ligados. */
const OURO_DA_MEIA_NOITE: Theme = {
  id: "ouro-da-meia-noite",
  nome: "Ametista da meia-noite (violeta e ametista)",
  ...INTERACOES_ORIGINAIS,
  hover: "brilho",
  clique: "pulso",
  fundoEfeito: "particulas",
  led: "sutil",
  paleta: {
    fundo: "#100A16",
    fundoAlt: "#1B1322",
    fundoElevado: "#261A30",
    destaque: "#9B5DE0",
    destaqueInk: "#100A16",
    texto: "#EEE6F5",
    textoSuave: "#9C8FB0",
    borda: "rgba(238, 230, 245, 0.10)",
    acentoSecundario: "#7A2C4A",
    acentoTerciario: "#2C4A46",
  },
  fontes: FONTES_NAVALHA,
  raio: "0px",
  densidade: "confortavel",
  animacao: "marcante",
};

export const BARBEARIA2_THEME_DEFAULT: Theme = MUSGO;
export const BARBEARIA2_THEME_PRESETS: Theme[] = [MUSGO, ARDOSIA, MARFIM, OURO_DA_MEIA_NOITE];
