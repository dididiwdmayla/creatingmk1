import type { DecorativeFloatDef } from "@/lib/demos/types";

/**
 * Flutuantes decorativos da lancheria — fiéis ao `<DecorativeElement>` do
 * material bruto (tomate/queijo/bacon caindo pela borda das seções, com
 * parallax sutil no scroll): posição/tamanho/rotação vêm daqui (contrato
 * da skin, ver ./Skin.tsx), a imagem em si é um slot normal de
 * DemoData.imagens — editável no editor como qualquer outro (ver
 * LANCHERIA_EXEMPLO.imagens em ./exemplo.ts pros placeholders locais).
 */
export const LANCHERIA_DECORATIVE_FLOATS: DecorativeFloatDef[] = [
  { slot: "flutuante-bacon", secaoId: "cardapio", lado: "esquerda", tamanho: 180, rotacao: 12 },
  { slot: "flutuante-queijo", secaoId: "bebidas", lado: "direita", tamanho: 200, rotacao: -8 },
  { slot: "flutuante-bebida", secaoId: "acompanhamentos", lado: "esquerda", tamanho: 220, rotacao: -15 },
];
