import type { Theme, ThemeFontes } from "@/lib/demos/types";

/**
 * PRESETS DE PALETA E TIPOGRAFIA das quatro variantes da chapa burger — um
 * por variante, com o mesmo id dela (ver ./variantes.ts). As fontes
 * referenciam as CSS vars carregadas via next/font em
 * src/app/demo/fonts/core.ts (--font-demo-*), com fallback de sistema;
 * todas as famílias usadas aqui estão no pacote ESTÁTICO (CORE_FONT_IDS),
 * porque papel fixo de preset não pode depender de carga sob demanda.
 *
 * CONTRASTE — a régua que estas quatro passam, medida em luminância
 * relativa (mesmo cálculo de `variantes.test.tsx`):
 *
 *   - `texto` sobre `fundo` E sobre `fundoElevado` ≥ 4.5:1 (corpo é texto
 *     pequeno; o cartão tem fundo próprio e precisa ser conferido à parte);
 *   - `destaque` sobre `destaqueInk` ≥ 4.5:1 — o rótulo do CTA é texto de
 *     13-16px, abaixo do corte de "texto grande" do WCAG, então 3:1 não
 *     serve. Foi aqui que as quatro reprovavam: `destaqueInk` branco sobre
 *     laranja dá 2.98:1 e sobre o rosa da antiga "Neon", 3.42:1;
 *   - `acentoSecundario` e `acentoTerciario` sobre `fundo` e sobre
 *     `fundoElevado` ≥ 4.5:1. O terciário é o PREÇO, texto pequeno em mono;
 *     o secundário carrega o `<h1>` (grande), mas também o rótulo de 10px
 *     da seção e a pílula ativa da nav, então vale a régua do pequeno.
 *     Nas duas paletas CLARAS antigas ele reprovava feio — amarelo de marca
 *     sobre creme dá 1.65:1, e o verde de preço sobre lilás, 1.56:1.
 *
 * Papel de cada cor, herdado do material bruto: `destaque` é a cor de AÇÃO
 * (CTAs), sempre com `destaqueInk` legível por cima; `acentoSecundario` é a
 * cor de MARCA (hero, títulos, logo); `acentoTerciario` é sempre o verde
 * "de dinheiro" do preço — o papel é fixo entre as quatro, como era entre
 * os presets.
 */

/** Chapa: a dupla do material bruto — poster arredondada + neutra + mono. */
const FONTES_CHAPA: ThemeFontes = {
  display: "var(--font-demo-fugaz), Impact, 'Arial Black', sans-serif",
  corpo: "var(--font-demo-inter), system-ui, sans-serif",
  mono: "var(--font-demo-mono), ui-monospace, monospace",
  serif: "var(--font-demo-inter), system-ui, sans-serif",
  decorativa: "var(--font-demo-fugaz), Impact, 'Arial Black', sans-serif",
  citacao: "var(--font-demo-inter), system-ui, sans-serif",
  destaque: "var(--font-demo-inter), system-ui, sans-serif",
};

/** Balcão: condensada de placa de porta, corpo neutro, mono no preço. */
const FONTES_BALCAO: ThemeFontes = {
  display: "var(--font-demo-oswald), 'Arial Narrow', sans-serif",
  corpo: "var(--font-demo-inter), system-ui, sans-serif",
  mono: "var(--font-demo-mono), ui-monospace, monospace",
  serif: "var(--font-demo-inter), system-ui, sans-serif",
  decorativa: "var(--font-demo-oswald), 'Arial Narrow', sans-serif",
  citacao: "var(--font-demo-inter), system-ui, sans-serif",
  destaque: "var(--font-demo-inter), system-ui, sans-serif",
};

/** Sala: serif editorial no display, sans de leitura no corpo. */
const FONTES_SALA: ThemeFontes = {
  display: "var(--font-demo-instrument-serif), Georgia, serif",
  corpo: "var(--font-demo-instrument-sans), system-ui, sans-serif",
  mono: "var(--font-demo-mono), ui-monospace, monospace",
  serif: "var(--font-demo-instrument-serif), Georgia, serif",
  decorativa: "var(--font-demo-instrument-serif), Georgia, serif",
  citacao: "var(--font-demo-instrument-serif), Georgia, serif",
  destaque: "var(--font-demo-instrument-sans), system-ui, sans-serif",
};

/** Praça: caixa-alta alta de cartaz, corpo robusto, números condensados. */
const FONTES_PRACA: ThemeFontes = {
  display: "var(--font-demo-bebas), Impact, sans-serif",
  corpo: "var(--font-demo-archivo), system-ui, sans-serif",
  mono: "var(--font-demo-oswald), ui-monospace, monospace",
  serif: "var(--font-demo-archivo), system-ui, sans-serif",
  decorativa: "var(--font-demo-bebas), Impact, sans-serif",
  citacao: "var(--font-demo-archivo), system-ui, sans-serif",
  destaque: "var(--font-demo-archivo), system-ui, sans-serif",
};

/**
 * Micro-interações comuns: o material bruto não tem splash de abertura
 * (intro desligada nas quatro), sem efeito de fundo e sem LED (recursos só
 * da Forja). O alinhamento do hero é sobrescrito por variante, a partir do
 * knob de abertura (ver ./variantes.ts).
 */
const INTERACOES_BASE = {
  intro: false,
  clique: "pressao",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, espacamento: 0, alinhamento: "centro" },
  led: "desligado",
  ledEstilo: "barra",
} as const;

/** Chapa — casa de bairro: a paleta do material bruto, chapa quente. */
const CHAPA: Theme = {
  id: "chapa",
  nome: "Chapa — Casa de Bairro",
  ...INTERACOES_BASE,
  hover: "zoom",
  paleta: {
    fundo: "#1A0F0A",
    fundoAlt: "#2B1A10",
    fundoElevado: "#3A2215",
    destaque: "#FF6321",
    // Tinta ESCURA no laranja: o branco do material bruto dá 2.98:1, e o
    // rótulo do CTA é texto pequeno. É a única cor que a conversão fiel
    // troca, e troca por acessibilidade.
    destaqueInk: "#24120A",
    texto: "#FAF7F2",
    textoSuave: "rgba(250, 247, 242, 0.68)",
    borda: "rgba(250, 247, 242, 0.10)",
    acentoSecundario: "#FFD93D",
    acentoTerciario: "#4ADE80",
  },
  fontes: FONTES_CHAPA,
  raio: "24px",
  densidade: "confortavel",
  animacao: "marcante",
};

/** Balcão — azulejo, aço e cal: claro, quadrado e rápido. */
const BALCAO: Theme = {
  id: "balcao",
  nome: "Balcão — Smash de Almoço",
  ...INTERACOES_BASE,
  hover: "lift",
  paleta: {
    fundo: "#F4F1EA",
    fundoAlt: "#E8E3D8",
    // Cartão BRANCO sobre cal: é o azulejo, e dá ao cardápio de comanda o
    // contraste de papel que uma lista de balcão tem.
    fundoElevado: "#FFFFFF",
    destaque: "#0F6E7E",
    destaqueInk: "#FFFFFF",
    texto: "#1A1F22",
    textoSuave: "rgba(26, 31, 34, 0.66)",
    borda: "rgba(26, 31, 34, 0.16)",
    // Vermelho de placa no lugar do amarelo de marca: sobre cal, o amarelo
    // dava 1.65:1 e sumia no `<h1>` e no rótulo de 10px.
    acentoSecundario: "#B3261E",
    acentoTerciario: "#1F7A3D",
  },
  fontes: FONTES_BALCAO,
  raio: "8px",
  densidade: "compacta",
  animacao: "sutil",
};

/** Sala — escuro quente, latão e osso: casa com mesa e serviço. */
const SALA: Theme = {
  id: "sala",
  nome: "Sala — Hamburgueria Autoral",
  ...INTERACOES_BASE,
  hover: "lift",
  paleta: {
    fundo: "#12100E",
    fundoAlt: "#1C1916",
    fundoElevado: "#23201C",
    destaque: "#D6A756",
    destaqueInk: "#171310",
    texto: "#F2ECE3",
    textoSuave: "rgba(242, 236, 227, 0.64)",
    borda: "rgba(242, 236, 227, 0.12)",
    acentoSecundario: "#E8DCC8",
    acentoTerciario: "#9CC47F",
  },
  fontes: FONTES_SALA,
  raio: "4px",
  densidade: "arejada",
  animacao: "sutil",
};

/** Praça — papel quente, vermelho de truck e turquesa de toldo. */
const PRACA: Theme = {
  id: "praca",
  nome: "Praça — Food Truck",
  ...INTERACOES_BASE,
  hover: "zoom",
  clique: "pulso",
  paleta: {
    fundo: "#FFF8EC",
    fundoAlt: "#FBEFD8",
    fundoElevado: "#FFFFFF",
    destaque: "#C81E3A",
    destaqueInk: "#FFFFFF",
    texto: "#221A12",
    textoSuave: "rgba(34, 26, 18, 0.66)",
    borda: "rgba(34, 26, 18, 0.16)",
    acentoSecundario: "#0E7C86",
    acentoTerciario: "#1E7D32",
  },
  fontes: FONTES_PRACA,
  raio: "28px",
  densidade: "confortavel",
  animacao: "marcante",
};

export const LANCHERIA_THEME_DEFAULT: Theme = CHAPA;
export const LANCHERIA_THEME_PRESETS: Theme[] = [CHAPA, BALCAO, SALA, PRACA];
