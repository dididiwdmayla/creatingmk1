#!/usr/bin/env node
/**
 * Laço da `tatuagem-editorial` — o que só o NAVEGADOR prova.
 *
 * A trava (`variantes.test.tsx`) e o contrato SSR
 * (`tatuagem-contrato.test.tsx`) já cobrem o HTML: mesmas seções, mesmos
 * slots, um `<h1>` na abertura. Nenhum dos dois enxerga CSS — e a
 * composição da variante É CSS. Três coisas, então, só aqui:
 *
 *  1. **O aviso do editor é verdade.** `SkinVariante.imagensOcultas`
 *     declara os slots que a composição não desenha. Aqui a caixa de cada
 *     slot é MEDIDA, com JavaScript desligado: zero para o que está
 *     declarado, maior que zero para o que não está. Sem isto a declaração
 *     seria um comentário, e o aviso que o operador lê podia estar errado.
 *  2. **O título da Cripta no celular.** A abertura dividida é a única que
 *     poderia espremer o título: numa coluna de meia largura ele quebraria
 *     em muitas linhas, e o vídeo dentro das letras só se lê em letra
 *     grande. Piso: no máximo TRÊS linhas a 390px, corpo não menor que o
 *     das outras variantes e nenhum transbordo horizontal.
 *  3. **O PORTÃO DE DRASTICIDADE.** Página inteira das quatro no celular,
 *     convertida para escala de cinza e montada lado a lado. Duas que
 *     custem a distinguir sem cor não são quatro variantes — são quatro
 *     paletas, e a variante está reprovada. O número dá ESCALA ao que a
 *     folha mostra; quem julga é quem olha.
 *
 * Uso:
 *   node scripts/qa-tatuagem.mjs                # tudo
 *   node scripts/qa-tatuagem.mjs --sem-build    # reusa o .next já buildado
 *   node scripts/qa-tatuagem.mjs --sem-portao   # mede e reporta, não reprova
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";

import { IMAGENS_OCULTAS_POR_VARIANTE, VARIANTES_POR_SKIN } from "../src/lib/demos/capturas/variantes.mjs";
import { lerPng } from "./png.mjs";
import { CHROMIUM, SAIDA, subirServidor } from "./qa-servidor.mjs";

const SKIN = "tatuagem-editorial";
const VARIANTES = VARIANTES_POR_SKIN[SKIN];
const OCULTAS = IMAGENS_OCULTAS_POR_VARIANTE[SKIN] ?? {};
const NOME = "Estúdio Contrato Real";
const SECOES = [
  "hero", "sobre", "statement", "portfolio", "investimento",
  "depoimentos", "marquee", "processo", "contato",
];
const SLOTS = [
  "hero", "sobre",
  ...Array.from({ length: 8 }, (_, i) => `portfolio-${i + 1}`),
];
/** Celular primeiro: é a tela do portão e a que o lead abre. */
const TELAS = [
  { id: "390", width: 390, height: 844 },
  { id: "1100", width: 1100, height: 800 },
];
/** Máximo de linhas do título no celular — acima disso ele deixou de ser assinatura. */
const LINHAS_MAX = 3;
/**
 * Piso de contraste DENTRO da caixa do título (amplitude p95−p05 em cinza).
 *
 * O título é preenchido pela mídia e contornado pelo acento, então não dá
 * para exigir "texto claro sobre fundo escuro": nas variantes escuras a
 * letra É a foto, e a foto é escura de propósito. O que NÃO pode é a caixa
 * inteira virar um bloco de uma cor só — aí o nome sumiu, e o print da
 * âncora hero deixa de servir para o que existe.
 *
 * 20 é folgado de propósito: reprova o título invisível, não o título
 * sóbrio. A medida das quatro sai no relatório, que é onde se compara.
 */
const CONTRASTE_TITULO_MIN = 20;

const semPortao = process.argv.includes("--sem-portao");
const saida = path.join(SAIDA, "tatuagem");
await fs.mkdir(saida, { recursive: true });

const url = (preset, extra = "") =>
  `${app.base}/interno/demo-qa?skin=${SKIN}&preset=${preset}&avulsa=1` +
  `&nome=${encodeURIComponent(NOME)}&efeito=nenhum&intro=0${extra}`;

/** Um PNG em cinza (luma BT.709), em data: URI — é a folha do portão. */
function paraCinza(arquivo) {
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

const app = await subirServidor({ build: !process.argv.includes("--sem-build") });
const browser = await chromium.launch({
  executablePath: CHROMIUM, headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const relatorio = { contrato: [], slots: [], titulo: [], drasticidade: null };
const falhas = [];

try {
  /* ── 1 + 2. Contrato e caixas, SEM JAVASCRIPT ────────────────────────
   * `javaScriptEnabled:false` é o ponto: a composição tem de valer no
   * documento servido, que é o que a captura de prospecção mede. */
  const ctx = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: TELAS[0].width, height: TELAS[0].height },
  });
  await ctx.addCookies([app.cookie]);
  const page = await ctx.newPage();

  for (const tela of TELAS) {
    await page.setViewportSize({ width: tela.width, height: tela.height });
    for (const v of VARIANTES) {
      await page.goto(url(v), { waitUntil: "networkidle" });

      const medida = await page.evaluate(
        ({ slots }) => {
          const caixa = (el) => {
            if (!el) return null;
            const b = el.getBoundingClientRect();
            return { w: Math.round(b.width), h: Math.round(b.height) };
          };
          const hero = document.querySelector('[data-d-secao="hero"]');
          const h1 = hero?.querySelector("h1");
          // Linhas REAIS do título: os retângulos de cliente do range do
          // nó de texto, que é como o navegador de fato quebrou a caixa.
          const alvo = document.querySelector('[data-demo-slot="secoes.hero.titulo"]');
          const caixaTexto = alvo?.querySelector(".d-wordmark-text");
          let linhas = 0;
          let corpo = 0;
          if (caixaTexto) {
            const r = document.createRange();
            r.selectNodeContents(caixaTexto);
            const tops = new Set();
            for (const rect of r.getClientRects()) {
              if (rect.width > 0 && rect.height > 0) tops.add(Math.round(rect.top));
            }
            linhas = tops.size;
            corpo = parseFloat(getComputedStyle(caixaTexto).fontSize);
          }
          return {
            h1s: document.querySelectorAll("h1").length,
            nome: (h1?.textContent ?? "").replace(/\s+/g, " ").trim(),
            h1NaAbertura: Boolean(h1),
            secoes: [...document.querySelectorAll("[data-d-secao]")].map((e) =>
              e.getAttribute("data-d-secao"),
            ),
            transborda: document.documentElement.scrollWidth > window.innerWidth,
            linhas,
            corpo,
            tituloCaixa: caixa(caixaTexto),
            slots: Object.fromEntries(
              slots.map((s) => [s, caixa(document.querySelector(`[data-demo-slot="imagens.${s}"]`))]),
            ),
          };
        },
        { slots: SLOTS },
      );

      const ctx0 = `${v} @${tela.id}`;
      try {
        assert.equal(medida.h1s, 1, `${ctx0}: ${medida.h1s} <h1>`);
        assert.ok(medida.h1NaAbertura, `${ctx0}: <h1> fora da âncora hero`);
        assert.equal(medida.nome, NOME, `${ctx0}: h1 "${medida.nome}"`);
        assert.deepEqual([...medida.secoes].sort(), [...SECOES].sort(), `${ctx0}: seções`);
        assert.equal(new Set(medida.secoes).size, medida.secoes.length, `${ctx0}: seção repetida`);
        assert.equal(medida.transborda, false, `${ctx0}: transbordo horizontal`);
      } catch (e) { falhas.push(e.message); }
      relatorio.contrato.push({ variante: v, tela: tela.id, ...medida, slots: undefined });

      // O aviso do editor, medido: declarado ⇒ caixa zero; não declarado ⇒ caixa > 0.
      for (const slot of SLOTS) {
        const c = medida.slots[slot];
        const declarado = Boolean(OCULTAS[v]?.[slot]);
        const desenhado = Boolean(c && c.w > 0 && c.h > 0);
        relatorio.slots.push({ variante: v, tela: tela.id, slot, declarado, desenhado, caixa: c });
        try {
          assert.equal(desenhado, !declarado,
            declarado
              ? `${ctx0}: slot "${slot}" está declarado em imagensOcultas mas DESENHA (${c?.w}×${c?.h}) — o aviso do editor mente`
              : `${ctx0}: slot "${slot}" NÃO desenha e não está declarado em imagensOcultas — o operador sobe a foto e não vê nada`);
        } catch (e) { falhas.push(e.message); }
      }

      if (tela.id === "390") {
        relatorio.titulo.push({ variante: v, linhas: medida.linhas, corpo: medida.corpo, caixa: medida.tituloCaixa });
      }
    }
  }

  // O título no celular: nenhuma abertura pode espremer nem picar o nome.
  const piso = Math.min(...relatorio.titulo.map((t) => t.corpo));
  for (const t of relatorio.titulo) {
    try {
      assert.ok(t.linhas > 0 && t.linhas <= LINHAS_MAX,
        `${t.variante} @390: título em ${t.linhas} linhas (teto ${LINHAS_MAX})`);
      assert.ok(t.corpo >= piso,
        `${t.variante} @390: corpo ${t.corpo}px abaixo do piso ${piso}px — título espremido`);
    } catch (e) { falhas.push(e.message); }
  }
  await ctx.close();

  /* ── 3. PORTÃO DE DRASTICIDADE ───────────────────────────────────── */
  const ctxImg = await browser.newContext({
    viewport: { width: TELAS[0].width, height: TELAS[0].height },
    deviceScaleFactor: 2,
  });
  await ctxImg.addCookies([app.cookie]);
  const pagina = await ctxImg.newPage();
  const cheias = [];
  const heros = [];
  for (const v of VARIANTES) {
    await pagina.goto(url(v), { waitUntil: "networkidle" });
    await pagina.waitForTimeout(1200);
    // Passa por todas as seções: as entradas por scroll são `whileInView`,
    // e uma captura de página inteira sem isso sai com metade invisível.
    for (const sec of await pagina.locator("[data-d-secao]").all()) {
      await sec.scrollIntoViewIfNeeded();
      await pagina.waitForTimeout(140);
    }
    await pagina.evaluate(() => window.scrollTo(0, 0));
    await pagina.waitForTimeout(700);
    /* Congela TUDO, e o contorno do título numa FASE FIXA.
     *
     * `d-stroke-cycle` percorre acento → secundário → terciário em 12s, e
     * as três cores têm luminâncias diferentes. Pausar no instante em que
     * a captura chegou faria o contraste medido variar de rodada para
     * rodada — portão que oscila não é portão. `currentTime = 0` é o
     * acento da paleta, que é a cor que a variante declara. */
    await pagina.evaluate(() => {
      for (const a of document.getAnimations()) {
        a.pause();
        if (String(a.animationName ?? "").startsWith("d-wordmark") ||
            String(a.animationName ?? "") === "d-stroke-cycle") {
          a.currentTime = 0;
        }
      }
    });
    await pagina.waitForTimeout(120);

    const hero = path.join(saida, `hero-${v}.png`);
    await pagina.locator('[data-d-secao="hero"]').screenshot({ path: hero });

    /* O nome tem de SAIR no print da âncora hero — e "sair" se mede dentro
     * da caixa do título, não no HTML: o `<h1>` pode estar lá e a caixa ser
     * um retângulo de uma cor só. */
    const tituloPng = path.join(saida, `titulo-${v}.png`);
    await pagina.locator('[data-demo-slot="secoes.hero.titulo"]').screenshot({ path: tituloPng });
    const t = lerPng(tituloPng);
    const cinzas = [];
    for (let i = 0; i < t.w * t.h; i++) {
      const o = i * t.canais;
      cinzas.push(0.2126 * t.px[o] + 0.7152 * t.px[o + 1] + 0.0722 * t.px[o + 2]);
    }
    cinzas.sort((a, b) => a - b);
    const quantil = (f) => Math.round(cinzas[Math.floor(cinzas.length * f)]);
    const amplitude = quantil(0.95) - quantil(0.05);
    heros.push({ variante: v, arquivo: hero, amplitude, p05: quantil(0.05), p95: quantil(0.95) });
    try {
      assert.ok(amplitude >= CONTRASTE_TITULO_MIN,
        `${v}: caixa do título com amplitude ${amplitude} (piso ${CONTRASTE_TITULO_MIN}) — o nome não sai no print da âncora hero`);
    } catch (e) { falhas.push(e.message); }

    const cheia = path.join(saida, `pagina-${v}.png`);
    await pagina.screenshot({ path: cheia, fullPage: true });
    cheias.push({ variante: v, arquivo: cheia, ...paraCinza(cheia) });
  }

  /* DUAS folhas, porque uma só não serve. Uma página de 390×11400 não
   * cabe ao lado de outras três num tamanho que se enxergue: reduzida ao
   * ponto de caber, cada coluna vira uma tira de 60px.
   *
   *   1. ABERTURA — as três primeiras telas de cada uma, em tamanho de
   *      leitura. É o que a pessoa vê antes de decidir se rola.
   *   2. SILHUETA — a página INTEIRA das quatro, no mesmo fator de escala
   *      (as alturas relativas ficam de pé). É o teste de apertar os
   *      olhos: o que sobra aqui é ritmo e estrutura, nada mais.
   *
   * Nas duas o cinza vem do `filter`, sobre o PNG original. */
  for (const c of cheias) c.base64 = (await fs.readFile(c.arquivo)).toString("base64");
  const LARGURA_CSS = TELAS[0].width;
  const cabeca = (titulo, subtitulo) =>
    `<div style="padding:10px 12px;font:600 15px system-ui;color:#eee">${titulo}` +
    `<div style="font-weight:400;color:#9a9a9a;margin-top:3px;font-size:12px">${subtitulo}</div></div>`;
  const folhaHtml = (titulo, subtitulo, estiloImg, legenda) =>
    `<!doctype html><meta charset="utf-8">` +
    `<body style="margin:0;background:#151515;font:12px system-ui;color:#bbb">` +
    cabeca(titulo, subtitulo) +
    `<div style="display:flex;gap:10px;padding:0 12px 12px;align-items:flex-start">` +
    cheias
      .map(
        (c) => `<figure style="margin:0">
        <figcaption style="padding:3px 0">${c.variante} · ${legenda(c)}</figcaption>
        <img src="data:image/png;base64,${c.base64}"
             style="${estiloImg(c)};display:block;border:1px solid #3a3a3a;filter:grayscale(1)">
      </figure>`,
      )
      .join("") +
    `</div></body>`;

  // 1. Abertura: três telas, recortadas por uma janela de altura fixa.
  const TELAS_DE_ABERTURA = 3;
  const alturaAbertura = TELAS[0].height * TELAS_DE_ABERTURA;
  await pagina.setViewportSize({ width: 1700, height: 1000 });
  await pagina.setContent(
    `<!doctype html><meta charset="utf-8">` +
      `<body style="margin:0;background:#151515;font:12px system-ui;color:#bbb">` +
      cabeca(
        `tatuagem-editorial — as três primeiras telas, celular ${LARGURA_CSS}×${TELAS[0].height}, EM ESCALA DE CINZA`,
        "Se duas custam a distinguir aqui, a variante está reprovada: sem cor, o que sobra é a composição.",
      ) +
      `<div style="display:flex;gap:10px;padding:0 12px 12px;align-items:flex-start">` +
      cheias
        .map(
          (c) => `<figure style="margin:0">
        <figcaption style="padding:3px 0">${c.variante} · página inteira ${Math.round(c.h / 2)}px</figcaption>
        <div style="width:${LARGURA_CSS}px;height:${alturaAbertura}px;overflow:hidden;border:1px solid #3a3a3a">
          <img src="data:image/png;base64,${c.base64}" style="width:${LARGURA_CSS}px;display:block;filter:grayscale(1)">
        </div>
      </figure>`,
        )
        .join("") +
      `</div></body>`,
  );
  await pagina.waitForTimeout(400);
  const folha = path.join(saida, "_folha-cinza.png");
  await pagina.screenshot({ path: folha, fullPage: true });

  // 2. Silhueta: a página inteira das quatro, mesmo fator de escala.
  const ALTURA_SILHUETA = 2400;
  const maiorCss = Math.max(...cheias.map((c) => c.h / 2));
  const fator = ALTURA_SILHUETA / maiorCss;
  await pagina.setContent(
    folhaHtml(
      "tatuagem-editorial — a PÁGINA INTEIRA das quatro, mesmo fator de escala, EM ESCALA DE CINZA",
      `Teste de apertar os olhos: sobra ritmo e estrutura. Fator ${fator.toFixed(3)}× sobre a maior (${Math.round(maiorCss)}px).`,
      (c) => `width:${Math.round(LARGURA_CSS * fator)}px;height:${Math.round((c.h / 2) * fator)}px`,
      (c) => `${Math.round(c.h / 2)}px`,
    ),
  );
  await pagina.waitForTimeout(400);
  const silhueta = path.join(saida, "_folha-silhueta.png");
  await pagina.screenshot({ path: silhueta, fullPage: true });

  /* A ESCALA do que a folha mostra. Duas medidas, porque cada uma responde
   * a uma pergunta diferente:
   *
   *  - ABERTURA: diferença média em cinza nas três primeiras telas. É
   *    região CORRESPONDENTE nas quatro, então o número compara o mesmo
   *    lugar. (Comparar a página inteira não compara: com alturas de 5.900
   *    a 11.400px, o mesmo y é uma seção em cada variante, e o número vira
   *    ruído travestido de medida.)
   *  - ALTURA: quanto cada página mede. Duas composições que rendem
   *    alturas muito diferentes já são estruturalmente diferentes, e isso
   *    a imagem mostra de longe.
   *
   * Nenhuma das duas aprova nada sozinha — elas dão TAMANHO ao que a folha
   * mostra, e quem julga é quem olha (mesma regra do `qa-diff.mjs`). */
  const pares = [];
  const janela = Math.min(alturaAbertura * 2, ...cheias.map((c) => c.h));
  for (let i = 0; i < cheias.length; i++) {
    for (let j = i + 1; j < cheias.length; j++) {
      const a = cheias[i], b = cheias[j];
      const larg = Math.min(a.w, b.w);
      let soma = 0;
      for (let y = 0; y < janela; y++) {
        for (let x = 0; x < larg; x++) soma += Math.abs(a.cinza[y][x] - b.cinza[y][x]);
      }
      pares.push({
        par: `${a.variante} × ${b.variante}`,
        aberturaMedia: +(soma / (janela * larg)).toFixed(2),
        alturas: `${Math.round(a.h / 2)} / ${Math.round(b.h / 2)}`,
      });
    }
  }
  pares.sort((x, y) => x.aberturaMedia - y.aberturaMedia);
  relatorio.drasticidade = { folha, silhueta, pares, heros };
  await ctxImg.close();

  await fs.writeFile(path.join(saida, "relatorio.json"), JSON.stringify(relatorio, null, 2));
  console.log("\n── título no celular (390px) ───────────────────────────");
  for (const t of relatorio.titulo) {
    console.log(`  ${t.variante.padEnd(9)} ${t.linhas} linha(s) · corpo ${t.corpo}px · caixa ${t.caixa?.w}×${t.caixa?.h}`);
  }
  console.log("\n── slots não desenhados (declarados em imagensOcultas) ──");
  for (const s of relatorio.slots.filter((s) => !s.desenhado)) {
    console.log(`  ${s.variante} @${s.tela}  ${s.slot}  declarado=${s.declarado}`);
  }
  console.log("\n── drasticidade ────────────────────────────────────────");
  console.log("   diferença média em CINZA nas três primeiras telas (região correspondente):");
  for (const p of pares) {
    console.log(`  ${p.par.padEnd(24)} ${String(p.aberturaMedia).padStart(6)}   alturas ${p.alturas}px`);
  }
  console.log("\n── nome no print da âncora hero (contraste na caixa do título) ──");
  for (const h of heros) {
    console.log(`  ${h.variante.padEnd(9)} amplitude ${String(h.amplitude).padStart(3)}  (p05 ${h.p05} · p95 ${h.p95})`);
  }
  console.log(`\n  folha (abertura): ${path.relative(process.cwd(), folha)}`);
  console.log(`  folha (silhueta): ${path.relative(process.cwd(), silhueta)}`);
  for (const h of heros) console.log(`  hero:  ${path.relative(process.cwd(), h.arquivo)}`);

  if (falhas.length > 0) {
    console.error(`\nREPROVADO — ${falhas.length} problema(s):`);
    for (const f of falhas) console.error("  · " + f);
    if (!semPortao) process.exitCode = 1;
  } else {
    console.log("\nContrato, caixas e título: OK nas quatro variantes, nas duas telas.");
  }
} finally {
  await browser.close();
  app.encerrar();
}
