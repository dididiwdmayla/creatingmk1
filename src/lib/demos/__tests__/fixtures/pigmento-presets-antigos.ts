import type { Theme, ThemeFontes } from "@/lib/demos/types";

/**
 * Cópia CONGELADA dos quatro presets de `tatuagem-pigmento-vivo` de ANTES
 * desta migração (commit 40e84d1^, `src/components/demos/tatuagem2/
 * themes.ts`) — sem `Theme.pigmento`, sem knobs de composição por seção.
 * Existe só para o teste de mutação (docs/plano-tatuagem-pigmento-vivo.md
 * §9 camada 3): `violacoesDeVariantes` precisa enxergar o que acontece
 * quando uma variante REGRIDE para este preset (sem `pigmento`, cai no
 * default — que é a composição da Aquarela — e empata com ela nos quatro
 * knobs de silhueta). Nunca importado pelo registro real.
 */
const FONTES_PIGMENTO_ANTIGO: ThemeFontes = {
  display: "var(--font-demo-dm-serif), Georgia, serif",
  corpo: "var(--font-demo-archivo), system-ui, sans-serif",
  mono: "var(--font-demo-archivo), system-ui, sans-serif",
  serif: "var(--font-demo-dm-serif), Georgia, serif",
  decorativa: "var(--font-demo-dm-serif), Georgia, serif",
  citacao: "var(--font-demo-dm-serif), Georgia, serif",
  destaque: "var(--font-demo-archivo), system-ui, sans-serif",
};

const AQUARELA_ANTIGA: Theme = {
  id: "aquarela",
  nome: "Aquarela (creme, rosa e azul)",
  paleta: {
    fundo: "#FAF6F0",
    fundoAlt: "#F1E9DB",
    fundoElevado: "#E9DFC9",
    destaque: "#D6336C",
    destaqueInk: "#FFFFFF",
    texto: "#141414",
    textoSuave: "rgba(20, 20, 20, 0.65)",
    borda: "rgba(20, 20, 20, 0.12)",
    acentoSecundario: "#2B4EFF",
    acentoTerciario: "#FF6B35",
  },
  fontes: FONTES_PIGMENTO_ANTIGO,
  raio: "4px",
  densidade: "arejada",
  animacao: "marcante",
  intro: false,
  hover: "lift",
  clique: "pressao",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, espacamento: 0, alinhamento: "esquerda" },
  led: "desligado",
  ledEstilo: "barra",
};

/** Preset ANTIGO da Boreal — sem `pigmento`, o único usado no teste de mutação. */
const BOREAL_ANTIGA: Theme = {
  id: "boreal",
  nome: "Boreal (cinza, verde e violeta)",
  paleta: {
    fundo: "#F5F7F6",
    fundoAlt: "#E9EEEC",
    fundoElevado: "#DEE7E3",
    destaque: "#0F9D6E",
    destaqueInk: "#FFFFFF",
    texto: "#101614",
    textoSuave: "rgba(16, 22, 20, 0.62)",
    borda: "rgba(16, 22, 20, 0.12)",
    acentoSecundario: "#6633CC",
    acentoTerciario: "#2B4EFF",
  },
  fontes: FONTES_PIGMENTO_ANTIGO,
  raio: "8px",
  densidade: "confortavel",
  animacao: "sutil",
  intro: false,
  hover: "brilho",
  clique: "nenhum",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, espacamento: 0, alinhamento: "centro" },
  led: "desligado",
  ledEstilo: "barra",
};

const MEIA_NOITE_ANTIGA: Theme = {
  id: "meia-noite",
  nome: "Meia-noite (preto, ciano e magenta)",
  paleta: {
    fundo: "#0E0B10",
    fundoAlt: "#17121C",
    fundoElevado: "#221B29",
    destaque: "#22B8D9",
    destaqueInk: "#0B2A30",
    texto: "#F5F1EC",
    textoSuave: "rgba(245, 241, 236, 0.62)",
    borda: "rgba(245, 241, 236, 0.10)",
    acentoSecundario: "#E23FA0",
    acentoTerciario: "#FF9152",
  },
  fontes: FONTES_PIGMENTO_ANTIGO,
  raio: "12px",
  densidade: "confortavel",
  animacao: "sutil",
  intro: false,
  hover: "zoom",
  clique: "pulso",
  fundoEfeito: "particulas",
  heroTitulo: { fonte: "", escala: 1, espacamento: 0, alinhamento: "esquerda" },
  led: "sutil",
  ledEstilo: "barra",
};

const TERRA_ANTIGA: Theme = {
  id: "terra",
  nome: "Terra (bege, terracota e petróleo)",
  paleta: {
    fundo: "#F4EDE2",
    fundoAlt: "#E9DCC7",
    fundoElevado: "#DDCBAE",
    destaque: "#C1512F",
    destaqueInk: "#FFFFFF",
    texto: "#241C14",
    textoSuave: "rgba(36, 28, 20, 0.62)",
    borda: "rgba(36, 28, 20, 0.14)",
    acentoSecundario: "#8A6D1E",
    acentoTerciario: "#2F6B5E",
  },
  fontes: FONTES_PIGMENTO_ANTIGO,
  raio: "16px",
  densidade: "arejada",
  animacao: "marcante",
  intro: false,
  hover: "lift",
  clique: "pressao",
  fundoEfeito: "nenhum",
  heroTitulo: { fonte: "", escala: 1, espacamento: 0, alinhamento: "esquerda" },
  led: "desligado",
  ledEstilo: "barra",
};

export const PIGMENTO_PRESETS_ANTIGOS: Readonly<Record<string, Theme>> = {
  aquarela: AQUARELA_ANTIGA,
  boreal: BOREAL_ANTIGA,
  "meia-noite": MEIA_NOITE_ANTIGA,
  terra: TERRA_ANTIGA,
};
