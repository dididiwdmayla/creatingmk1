import type { SkinVariante, Theme } from "@/lib/demos/types";
import { criarVariante } from "@/lib/demos/variantes";

import { TATUAGEM2_EXEMPLOS_POR_VARIANTE } from "./exemplos";
import { TATUAGEM2_SECOES } from "./secoes";
import { TATUAGEM2_THEME_PRESETS } from "./themes";

/**
 * As quatro VARIANTES da `tatuagem-pigmento-vivo` — quatro TIPOS DE ESTÚDIO,
 * não quatro paletas (docs/plano-tatuagem-pigmento-vivo.md §6). Sessão de
 * FUNDAÇÃO (2a): id/nome/descrição/fundo/paleta/fontes. A sessão 2b aplica
 * aqui a ordem própria do §6, os onze knobs de `PigmentoComposicao` e a
 * cópia editorial própria de cada tipo de estúdio.
 *
 * IDs INALTERADOS, sem alias (§6, §17 D5): `aquarela`/`boreal`/
 * `meia-noite`/`terra` já são o que `LeadDemo.themeId` grava. `aquarela`
 * continua o default — é a variante que carrega a conversão fiel do
 * material bruto.
 */
interface Declaracao {
  id: string;
  nome: string;
  descricao: string;
  fundo: "claro" | "escuro";
  /** Id do preset de paleta/tipografia em ./themes.ts (o mesmo da variante). */
  presetId: string;
}

const DECLARACOES: readonly Declaracao[] = [
  {
    id: "aquarela",
    nome: "Aquarela — Ateliê de Cor",
    descricao:
      "Estúdio autoral de cor: aquarela, neo-tradicional colorido. Quem chega escolhe pela COR do portfólio e quer uma peça única; lê o manifesto. Conversão fiel do material bruto; continua o default.",
    fundo: "claro",
    presetId: "aquarela",
  },
  {
    id: "boreal",
    nome: "Boreal — Cobertura e Reforma",
    descricao:
      "Cobertura (cover-up) e restauração de cor. Quem chega tem uma tatuagem antiga que incomoda e quer saber se tem jeito: resultado, processo e dúvida antes do preço.",
    fundo: "claro",
    presetId: "boreal",
  },
  {
    id: "meia-noite",
    nome: "Meia-noite — Cor Pop",
    descricao:
      "Cor saturada pop: anime, geek, neo-trad de desenho. Quem chega é jovem, vem pelo Instagram, escolhe por estilo e artista.",
    fundo: "escuro",
    presetId: "meia-noite",
  },
  {
    id: "terra",
    nome: "Terra — Homenagem e Retrato",
    descricao:
      "Homenagem, retrato colorido (pessoas, pets), memória. Quem chega quer eternizar alguém; lê depoimento antes de tudo, tem medo de errar o rosto.",
    fundo: "claro",
    presetId: "terra",
  },
];

/** Permutações do §6. A fixa `hero` permanece na posição do contrato. */
const ORDENS: Record<string, readonly string[]> = {
  aquarela: [
    "hero", "manifesto", "estilos", "investimento", "portfolio", "artistas",
    "depoimentos", "processo", "faq", "agendar", "contato",
  ],
  boreal: [
    "hero", "portfolio", "processo", "faq", "depoimentos", "investimento",
    "artistas", "estilos", "manifesto", "agendar", "contato",
  ],
  "meia-noite": [
    "hero", "estilos", "portfolio", "artistas", "investimento", "manifesto",
    "depoimentos", "faq", "processo", "agendar", "contato",
  ],
  terra: [
    "hero", "manifesto", "depoimentos", "portfolio", "processo", "artistas",
    "faq", "investimento", "estilos", "agendar", "contato",
  ],
};

export const TATUAGEM2_VARIANTES: readonly SkinVariante[] = DECLARACOES.map((d) => {
  const preset = TATUAGEM2_THEME_PRESETS.find((t) => t.id === d.presetId)!;
  const theme: Theme = { ...preset, id: d.id, nome: d.nome };
  return criarVariante(
    {
      id: d.id,
      nome: d.nome,
      descricao: d.descricao,
      fundo: d.fundo,
      theme,
      exemplo: TATUAGEM2_EXEMPLOS_POR_VARIANTE[d.id],
      arranjo: { ordem: ORDENS[d.id] ?? TATUAGEM2_SECOES.map((s) => s.id) },
      thumbnail: `/demos/tatuagem2/${d.id}.jpg`,
    },
    TATUAGEM2_SECOES,
  );
});
