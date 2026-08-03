/**
 * Compara dois PNGs e imprime a diferença média/máxima por pixel e a
 * fração de pixels que difere acima de 2 níveis. O decodificador de PNG é
 * próprio, sem dependência nova (ver ./qa-png.mjs).
 *
 * É o "provado pixel a pixel" das rodadas visuais. Um número sozinho não
 * aprova nada — ele existe pra dar ESCALA à imagem vista: compare sempre a
 * diferença antes/depois com a diferença entre "com efeito" e "sem
 * efeito", que é a presença do próprio efeito.
 *
 * Uso: node scripts/qa-diff.mjs qa-shots/a.png qa-shots/b.png
 */
import { lerPng } from "./qa-png.mjs";

const [a, b] = process.argv.slice(2);
const A = lerPng(a), B = lerPng(b);
if (A.w !== B.w || A.h !== B.h) throw new Error("tamanhos diferentes");
let soma = 0, max = 0, diferentes = 0; const n = A.w * A.h;
for (let p = 0; p < n; p++) {
  let d = 0;
  for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(A.px[p * A.canais + c] - B.px[p * B.canais + c]));
  soma += d; if (d > max) max = d; if (d > 2) diferentes++;
}
console.log(`${a.split("/").pop()} vs ${b.split("/").pop()}: médio=${(soma / n).toFixed(3)} máx=${max} px>2=${((diferentes / n) * 100).toFixed(3)}%`);
