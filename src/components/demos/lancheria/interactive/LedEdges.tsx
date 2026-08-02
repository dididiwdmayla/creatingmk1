/**
 * Reexporta o componente centralizado (ver src/lib/demos/led/LedEdges.tsx)
 * — idêntico nas 8 skins, sem dependência do nicho. Manter o arquivo aqui
 * (em vez de importar `@/lib/demos/led/LedEdges` direto no Skin.tsx) segue
 * a mesma convenção do resto de `interactive/`: cada skin importa da
 * própria pasta.
 */
export { LedEdges } from "@/lib/demos/led/LedEdges";
