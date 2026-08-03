/**
 * Decodificador de PNG (inflate + desfiltragem) — sem dependência nova: o
 * repo já usa `playwright-core` pra capturar, e LER o resultado não precisa
 * de mais nada. Extraído de `qa-diff.mjs` quando `qa-plataforma.mjs` passou
 * a precisar do mesmo pixel (a medição de matiz do cromo) e `qa-aura.mjs`
 * passou a precisar decodificar direto do buffer (os quadros do screencast
 * do CDP chegam em base64, nunca tocam o disco).
 */
import fs from "node:fs";
import zlib from "node:zlib";

export function lerPng(caminho) {
  return decodificarPng(fs.readFileSync(caminho));
}

/** Mesma decodificação, a partir do buffer. */
export function decodificarPng(buf) {
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
