import type { LedEstiloDefinition } from "./types";

/**
 * Registro de estilos de borda LED. "barra" é o estilo original (única
 * opção antes deste registro existir) — todo preset de tema existente já
 * declara `ledEstilo: "barra"` explicitamente (ver themes.ts de cada
 * skin), então nenhuma demo publicada muda de aparência com esta migração.
 * Para adicionar um estilo: acrescente a variação de CSS em
 * `./LedEdges.tsx` (atrás de `[data-d-led-estilo="<id>"]`) e a entrada
 * aqui. Ver ARCHITECTURE.md.
 */
export const LED_ESTILOS: LedEstiloDefinition[] = [
  {
    id: "barra",
    nome: "Barra",
    // Estilo original — o mesmo recomendado de sempre para `led` (todas as
    // skins que já ligavam LED em algum preset).
    nichosRecomendados: ["barbearia", "tatuagem", "imobiliaria", "multimarcas", "lancheria"],
  },
  {
    id: "dissipado",
    nome: "Dissipado",
    // Halo largo e difuso — combina com o clima mais suave/atmosférico de
    // imobiliária (premium) e lancheria (neon de vitrine).
    nichosRecomendados: ["imobiliaria", "lancheria"],
  },
  {
    id: "cantos",
    nome: "Cantos",
    // Luz só nos 4 cantos, sem barra contínua — mais discreto, combina com
    // petshop e o showroom de multimarcas.
    nichosRecomendados: ["petshop", "multimarcas"],
  },
  {
    id: "moldura",
    nome: "Moldura",
    // Perímetro completo com pulso percorrendo — mais "cerimonioso",
    // combina com tatuagem (moldura de estúdio) e barbearia (vitrine).
    nichosRecomendados: ["tatuagem", "barbearia"],
  },
];

export const LED_ESTILO_PADRAO = "barra";

export function getLedEstilo(id: string | undefined): LedEstiloDefinition | undefined {
  return LED_ESTILOS.find((estilo) => estilo.id === id);
}
