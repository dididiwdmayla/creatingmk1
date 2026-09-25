#!/usr/bin/env node
/**
 * Laço da `tatuagem-pigmento-vivo` — o que só o NAVEGADOR prova, nas
 * QUATRO variantes (docs/plano-tatuagem-pigmento-vivo.md §16, itens 29 e
 * 31). Molde de `qa-multimarcas.mjs`.
 *
 * `pigmento-contrato.test.tsx` (JSDOM) já prova o contrato no HTML DO
 * SERVIDOR sem JavaScript. Este laço prova o que só o navegador enxerga:
 *
 *  1. **Os 8 slots do portfólio são MEDIDOS** (largura/altura no DOM real,
 *     com JavaScript desligado): `imagensOcultas` está vazio nas quatro
 *     (§11) — aqui isso vira medição, não só ausência no código-fonte.
 *  2. **O aferidor de caixa zerada** (§12): com lead sem nenhum dado de
 *     identidade, `.pv-contato[data-sem-dados="true"]` e nenhum rótulo
 *     órfão.
 *  3. **A linha de apoio** com título salvo, VISÍVEL (estilo computado).
 *  4. **O PORTÃO DE CINZA** (§10 e §17 D5): página inteira das quatro no
 *     celular, escala de cinza, folha lado a lado — salva em
 *     `qa-shots/pigmento/_folha-cinza.png` e copiada para
 *     `docs/qa/pigmento-cinza-folha-v1.png` (o Will abre e olha).
 *
 * Uso:
 *   node scripts/qa-pigmento.mjs                # tudo
 *   node scripts/qa-pigmento.mjs --so=cinza      # só o portão de cinza
 *   node scripts/qa-pigmento.mjs --sem-build     # reusa o .next já buildado
 *   node scripts/qa-pigmento.mjs --sem-portao    # mede e reporta, não reprova
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";

import { IMAGENS_OCULTAS_POR_VARIANTE, VARIANTES_POR_SKIN } from "../src/lib/demos/capturas/variantes.mjs";
import { paraCinza } from "./cinza.mjs";
import { CHROMIUM, RAIZ, SAIDA, subirServidor } from "./qa-servidor.mjs";

const SKIN = "tatuagem-pigmento-vivo";
const VARIANTES = VARIANTES_POR_SKIN[SKIN];
const OCULTAS = IMAGENS_OCULTAS_POR_VARIANTE[SKIN] ?? {};
const NOME = "Estúdio Contrato Real";
const TITULO_SALVO = "Cor viva, traço autoral";
const SECOES = [
  "hero", "manifesto", "estilos", "investimento", "portfolio", "artistas",
  "depoimentos", "processo", "faq", "agendar", "contato",
];
const SLOTS = Array.from({ length: 8 }, (_, i) => `portfolio-${i + 1}`);
/** Celular primeiro: é a tela do portão e a que o lead abre. */
const TELAS = [
  { id: "390", width: 390, height: 844 },
  { id: "1100", width: 1100, height: 800 },
];

const args = process.argv.slice(2);
const semPortao = args.includes("--sem-portao");
const alvo = args.find((a) => a.startsWith("--so="))?.split("=")[1]?.split(",") ?? null;
const querido = (id) => !alvo || alvo.includes(id);
const saida = path.join(SAIDA, "pigmento");
await fs.mkdir(saida, { recursive: true });

/**
 * Página inteira, em ladrilhos, por CANVAS no próprio navegador — não
 * `page.screenshot({ fullPage: true })`. A `tatuagem-pigmento-vivo` é a
 * primeira skin do repo alta o bastante (~15000px, onze seções com fotos
 * de portfólio e depoimentos) para cruzar o limite de textura do
 * SwiftShader (renderização por software, sem GPU — mesmos flags de
 * `qa-multimarcas.mjs`): acima dele, a captura de página inteira do
 * Playwright sai com um pedaço da página REPETIDO (visto e confirmado
 * numa rodada manual: hero+manifesto reaparecem no meio do portfólio,
 * bem perto dos 8192px clássicos de teto de textura). Ladrilhos do
 * tamanho do VIEWPORT nunca chegam perto desse teto.
 *
 * O Nav (`header.fixed`) fica ESCONDIDO durante os ladrilhos: fixo à
 * viewport, ele sai pintado no topo de CADA ladrilho — sem escondê-lo, a
 * folha ganha uma faixa "Estúdio Contrato Real" repetida a cada 844px,
 * um artefato do método de captura, não da composição.
 */
async function capturaPaginaInteira(pagina, larguraCss) {
  const alturaViewport = (await pagina.viewportSize()).height;
  const alturaTotal = await pagina.evaluate(() => document.documentElement.scrollHeight);
  await pagina.addStyleTag({ content: "header.fixed { visibility: hidden !important; }" });
  const ladrilhos = [];
  let y = 0;
  while (true) {
    await pagina.evaluate((yy) => window.scrollTo(0, yy), y);
    await pagina.waitForTimeout(60);
    const yReal = await pagina.evaluate(() => window.scrollY);
    const buf = await pagina.screenshot();
    ladrilhos.push({ y: yReal, base64: buf.toString("base64") });
    if (yReal + alturaViewport >= alturaTotal) break;
    y += alturaViewport;
  }
  await pagina.evaluate(() => window.scrollTo(0, 0));

  const dataUrl = await pagina.evaluate(
    async ({ ladrilhos, larguraCss, alturaTotal }) => {
      const canvas = document.createElement("canvas");
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(larguraCss * dpr);
      canvas.height = Math.round(alturaTotal * dpr);
      const ctx = canvas.getContext("2d");
      for (const t of ladrilhos) {
        const img = await new Promise((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = "data:image/png;base64," + t.base64;
        });
        ctx.drawImage(img, 0, Math.round(t.y * dpr));
      }
      return canvas.toDataURL("image/png");
    },
    { ladrilhos, larguraCss, alturaTotal },
  );
  return { base64: dataUrl.split(",")[1], w: larguraCss, h: alturaTotal };
}

const url = (preset, extra = "") =>
  `${app.base}/interno/demo-qa?skin=${SKIN}&preset=${preset}&avulsa=1` +
  `&nome=${encodeURIComponent(NOME)}&efeito=nenhum&intro=0${extra}`;

const app = await subirServidor({ build: !args.includes("--sem-build") });
const browser = await chromium.launch({
  executablePath: CHROMIUM,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const relatorio = { contrato: [], slots: [], identidade: [], apoio: [], cinza: null, cls: [] };
const falhas = [];

try {
  if (querido("contrato") || querido("slots") || querido("identidade")) {
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
            const caixaEVisivel = (el) => {
              if (!el) return { caixa: null, visivel: false };
              const b = el.getBoundingClientRect();
              const cs = getComputedStyle(el);
              const visivel = cs.opacity !== "0" && cs.visibility !== "hidden" && cs.display !== "none" && b.width > 0 && b.height > 0;
              return { caixa: { w: Math.round(b.width), h: Math.round(b.height) }, visivel };
            };
            const hero = document.querySelector('[data-d-secao="hero"]');
            const h1 = hero?.querySelector("h1");
            const h1Info = caixaEVisivel(h1);
            const fantasma = document.querySelector(".pv-hero-fantasma");
            return {
              h1s: document.querySelectorAll("h1").length,
              nome: (h1?.textContent ?? "").replace(/\s+/g, " ").trim(),
              h1NaAbertura: Boolean(h1),
              h1Caixa: h1Info.caixa,
              h1Visivel: h1Info.visivel,
              fantasmaEhH1: fantasma?.tagName === "H1",
              fantasmaAriaHidden: fantasma ? fantasma.getAttribute("aria-hidden") === "true" : true,
              secoes: [...document.querySelectorAll("[data-d-secao]")].map((e) => e.getAttribute("data-d-secao")),
              transborda: document.documentElement.scrollWidth > window.innerWidth,
              slots: Object.fromEntries(
                slots.map((s) => [s, caixaEVisivel(document.querySelector(`[data-demo-slot="imagens.${s}"]`)).caixa]),
              ),
              // §12 — aferidor de caixa zerada: com zero linhas de dado, o
              // rodapé (`.pv-contato`) não pode desenhar bloco de dados oco.
              contatoSemDados: document.querySelector(".pv-contato")?.getAttribute("data-sem-dados") === "true",
              rotuloOrfaoContato: document.querySelector(".pv-contato dt, .pv-contato-dados dt") !== null,
            };
          },
          { slots: SLOTS },
        );

        const ctx0 = `${v} @${tela.id}`;
        try {
          assert.equal(medida.h1s, 1, `${ctx0}: ${medida.h1s} <h1>`);
          assert.ok(medida.h1NaAbertura, `${ctx0}: <h1> fora da âncora hero`);
          assert.equal(medida.nome, NOME, `${ctx0}: h1 "${medida.nome}"`);
          assert.ok(
            medida.h1Caixa && medida.h1Caixa.w > 0 && medida.h1Caixa.h > 0,
            `${ctx0}: caixa do <h1> vazia (${JSON.stringify(medida.h1Caixa)})`,
          );
          assert.ok(medida.h1Visivel, `${ctx0}: <h1> com caixa, mas NÃO VISÍVEL`);
          assert.equal(medida.fantasmaEhH1, false, `${ctx0}: o nome fantasma decorativo é um <h1>`);
          assert.ok(medida.fantasmaAriaHidden, `${ctx0}: o nome fantasma decorativo não é aria-hidden`);
          assert.deepEqual([...medida.secoes].sort(), [...SECOES].sort(), `${ctx0}: seções`);
          assert.equal(new Set(medida.secoes).size, medida.secoes.length, `${ctx0}: seção repetida`);
          assert.equal(medida.transborda, false, `${ctx0}: transbordo horizontal`);
          assert.equal(medida.contatoSemDados, true, `${ctx0}: .pv-contato não está marcado data-sem-dados com lead vazio`);
          assert.equal(medida.rotuloOrfaoContato, false, `${ctx0}: <dt> órfão no rodapé sem dado`);
        } catch (e) { falhas.push(e.message); }
        relatorio.contrato.push({ variante: v, tela: tela.id, ...medida, slots: undefined });

        // Item 9 — os 8 slots do portfólio: imagensOcultas está vazio nas
        // quatro (§11), então TODOS têm de desenhar (caixa > 0) nas duas telas.
        for (const slot of SLOTS) {
          const c = medida.slots[slot];
          const declarado = Boolean(OCULTAS[v]?.[slot]);
          const desenhado = Boolean(c && c.w > 0 && c.h > 0);
          relatorio.slots.push({ variante: v, tela: tela.id, slot, declarado, desenhado, caixa: c });
          try {
            assert.equal(desenhado, !declarado,
              declarado
                ? `${ctx0}: slot "${slot}" está declarado em imagensOcultas mas DESENHA (${c?.w}×${c?.h})`
                : `${ctx0}: slot "${slot}" NÃO desenha (imagensOcultas vazio para "${v}" — devia desenhar)`);
          } catch (e) { falhas.push(e.message); }
        }

        if (tela.id === TELAS[0].id) {
          relatorio.identidade.push({ variante: v, semDados: medida.contatoSemDados });

          // A linha de apoio, com título salvo, VISÍVEL no navegador.
          await page.goto(url(v, `&titulo=${encodeURIComponent(TITULO_SALVO)}`), { waitUntil: "networkidle" });
          const apoio = await page.evaluate(() => {
            const caixaEVisivel = (el) => {
              if (!el) return { caixa: null, visivel: false };
              const b = el.getBoundingClientRect();
              const cs = getComputedStyle(el);
              const visivel = cs.opacity !== "0" && cs.visibility !== "hidden" && cs.display !== "none" && b.width > 0 && b.height > 0;
              return { caixa: { w: Math.round(b.width), h: Math.round(b.height) }, visivel };
            };
            const el = document.querySelector('[data-demo-slot="secoes.hero.titulo"]');
            const h1 = document.querySelector('[data-d-secao="hero"] h1');
            return {
              ...caixaEVisivel(el),
              texto: (el?.textContent ?? "").trim(),
              nomeNoH1: (h1?.textContent ?? "").replace(/\s+/g, " ").trim(),
            };
          });
          relatorio.apoio.push({ variante: v, ...apoio });
          try {
            assert.equal(apoio.nomeNoH1, NOME, `${v}: com título salvo, o <h1> "${apoio.nomeNoH1}" não é mais o nome`);
            assert.ok(apoio.caixa && apoio.caixa.w > 0 && apoio.caixa.h > 0, `${v}: linha de apoio sem caixa`);
            assert.ok(apoio.visivel, `${v}: linha de apoio com caixa, mas NÃO VISÍVEL`);
            assert.equal(apoio.texto, TITULO_SALVO, `${v}: linha de apoio "${apoio.texto}"`);
          } catch (e) { falhas.push(e.message); }
        }
      }
    }
    await ctx.close();
  }

  /* ── PORTÃO DE CINZA (§10, item 31) ──────────────────────────────── */
  if (querido("cinza")) {
    const ctxImg = await browser.newContext({
      viewport: { width: TELAS[0].width, height: TELAS[0].height },
      deviceScaleFactor: 1, // DPR 1 pras folhas — o §10 reserva DPR 2 só pro fps.
    });
    await ctxImg.addCookies([app.cookie]);
    const pagina = await ctxImg.newPage();
    const cheias = [];
    for (const v of VARIANTES) {
      await pagina.goto(url(v), { waitUntil: "networkidle" });
      await pagina.waitForTimeout(1200);
      // Rolar a página inteira até o fim e voltar — dispara o que depende
      // de interseção (entradas whileInView), senão a folha sai com metade
      // invisível.
      for (const sec of await pagina.locator("[data-d-secao]").all()) {
        await sec.scrollIntoViewIfNeeded();
        await pagina.waitForTimeout(140);
      }
      await pagina.evaluate(() => window.scrollTo(0, 0));
      await pagina.waitForTimeout(700);
      // Congela animações — manchas numa fase fixa, manifesto aceso,
      // LineDraw completo — pra duas rodadas darem o mesmo pixel.
      await pagina.evaluate(() => {
        for (const a of document.getAnimations()) a.pause();
      });
      await pagina.waitForTimeout(120);

      const cheia = path.join(saida, `pagina-${v}.png`);
      const { base64 } = await capturaPaginaInteira(pagina, TELAS[0].width);
      await fs.writeFile(cheia, Buffer.from(base64, "base64"));
      cheias.push({ variante: v, arquivo: cheia, ...paraCinza(cheia) });
    }

    for (const c of cheias) c.base64 = (await fs.readFile(c.arquivo)).toString("base64");
    const LARGURA_CSS = TELAS[0].width;
    const ALTURA_FOLHA = 2600;
    const maiorCss = Math.max(...cheias.map((c) => c.h));
    const fator = ALTURA_FOLHA / maiorCss;
    const folhaHtml =
      `<!doctype html><meta charset="utf-8">` +
      `<body style="margin:0;background:#151515;font:12px system-ui;color:#bbb">` +
      `<div style="padding:10px 12px;font:600 15px system-ui;color:#eee">` +
      `${SKIN} — as quatro variantes, página inteira, celular ${LARGURA_CSS}px, EM ESCALA DE CINZA` +
      `<div style="font-weight:400;color:#9a9a9a;margin-top:3px;font-size:12px">` +
      `Se duas custam a distinguir aqui, a variante volta para a sessão de composição. Fator ${fator.toFixed(3)}× sobre a maior (${maiorCss}px).</div></div>` +
      `<div style="display:flex;gap:10px;padding:0 12px 12px;align-items:flex-start">` +
      cheias
        .map(
          (c) => `<figure style="margin:0">
        <figcaption style="padding:3px 0">${c.variante} · página inteira ${c.h}px</figcaption>
        <img src="data:image/png;base64,${c.base64}"
             style="width:${Math.round(LARGURA_CSS * fator)}px;height:${Math.round(c.h * fator)}px;display:block;border:1px solid #3a3a3a;filter:grayscale(1)">
      </figure>`,
        )
        .join("") +
      `</div></body>`;
    await pagina.setViewportSize({ width: 1700, height: 1000 });
    await pagina.setContent(folhaHtml);
    await pagina.waitForTimeout(400);
    const folha = path.join(saida, "_folha-cinza.png");
    await pagina.screenshot({ path: folha, fullPage: true });

    // Cópia para docs/qa — é ela que entra no relatório e no commit.
    const docsQa = path.join(RAIZ, "docs", "qa");
    await fs.mkdir(docsQa, { recursive: true });
    const folhaDocs = path.join(docsQa, "pigmento-cinza-folha-v1.png");
    await fs.copyFile(folha, folhaDocs);

    // Escala do que a folha mostra — diferença média em cinza (mesma
    // janela nas quatro) + altura de cada página. Nenhuma aprova sozinha.
    const pares = [];
    const janela = Math.min(...cheias.map((c) => c.h));
    for (let i = 0; i < cheias.length; i++) {
      for (let j = i + 1; j < cheias.length; j++) {
        const a = cheias[i], b = cheias[j];
        const larg = Math.min(a.w, b.w);
        let soma = 0;
        for (let y = 0; y < janela; y++) {
          for (let x = 0; x < larg; x++) soma += Math.abs(a.cinza[y][x] - b.cinza[y][x]);
        }
        pares.push({ par: `${a.variante} × ${b.variante}`, diferencaMedia: +(soma / (janela * larg)).toFixed(2), alturas: `${a.h} / ${b.h}` });
      }
    }
    pares.sort((x, y) => x.diferencaMedia - y.diferencaMedia);
    relatorio.cinza = { folha, folhaDocs, pares, alturas: cheias.map((c) => ({ variante: c.variante, altura: c.h })) };
    await ctxImg.close();
  }

  /* ── CLS e troca de fonte, Slow 4G + cache frio (item 7) ───────────
   * Contexto NOVO por variante — cache vazio por construção (mesmo
   * princípio de `--incognito`: Playwright nunca reaproveita o cache
   * HTTP entre `browser.newContext()`). `Network.setCacheDisabled`
   * reforça: nenhuma resposta cacheada, nem por engano. Slow 4G nos
   * mesmos números do Lighthouse (RTT 150ms, 1.6Mbps down / 750kbps up)
   * — a rede em que o atraso de fonte fica visível de verdade. */
  if (querido("cls")) {
    const REDE_SLOW_4G = {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    };
    for (const v of VARIANTES) {
      const ctxCls = await browser.newContext({ viewport: { width: TELAS[0].width, height: TELAS[0].height } });
      await ctxCls.addCookies([app.cookie]);
      const p = await ctxCls.newPage();
      const cdpCls = await ctxCls.newCDPSession(p);
      await cdpCls.send("Network.enable");
      await cdpCls.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdpCls.send("Network.emulateNetworkConditions", REDE_SLOW_4G);
      await p.addInitScript(() => {
        window.__cls = { value: 0, maiores: [] };
        window.__fontesProntasEm = null;
        try {
          const po = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.hadRecentInput) continue;
              window.__cls.value += entry.value;
              window.__cls.maiores.push({
                value: entry.value,
                time: entry.startTime,
                nome: (entry.sources ?? []).some(
                  (s) => s.node && s.node.closest && s.node.closest(".pv-hero-nome, .pv-hero-nome-caixa"),
                ),
              });
            }
          });
          po.observe({ type: "layout-shift", buffered: true });
        } catch {
          /* navegador sem suporte — __cls fica em 0. */
        }
        if (document.fonts) {
          document.fonts.ready.then(() => {
            window.__fontesProntasEm = performance.now();
          });
        }
      });

      const t0 = Date.now();
      await p.goto(url(v), { waitUntil: "load", timeout: 60000 });
      const tCarregouMs = Date.now() - t0;
      await p.waitForTimeout(1500);
      const cls = await p.evaluate(() => window.__cls);
      const fontesProntasEmMs = await p.evaluate(() => window.__fontesProntasEm);
      const deslocamentoDoNome = cls.maiores.filter((m) => m.nome && m.value > 0);
      relatorio.cls.push({
        variante: v,
        cls: +cls.value.toFixed(4),
        maiores: cls.maiores.slice(0, 3).map((m) => ({ value: +m.value.toFixed(4), time: Math.round(m.time), nome: m.nome })),
        tCarregouMs,
        fontesProntasEmMs: fontesProntasEmMs === null ? null : Math.round(fontesProntasEmMs),
        deslocamentoDoNomeAoTrocarFonte: deslocamentoDoNome.length > 0,
      });
      try {
        assert.ok(cls.value < 0.1, `${v}: CLS ${cls.value.toFixed(4)} ≥ 0.1 sob Slow 4G + cache frio`);
      } catch (e) { falhas.push(e.message); }
      await ctxCls.close();
    }
  }

  await fs.writeFile(path.join(saida, "relatorio.json"), JSON.stringify(relatorio, null, 2));

  if (relatorio.slots.length > 0) {
    console.log("\n── item 9: slots do portfólio (imagensOcultas vazio nas quatro) ──");
    const naoDesenhados = relatorio.slots.filter((s) => !s.desenhado);
    console.log(`  ${relatorio.slots.length} medições, ${naoDesenhados.length} não-desenhadas (esperado: 0)`);
  }
  if (relatorio.identidade.length > 0) {
    console.log("\n── item 12: rodapé sem dado, .pv-contato[data-sem-dados] ──");
    for (const i of relatorio.identidade) console.log(`  ${i.variante.padEnd(11)} semDados=${i.semDados}`);
  }
  if (relatorio.apoio.length > 0) {
    console.log("\n── linha de apoio, visível no navegador, com título salvo ──");
    for (const a of relatorio.apoio) console.log(`  ${a.variante.padEnd(11)} caixa=${JSON.stringify(a.caixa)} visivel=${a.visivel} texto="${a.texto}"`);
  }
  if (relatorio.cinza) {
    console.log("\n── portão de cinza ──");
    console.log("   diferença média em CINZA, página inteira (mesma janela):");
    for (const p of relatorio.cinza.pares) console.log(`  ${p.par.padEnd(28)} ${String(p.diferencaMedia).padStart(6)}   alturas ${p.alturas}px`);
    console.log(`\n  folha: ${path.relative(process.cwd(), relatorio.cinza.folha)}`);
    console.log(`  docs:  ${path.relative(process.cwd(), relatorio.cinza.folhaDocs)}`);
  }
  if (relatorio.cls.length > 0) {
    console.log("\n── item 7: CLS sob Slow 4G + cache frio ──");
    for (const c of relatorio.cls) {
      console.log(
        `  ${c.variante.padEnd(11)} CLS=${c.cls.toFixed(4).padStart(7)}  carregou em ${c.tCarregouMs}ms` +
          `  fontes prontas em ${c.fontesProntasEmMs}ms  nome deslocou ao trocar fonte=${c.deslocamentoDoNomeAoTrocarFonte}`,
      );
    }
  }

  if (falhas.length > 0) {
    console.error(`\nREPROVADO — ${falhas.length} problema(s):`);
    for (const f of falhas) console.error("  · " + f);
    if (!semPortao) process.exitCode = 1;
  } else {
    console.log("\nContrato, slots, identidade, linha de apoio e portão de cinza: OK nas quatro variantes.");
  }
} finally {
  await browser.close();
  app.encerrar();
}
