/**
 * Conversão de PNG para escala de cinza (luma BT.709) — extraído da cópia
 * idêntica que já vivia em `qa-tatuagem.mjs`, `qa-chapa.mjs` e
 * `qa-multimarcas.mjs` (docs/plano-tatuagem-pigmento-vivo.md §13, D8):
 * `qa-pigmento.mjs` é o QUARTO laço a precisar dela, e duplicar pela
 * quarta vez era o sinal de extrair. Os três laços mais antigos continuam
 * com a cópia local deles — trocá-los por este módulo é limpeza separada,
 * fora desta migração (mesmo critério do plano para `variantes.mjs`/
 * `temas.mjs`).
 */
import { lerPng } from "./png.mjs";

/** Um PNG em cinza (luma BT.709) — `{ w, h, cinza }`, `cinza` é um array de linhas (um Buffer por linha). */
export function paraCinza(arquivo) {
  const { w, h, px, canais } = lerPng(arquivo);
  const linhas = [];
  for (let y = 0; y < h; y++) {
    const linha = Buffer.alloc(w);
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * canais;
      linha[x] = Math.round(0.2126 * px[p] + 0.7152 * px[p + 1] + 0.0722 * px[p + 2]);
    }
    linhas.push(linha);
  }
  return { w, h, cinza: linhas };
}
