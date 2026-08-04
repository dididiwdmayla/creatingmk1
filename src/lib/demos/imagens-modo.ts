import type { ImagensModo } from "./types";

/**
 * Resolução da BASE de cada slot de `imagens` (o que aparece sem upload do
 * lead) conforme `DemoData.imagensModo` — ver ARCHITECTURE.md, "Imagens de
 * produção (`foto/`) + `imagensModo`". Upload do lead nunca passa por aqui:
 * ele já vence na camada de merge (`aplicarPatch`/`montarDemoData`), que
 * roda por CIMA do resultado desta função.
 */

/**
 * Slots sem foto de produção disponível, por skinId — caem no SVG mesmo em
 * `imagensModo: "foto"` (ver `baseImagemSlot`). Mesmo padrão de
 * `DEFAULTS_HISTORICOS` (./legado.ts): mapa plano por skinId, para não
 * acoplar esta função ao registro de skins. Hoje toda skin do registro tem
 * foto para 100% dos slots (ver docs/manifesto-imagens.md) — a lista fica
 * vazia e pronta para quando um slot novo entrar antes da foto correspondente
 * ser produzida.
 */
export const SLOTS_SEM_FOTO: Record<string, readonly string[]> = {};

/**
 * Deriva o caminho da foto de produção a partir do placeholder SVG do
 * exemplo (`/demos/<pasta>/<slot>.svg` → `/demos/<pasta>/foto/<slot>.webp`).
 * `undefined` se `svgPath` não seguir essa convenção (fixture de teste sem
 * skin real, por exemplo) — quem chama cai no SVG original nesse caso.
 */
export function caminhoFotoDoSlot(svgPath: string): string | undefined {
  if (!svgPath.endsWith(".svg")) return undefined;
  const i = svgPath.lastIndexOf("/");
  if (i < 0) return undefined;
  const pasta = svgPath.slice(0, i);
  const slot = svgPath.slice(i + 1, -".svg".length);
  return `${pasta}/foto/${slot}.webp`;
}

/**
 * Base do slot (sem upload do lead) no modo dado: "grafico" sempre devolve
 * o SVG; "foto" devolve a foto de produção, exceto quando o slot está em
 * `SLOTS_SEM_FOTO` da skin (ou `svgPath` não segue a convenção de
 * placeholder), caso em que também cai no SVG.
 */
export function baseImagemSlot(
  skinId: string | undefined,
  slot: string,
  svgPath: string,
  modo: ImagensModo,
): string {
  if (modo === "grafico") return svgPath;
  if (skinId && SLOTS_SEM_FOTO[skinId]?.includes(slot)) return svgPath;
  return caminhoFotoDoSlot(svgPath) ?? svgPath;
}
