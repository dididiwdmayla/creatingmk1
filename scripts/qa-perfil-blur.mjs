/**
 * Mede o perfil radial REAL do blob da aura como ele era ANTES: o
 * `radial-gradient(circle, C 0%, transparent 70%)` RECORTADO pelo círculo
 * do `rounded-full` (border-radius recorta o background) e só então
 * borrado por `filter: blur(Npx)`. Reproduzido num <canvas> com
 * ctx.filter, que usa a mesma implementação de blur do Chromium, e lido ao
 * longo do raio. É o alvo que a rampa sem filtro precisa reproduzir.
 *
 * Referência: viewport do laço de captura (1100px => vmax=1100 =>
 * 60vmax = 660px), blur 60/80/100px por intensidade.
 */
import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
const r = await page.evaluate(() => {
  const LADO = 660;
  const saida = {};
  for (const [inten, blur] of [[1, 60], [2, 80], [3, 100]]) {
    const pad = blur * 4;
    const c = document.createElement("canvas");
    c.width = c.height = LADO + pad * 2;
    const ctx = c.getContext("2d");
    const cx = c.width / 2, cy = c.height / 2;
    const raio = (LADO / 2) * Math.SQRT2; // farthest-corner de uma caixa quadrada
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.7, "rgba(255,255,255,0)");
    // Ordem do CSS: o border-radius recorta o BACKGROUND, e o `filter` é
    // aplicado ao elemento já recortado (e pode sangrar pra fora da caixa).
    // No canvas isso é recortar num buffer e SÓ ENTÃO desenhar com filtro.
    const buf = document.createElement("canvas");
    buf.width = c.width; buf.height = c.height;
    const bctx = buf.getContext("2d");
    bctx.beginPath();
    bctx.arc(cx, cy, LADO / 2, 0, Math.PI * 2);
    bctx.clip();
    bctx.fillStyle = g;
    bctx.fillRect(pad, pad, LADO, LADO);
    ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(buf, 0, 0);
    const dados = ctx.getImageData(0, 0, c.width, c.height).data;
    const perfil = [];
    for (let i = 0; i <= 140; i++) {
      const frac = i / 100;
      const x = Math.round(cx + frac * raio);
      if (x >= c.width) break;
      perfil.push([frac, dados[(Math.round(cy) * c.width + x) * 4 + 3] / 255]);
    }
    saida[inten] = perfil;
  }
  return saida;
});
const PARADAS = [0, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84, 91, 98, 105, 112];
for (const [inten, perfil] of Object.entries(r)) {
  const zero = perfil.find(([, a]) => a < 0.002)?.[0] ?? 1.4;
  const linha = PARADAS.map((p) => {
    const alvo = p / 100;
    let melhor = perfil[0];
    for (const ponto of perfil) if (Math.abs(ponto[0] - alvo) < Math.abs(melhor[0] - alvo)) melhor = ponto;
    return `${(melhor[1] * 100).toFixed(1)}`;
  });
  console.log(`  ${inten}: [${linha.join(", ")}],   // zera em ${(zero * 100).toFixed(0)}% do raio`);
}
await browser.close();
