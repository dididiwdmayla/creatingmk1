/**
 * Compara dois PNGs e imprime a diferença média/máxima por pixel e a
 * fração de pixels que difere acima de 2 níveis. Decodificador de PNG
 * próprio (inflate + desfiltragem), pra não acrescentar dependência: o
 * repo já usa `playwright-core` pra capturar, e ler o resultado não
 * precisa de mais nada.
 *
 * É o "provado pixel a pixel" das rodadas visuais. Um número sozinho não
 * aprova nada — ele existe pra dar ESCALA à imagem vista: compare sempre a
 * diferença antes/depois com a diferença entre "com efeito" e "sem
 * efeito", que é a presença do próprio efeito.
 *
 * Uso: node scripts/qa-diff.mjs qa-shots/a.png qa-shots/b.png
 */
import fs from "node:fs";
import zlib from "node:zlib";
function lerPng(caminho) {
  const buf = fs.readFileSync(caminho);
  let i = 8, w = 0, h = 0, bit = 0, cor = 0; const idat = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i); const tipo = buf.toString("ascii", i + 4, i + 8);
    if (tipo === "IHDR") { w = buf.readUInt32BE(i + 8); h = buf.readUInt32BE(i + 12); bit = buf[i + 16]; cor = buf[i + 17]; }
    if (tipo === "IDAT") idat.push(buf.subarray(i + 8, i + 8 + len));
    i += 12 + len;
  }
  if (bit !== 8) throw new Error("só 8 bits");
  const canais = cor === 6 ? 4 : cor === 2 ? 3 : (() => { throw new Error("cor " + cor); })();
  const bruto = zlib.inflateSync(Buffer.concat(idat));
  const linha = w * canais; const px = Buffer.alloc(w * h * canais); let ant = Buffer.alloc(linha);
  for (let y = 0; y < h; y++) {
    const f = bruto[y * (linha + 1)]; const src = bruto.subarray(y * (linha + 1) + 1, y * (linha + 1) + 1 + linha);
    const out = Buffer.alloc(linha);
    for (let x = 0; x < linha; x++) {
      const a = x >= canais ? out[x - canais] : 0, b = ant[x], c = x >= canais ? ant[x - canais] : 0; let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[x] = v & 255;
    }
    out.copy(px, y * linha); ant = out;
  }
  return { w, h, canais, px };
}
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
