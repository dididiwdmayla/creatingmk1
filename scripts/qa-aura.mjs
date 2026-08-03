#!/usr/bin/env node
/**
 * DIAGNÓSTICO da `aura` no celular — o laço que responde ao relato "trava e
 * os elementos da página ficam brancos e voltam ao normal, pior nos modos
 * iridescente e arco-íris".
 *
 * Ele NÃO é o portão de qualidade (esse é `qa-visual.mjs --so=fps`, que
 * mede a tabela inteira do registro). Este script existe pra ATRIBUIR: mede
 * a mesma coisa de cinco jeitos diferentes na mesma página, e cada bloco
 * responde a uma pergunta que a tabela de fps sozinha não responde.
 *
 * Condição comum a todos os blocos de custo: viewport 390×844 com
 * `deviceScaleFactor: 2`, CPU limitada em 4× via CDP, intensidade 3, LED
 * desligado — a mesma do portão, pra os números serem comparáveis.
 *
 *   1. `fps ROLANDO a página inteira`, por modo de cor. A tabela do portão
 *      mede a página PARADA; a aura no celular tem o alvo dos blobs preso
 *      ao progresso de scroll (ver aura/alvo.ts), então parada ela nem
 *      exercita o caminho que o relato descreve. Aqui a página é percorrida
 *      de cima a baixo a velocidade constante dentro da janela de medição, e
 *      além do fps sai o PIOR QUADRO e a contagem de quadros acima de 50ms —
 *      "trava" é quadro longo, não média baixa.
 *   2. `atribuição` — na MESMA página já carregada, desliga uma coisa de
 *      cada vez (o `mix-blend-mode` dos blobs, a animação de cor, os blobs
 *      inteiros) e remede. É o método que já achou o `filter` do gradiente.
 *   3. `compositing` — conta os eventos `LayerTree.layerPainted` por segundo
 *      durante a rolagem. É a pergunta da "regra de superfície" respondida
 *      com número em vez de leitura de código: o navegador REPINTA a
 *      superfície a cada quadro, ou só recompõe uma camada já rasterizada?
 *   4. `hipótese (b)` — o estilo COMPUTADO dos dois blobs no navegador real
 *      (`filter`, `mix-blend-mode`, `will-change`) e a prova de que o
 *      `transform` muda a cada quadro. Confirma ou descarta "as esferas
 *      desfocadas voltaram a animar transformação junto com o desfoque".
 *   5. `estouro em branco` — o ciclo de cor congelado em 12 fases, captura
 *      por fase, e a fração de pixels QUASE BRANCOS de cada uma contra a
 *      referência sem efeito. É a hipótese (a) medida na tela, não no
 *      raciocínio. Este bloco roda SEM CPU limitada (é medição de cor, não
 *      de custo) e nos dois presets, claro e escuro.
 *
 * Uso:
 *   node scripts/qa-aura.mjs                 # tudo
 *   node scripts/qa-aura.mjs --sem-build     # reusa o .next já buildado
 *   node scripts/qa-aura.mjs --so=fps,branco
 *   QA_AURA_CARGAS=3 node scripts/qa-aura.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";

import { decodificarPng, lerPng } from "./png.mjs";
import { CHROMIUM, SAIDA, subirServidor } from "./qa-servidor.mjs";

const args = process.argv.slice(2);
const opcao = (nome) => args.find((a) => a.startsWith(`--${nome}=`))?.split("=").slice(1).join("=");
const temFlag = (nome) => args.includes(`--${nome}`);
const filtro = opcao("so")?.split(",").map((s) => s.trim()).filter(Boolean);
const querido = (id) => !filtro || filtro.includes(id);

const VIEWPORT = { width: 390, height: 844 };
const CPU = 4;
const CARGAS = Number(process.env.QA_AURA_CARGAS ?? 5);
const EFEITO = process.env.QA_AURA_EFEITO ?? "aura";
const INTENSIDADE = 3;
/** px/s da rolagem contínua — fling de celular, não arrasto lento. */
const VELOCIDADE = 1800;
/** Teto da janela de medição: página inteira ou este tempo, o que vier antes. */
const JANELA_MAX_MS = 9000;
const SKIN = "barbearia-editorial";
const MODOS = [
  { id: "tema" },
  { id: "fixa", cores: ["#00c2ff"] },
  { id: "transicao", cores: ["#ff2e88", "#22d3a5", "#ffd23f"] },
  { id: "iridescente" },
  { id: "arco-iris" },
];
/** Fases do ciclo de cor amostradas no bloco 5. */
const FASES = Array.from({ length: 12 }, (_, i) => i / 12);
const PRESETS = [
  { id: "norte", rotulo: "escuro" },
  { id: "creme", rotulo: "claro" },
];

let BASE = "";
function url({ efeito = EFEITO, intensidade = INTENSIDADE, preset = "norte", modo }) {
  const q = new URLSearchParams({ skin: SKIN, preset, intro: "0", led: "desligado" });
  q.set("efeito", efeito);
  q.set("intensidade", String(intensidade));
  if (modo && modo.id !== "tema") {
    q.set("corModo", modo.id);
    if (modo.cores) q.set("cores", modo.cores.join(","));
  }
  return `${BASE}/interno/demo-qa?${q}`;
}

/** Espera a camada do efeito existir no DOM (entra por next/dynamic, sem SSR). */
async function esperarEfeito(page, efeito) {
  if (efeito === "nenhum") return;
  await page.waitForSelector("[data-d-efeito-camada] > div", { timeout: 15000 });
  await page.waitForTimeout(600);
}

/**
 * fps ao percorrer a página inteira de cima a baixo, a velocidade constante.
 * Devolve também o pior quadro e quantos quadros passaram de 50ms — a
 * "trava" que o relato descreve é quadro longo, e a média esconde isso.
 */
function medirRolando(page) {
  return page.evaluate(
    ({ velocidade, maxMs }) =>
      new Promise((resolve) => {
        window.scrollTo(0, 0);
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        let quadros = 0;
        let piorMs = 0;
        let longos = 0;
        let y = 0;
        let inicio = 0;
        let ultimo = 0;
        const passo = (t) => {
          if (inicio === 0) {
            // Primeiro quadro só ancora o relógio: o dt até ele inclui o
            // agendamento do rAF e não é um quadro de animação.
            inicio = ultimo = t;
            requestAnimationFrame(passo);
            return;
          }
          const dt = t - ultimo;
          ultimo = t;
          quadros++;
          if (dt > piorMs) piorMs = dt;
          if (dt > 50) longos++;
          y += (velocidade * dt) / 1000;
          window.scrollTo(0, Math.min(max, y));
          const decorrido = t - inicio;
          if (y < max && decorrido < maxMs) requestAnimationFrame(passo);
          else
            resolve({
              fps: (quadros * 1000) / decorrido,
              decorrido,
              percorrido: Math.min(max, y),
              alturaRolavel: max,
              piorMs,
              longos,
            });
        };
        requestAnimationFrame(passo);
      }),
    { velocidade: VELOCIDADE, maxMs: JANELA_MAX_MS },
  );
}

const mediana = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/* ────────────────────────────────────────────────────────────────────── */

async function blocoFps(page, linhas) {
  console.log(`\n== 1. fps ROLANDO a página inteira (${EFEITO}, i${INTENSIDADE}, celular, CPU ${CPU}×) ==`);
  for (const alvo of [{ efeito: "nenhum", modo: { id: "arco-iris" } }, ...MODOS.map((m) => ({ efeito: EFEITO, modo: m }))]) {
    const medidas = [];
    let ultima;
    for (let carga = 0; carga < CARGAS; carga++) {
      await page.goto(url({ efeito: alvo.efeito, modo: alvo.modo }), { waitUntil: "networkidle" });
      await esperarEfeito(page, alvo.efeito);
      ultima = await medirRolando(page);
      medidas.push(ultima.fps);
    }
    const linha = {
      alvo: alvo.efeito === "nenhum" ? "nenhum (referência)" : `${EFEITO} · ${alvo.modo.id}`,
      fps: mediana(medidas),
      medidas,
      piorMs: ultima.piorMs,
      longos: ultima.longos,
      percorrido: ultima.percorrido,
      alturaRolavel: ultima.alturaRolavel,
      decorrido: ultima.decorrido,
    };
    linhas.push(linha);
    console.log(
      `  ${linha.alvo.padEnd(24)} mediana ${linha.fps.toFixed(1).padStart(5)} fps  ` +
        `(cargas ${medidas.map((m) => m.toFixed(1)).join(" / ")})  ` +
        `pior quadro ${linha.piorMs.toFixed(0)}ms · ${linha.longos} quadros >50ms · ` +
        `${Math.round(linha.percorrido)}/${Math.round(linha.alturaRolavel)}px em ${Math.round(linha.decorrido)}ms`,
    );
  }
}

/**
 * Desliga uma coisa de cada vez NA PÁGINA JÁ CARREGADA e remede. Cada
 * variante é uma mutação de estilo no DOM, revertida antes da próxima.
 */
const VARIANTES = [
  { id: "como está", aplica: () => {} },
  {
    id: "sem mix-blend-mode",
    aplica: () => {
      for (const b of document.querySelectorAll("[data-d-efeito-camada] > div, [data-d-efeito-camada] > div > *"))
        b.style.mixBlendMode = "normal";
    },
  },
  {
    id: "cor congelada",
    aplica: () => {
      for (const a of document.getAnimations())
        if (String(a.animationName ?? "").startsWith("d-cores-")) a.pause();
    },
  },
  {
    id: "sem blend + cor congelada",
    aplica: () => {
      for (const b of document.querySelectorAll("[data-d-efeito-camada] > div, [data-d-efeito-camada] > div > *"))
        b.style.mixBlendMode = "normal";
      for (const a of document.getAnimations())
        if (String(a.animationName ?? "").startsWith("d-cores-")) a.pause();
    },
  },
  {
    id: "blobs escondidos",
    aplica: () => {
      for (const b of document.querySelectorAll("[data-d-efeito-camada] > div, [data-d-efeito-camada] > div > *"))
        b.style.display = "none";
    },
  },
];

async function blocoAtribuicao(ctx, page, linhas, modoId = process.env.QA_AURA_MODO ?? "arco-iris") {
  const modo = MODOS.find((m) => m.id === modoId) ?? { id: modoId };
  console.log(`\n== 2. atribuição (${EFEITO} · ${modoId}, uma coisa de cada vez, rolando) ==`);
  const cdp = await ctx.newCDPSession(page);
  for (const variante of VARIANTES) {
    const medidas = [];
    const areas = [];
    for (let carga = 0; carga < CARGAS; carga++) {
      await page.goto(url({ modo }), { waitUntil: "networkidle" });
      await esperarEfeito(page, EFEITO);
      await page.evaluate(variante.aplica);
      await page.waitForTimeout(150);
      // A SUPERFÍCIE REPINTADA entra aqui junto do fps porque, nesta
      // máquina, ela é a única das duas que enxerga custo de rasterização:
      // setCPUThrottlingRate limita só a thread principal (ver
      // ARCHITECTURE.md, "O portão de qualidade do registro"). Uma variante
      // pode não mexer um fps e derrubar a repintura pela metade — foi
      // assim que o defeito da aura foi atribuído.
      let area = 0;
      const onPintou = (e) => {
        if (e.clip) area += e.clip.width * e.clip.height;
      };
      cdp.on("LayerTree.layerPainted", onPintou);
      await cdp.send("LayerTree.enable");
      const medida = await medirRolando(page);
      await cdp.send("LayerTree.disable");
      cdp.off("LayerTree.layerPainted", onPintou);
      medidas.push(medida.fps);
      areas.push(area / 1e6 / (medida.decorrido / 1000));
    }
    linhas.push({
      variante: variante.id,
      fps: mediana(medidas),
      mpxs: mediana(areas),
      medidas,
    });
    console.log(
      `  ${variante.id.padEnd(26)} mediana ${mediana(medidas).toFixed(1).padStart(5)} fps ` +
        `(${medidas.map((m) => m.toFixed(1)).join(" / ")}) · ` +
        `${mediana(areas).toFixed(1).padStart(6)} Mpx/s repintados`,
    );
  }
}

/**
 * Quantas vezes o navegador PINTA (não compõe) por segundo durante a
 * rolagem, e o inventário de camadas compositadas. `LayerTree.layerPainted`
 * é o evento que a "regra de superfície" descreve em prosa.
 */
async function blocoCompositing(ctx, page, linhas) {
  console.log(`\n== 3. compositing — pinturas por segundo durante a rolagem ==`);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Performance.enable");
  for (const alvo of [
    { rotulo: "nenhum", efeito: "nenhum", modo: { id: "arco-iris" }, variante: null },
    { rotulo: `${EFEITO} · tema`, efeito: EFEITO, modo: { id: "tema" }, variante: null },
    { rotulo: `${EFEITO} · arco-iris`, efeito: EFEITO, modo: { id: "arco-iris" }, variante: null },
    {
      rotulo: `${EFEITO} · arco-iris, sem blend`,
      efeito: EFEITO,
      modo: { id: "arco-iris" },
      variante: VARIANTES[1].aplica,
    },
  ]) {
    await page.goto(url({ efeito: alvo.efeito, modo: alvo.modo }), { waitUntil: "networkidle" });
    await esperarEfeito(page, alvo.efeito);
    if (alvo.variante) await page.evaluate(alvo.variante);

    let pinturas = 0;
    let camadas = [];
    const onPintou = () => pinturas++;
    const onArvore = ({ layers }) => {
      if (layers) camadas = layers;
    };
    cdp.on("LayerTree.layerPainted", onPintou);
    cdp.on("LayerTree.layerTreeDidChange", onArvore);
    await cdp.send("LayerTree.enable");
    const antes = await cdp.send("Performance.getMetrics");
    const medida = await medirRolando(page);
    const depois = await cdp.send("Performance.getMetrics");
    await cdp.send("LayerTree.disable");
    cdp.off("LayerTree.layerPainted", onPintou);
    cdp.off("LayerTree.layerTreeDidChange", onArvore);

    const m = (nome) => {
      const a = antes.metrics.find((x) => x.name === nome)?.value ?? 0;
      const b = depois.metrics.find((x) => x.name === nome)?.value ?? 0;
      return b - a;
    };
    const segundos = medida.decorrido / 1000;
    const linha = {
      rotulo: alvo.rotulo,
      fps: medida.fps,
      pinturasPorSegundo: pinturas / segundos,
      pinturasPorQuadro: pinturas / ((medida.fps * medida.decorrido) / 1000),
      camadas: camadas.length,
      areaCamadasMpx: camadas.reduce((s, c) => s + (c.width * c.height) / 1e6, 0),
      recalcMs: m("RecalcStyleDuration") * 1000,
      layoutMs: m("LayoutDuration") * 1000,
      scriptMs: m("ScriptDuration") * 1000,
      tarefaMs: m("TaskDuration") * 1000,
      segundos,
    };
    linhas.push(linha);
    console.log(
      `  ${linha.rotulo.padEnd(28)} ${linha.fps.toFixed(1).padStart(5)} fps · ` +
        `${linha.pinturasPorSegundo.toFixed(1).padStart(6)} pinturas/s (${linha.pinturasPorQuadro.toFixed(2)}/quadro) · ` +
        `${linha.camadas} camadas / ${linha.areaCamadasMpx.toFixed(1)} Mpx · ` +
        `recalc ${linha.recalcMs.toFixed(0)}ms layout ${linha.layoutMs.toFixed(0)}ms script ${linha.scriptMs.toFixed(0)}ms ` +
        `de ${(linha.segundos * 1000).toFixed(0)}ms`,
    );
  }
}

/** Estilo COMPUTADO dos blobs no navegador real + o transform mudando por quadro. */
async function blocoHipoteseB(page, saida) {
  console.log(`\n== 4. hipótese (b): desfoque + transformação nos blobs ==`);
  await page.goto(url({ modo: MODOS[4] }), { waitUntil: "networkidle" });
  await esperarEfeito(page, EFEITO);
  const dados = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const blobs = [...document.querySelectorAll("[data-d-efeito-camada] > div, [data-d-efeito-camada] > div > *")];
        const estilo = blobs.map((b) => {
          const cs = getComputedStyle(b);
          return {
            filter: cs.filter,
            backdropFilter: cs.backdropFilter,
            mixBlendMode: cs.mixBlendMode,
            willChange: cs.willChange,
            opacity: cs.opacity,
            tamanho: `${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`,
            areaViewports: (
              (b.getBoundingClientRect().width * b.getBoundingClientRect().height) /
              (innerWidth * innerHeight)
            ).toFixed(2),
            fundo: cs.backgroundImage.slice(0, 90) + "…",
          };
        });
        // O transform muda a cada quadro? Amostra 30 quadros seguidos
        // rolando, e conta quantos são diferentes do anterior.
        const vistos = [];
        let n = 0;
        const passo = () => {
          window.scrollBy(0, 30);
          vistos.push(blobs.map((b) => getComputedStyle(b).transform).join("|"));
          if (++n < 30) requestAnimationFrame(passo);
          else {
            let mudou = 0;
            for (let i = 1; i < vistos.length; i++) if (vistos[i] !== vistos[i - 1]) mudou++;
            resolve({ estilo, quadros: vistos.length, transformMudou: mudou, amostra: vistos.slice(0, 3) });
          }
        };
        requestAnimationFrame(passo);
      }),
  );
  for (const [i, e] of dados.estilo.entries()) {
    console.log(
      `  blob ${i + 1}: filter=${e.filter} · backdrop-filter=${e.backdropFilter} · blend=${e.mixBlendMode} · ` +
        `will-change=${e.willChange} · opacity=${e.opacity} · ${e.tamanho}px (${e.areaViewports}× a viewport)`,
    );
  }
  console.log(`  transform mudou em ${dados.transformMudou}/${dados.quadros - 1} quadros consecutivos`);
  await fs.writeFile(path.join(SAIDA, "_aura-hipotese-b.json"), JSON.stringify(dados, null, 2));
  saida.push(dados);
  return dados;
}

/** Luminância relativa (WCAG) de um "rgb(r, g, b)" computado. */
function luminancia(r, g, b) {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function estatisticaPng(arquivo) {
  return estatistica(lerPng(arquivo));
}

function estatistica({ w, h, canais, px }) {
  const n = w * h;
  let brancos = 0;
  let quase = 0;
  let soma = 0;
  let soma2 = 0;
  for (let p = 0; p < n; p++) {
    const r = px[p * canais], g = px[p * canais + 1], b = px[p * canais + 2];
    if (r >= 245 && g >= 245 && b >= 245) brancos++;
    const l = luminancia(r, g, b);
    if (l >= 0.8) quase++;
    soma += l;
    soma2 += l * l;
  }
  const media = soma / n;
  return {
    brancosPct: (brancos / n) * 100,
    quasePct: (quase / n) * 100,
    lumMedia: media,
    lumDesvio: Math.sqrt(Math.max(0, soma2 / n - media * media)),
  };
}

/**
 * Estouro em branco por FASE do ciclo de cor. Sem CPU limitada: é medição
 * de cor na tela, não de custo. A posição de scroll é a mesma em todas as
 * capturas (a região de texto do meio da página), pra a única variável ser
 * a cor da camada.
 */
async function blocoBranco(browser, cookie, linhas) {
  console.log(`\n== 5. estouro em branco por fase do ciclo de cor ==`);
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "no-preference",
  });
  await ctx.addCookies([cookie]);
  const page = await ctx.newPage();

  for (const preset of PRESETS) {
    // Referência: a MESMA posição de scroll sem efeito nenhum.
    await page.goto(url({ efeito: "nenhum", preset: preset.id, modo: { id: "tema" } }), { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await page.evaluate(() =>
      window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * 0.35),
    );
    await page.waitForTimeout(400);
    const refPng = path.join(SAIDA, `aura-branco-${preset.rotulo}-referencia.png`);
    await page.screenshot({ path: refPng });
    const ref = estatisticaPng(refPng);
    console.log(
      `  [${preset.rotulo}] sem efeito: brancos ${ref.brancosPct.toFixed(2)}% · ` +
        `quase-brancos ${ref.quasePct.toFixed(2)}% · luminância média ${ref.lumMedia.toFixed(3)}`,
    );
    linhas.push({ preset: preset.rotulo, modo: "— (sem efeito)", fase: "—", ...ref, picoL: null });

    for (const modo of MODOS) {
      await page.goto(url({ preset: preset.id, modo }), { waitUntil: "networkidle" });
      await esperarEfeito(page, EFEITO);
      await page.evaluate(() =>
        window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * 0.35),
      );
      await page.waitForTimeout(400);

      const fases = modo.id === "tema" || modo.id === "fixa" ? [0] : FASES;
      const porFase = [];
      for (const fase of fases) {
        const cores = await page.evaluate((f) => {
          for (const anim of document.getAnimations()) {
            if (!String(anim.animationName ?? "").startsWith("d-cores-")) continue;
            const ciclo = anim.effect?.getComputedTiming?.().duration;
            if (typeof ciclo !== "number" || !Number.isFinite(ciclo) || ciclo <= 0) continue;
            anim.pause();
            anim.currentTime = ciclo * f;
          }
          const camada = document.querySelector("[data-d-efeito-camada]");
          const cs = getComputedStyle(camada);
          const blobs = [...document.querySelectorAll("[data-d-efeito-camada] > div, [data-d-efeito-camada] > div > *")];
          return {
            props: [1, 2, 3].map((i) => cs.getPropertyValue(`--d-efeito-c${i}`).trim()),
            fundos: blobs.map((b) => getComputedStyle(b).backgroundImage.slice(0, 200)),
          };
        }, fase);
        await page.waitForTimeout(180);
        const png = path.join(
          SAIDA,
          `aura-branco-${preset.rotulo}-${modo.id}-f${String(fase.toFixed(2)).replace(".", "")}.png`,
        );
        await page.screenshot({ path: png });
        const est = estatisticaPng(png);
        // Luminância da cor da camada naquela fase (a cor que entra no blend).
        const picos = cores.props
          .map((v) => v.match(/(-?[\d.]+)[,\s]+(-?[\d.]+)[,\s]+(-?[\d.]+)/))
          .filter(Boolean)
          .map((m) => luminancia(Number(m[1]), Number(m[2]), Number(m[3])));
        const picoL = picos.length ? Math.max(...picos) : null;
        porFase.push({ fase, ...est, picoL, cor: cores.props[0], png });
        linhas.push({ preset: preset.rotulo, modo: modo.id, fase: fase.toFixed(2), ...est, picoL });
      }
      // A fase PIOR é a que mais LEVANTA a luminância da tela — é isso que
      // "os elementos ficam brancos" quer dizer. O desvio (contraste) vem
      // junto porque é o que a legibilidade perde: quanto mais chapada a
      // tela, menos texto se lê.
      const pior = porFase.reduce((a, b) => (b.lumMedia > a.lumMedia ? b : a));
      const chapado = porFase.reduce((a, b) => (b.lumDesvio < a.lumDesvio ? b : a));
      console.log(
        `  [${preset.rotulo}] ${modo.id.padEnd(12)} pior fase ${pior.fase.toFixed(2)}: ` +
          `brancos ${pior.brancosPct.toFixed(2)}% (ref ${ref.brancosPct.toFixed(2)}%) · ` +
          `quase-brancos ${pior.quasePct.toFixed(2)}% (ref ${ref.quasePct.toFixed(2)}%) · ` +
          `luminância média ${pior.lumMedia.toFixed(3)} (ref ${ref.lumMedia.toFixed(3)}) · ` +
          `menor contraste(desvio) ${chapado.lumDesvio.toFixed(3)} na fase ${chapado.fase.toFixed(2)} ` +
          `(ref ${ref.lumDesvio.toFixed(3)}) · ` +
          `L máx da cor ${pior.picoL === null ? "—" : pior.picoL.toFixed(3)} · cor ${pior.cor}`,
      );
    }
  }
  await ctx.close();
}

/**
 * O QUADRO QUE O COMPOSITOR ENTREGA, durante a rolagem inteira — não o
 * `page.screenshot`, que força uma rasterização completa antes de capturar
 * e por construção NUNCA mostra tile em branco. `Page.startScreencast`
 * entrega a superfície composta como ela é apresentada; se o navegador
 * exibir área ainda não rasterizada, ela aparece AQUI e em nenhum outro
 * lugar. É a única forma de "capturar o momento em que os elementos ficam
 * brancos" — e, se não aparecer, isso também é resultado: o relato é de
 * aparelho real, e esta máquina rasteriza fora da thread limitada.
 */
async function blocoQuadros(ctx, page, linhas) {
  console.log(`\n== 6. quadros COMPOSTOS durante a rolagem (screencast) ==`);
  const cdp = await ctx.newCDPSession(page);
  for (const alvo of [
    { rotulo: "nenhum · escuro", efeito: "nenhum", preset: "norte", modo: { id: "arco-iris" } },
    { rotulo: `${EFEITO} · escuro · tema`, efeito: EFEITO, preset: "norte", modo: { id: "tema" } },
    { rotulo: `${EFEITO} · escuro · iridescente`, efeito: EFEITO, preset: "norte", modo: { id: "iridescente" } },
    { rotulo: `${EFEITO} · escuro · arco-iris`, efeito: EFEITO, preset: "norte", modo: { id: "arco-iris" } },
    { rotulo: "nenhum · claro", efeito: "nenhum", preset: "creme", modo: { id: "arco-iris" } },
    { rotulo: `${EFEITO} · claro · arco-iris`, efeito: EFEITO, preset: "creme", modo: { id: "arco-iris" } },
  ]) {
    await page.goto(url({ efeito: alvo.efeito, preset: alvo.preset, modo: alvo.modo }), {
      waitUntil: "networkidle",
    });
    await esperarEfeito(page, alvo.efeito);

    const quadros = [];
    const onQuadro = async (f) => {
      quadros.push(f.data);
      try {
        await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId });
      } catch {
        /* sessão já encerrada entre o frame e o ack */
      }
    };
    cdp.on("Page.screencastFrame", onQuadro);
    await cdp.send("Page.startScreencast", {
      format: "png",
      maxWidth: 200,
      maxHeight: 440,
      everyNthFrame: 1,
    });
    const medida = await medirRolando(page);
    await cdp.send("Page.stopScreencast");
    cdp.off("Page.screencastFrame", onQuadro);

    let pior = null;
    let somaBrancos = 0;
    for (const [i, b64] of quadros.entries()) {
      const est = estatistica(decodificarPng(Buffer.from(b64, "base64")));
      somaBrancos += est.brancosPct;
      if (!pior || est.brancosPct > pior.est.brancosPct) pior = { est, i, b64 };
    }
    const arquivo = path.join(
      SAIDA,
      `aura-quadro-pior-${alvo.rotulo.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`,
    );
    if (pior) await fs.writeFile(arquivo, Buffer.from(pior.b64, "base64"));
    const linha = {
      rotulo: alvo.rotulo,
      quadros: quadros.length,
      apresentadosPorSegundo: (quadros.length * 1000) / medida.decorrido,
      brancosMedio: quadros.length ? somaBrancos / quadros.length : 0,
      brancosPior: pior?.est.brancosPct ?? 0,
      quadroPior: pior?.i ?? -1,
      lumPior: pior?.est.lumMedia ?? 0,
    };
    linhas.push(linha);
    console.log(
      `  ${linha.rotulo.padEnd(28)} ${linha.quadros} quadros compostos ` +
        `(${linha.apresentadosPorSegundo.toFixed(1)}/s) · brancos médio ${linha.brancosMedio.toFixed(3)}% · ` +
        `PIOR quadro #${linha.quadroPior} com ${linha.brancosPior.toFixed(3)}% de branco ` +
        `(luminância ${linha.lumPior.toFixed(3)}) → ${path.basename(arquivo)}`,
    );
  }
}

/* ────────────────────────────────────────────────────────────────────── */

async function main() {
  await fs.mkdir(SAIDA, { recursive: true });
  const { base, cookie, encerrar } = await subirServidor({ build: !temFlag("sem-build") });
  BASE = base;

  const relatorio = { fps: [], atribuicao: [], compositing: [], quadros: [], branco: [] };
  try {
    const browser = await chromium.launch({ executablePath: CHROMIUM });
    const ctx = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      reducedMotion: "no-preference",
    });
    await ctx.addCookies([cookie]);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });

    await page.goto(url({ efeito: "nenhum", modo: { id: "tema" } }), { waitUntil: "domcontentloaded" });
    if (new URL(page.url()).pathname !== "/interno/demo-qa") {
      throw new Error(`sessão recusada — caiu em ${page.url()}`);
    }

    if (querido("fps")) await blocoFps(page, relatorio.fps);
    if (querido("atribuicao")) await blocoAtribuicao(ctx, page, relatorio.atribuicao);
    if (querido("compositing")) await blocoCompositing(ctx, page, relatorio.compositing);
    if (querido("hipoteseb")) relatorio.hipoteseB = await blocoHipoteseB(page, []);
    if (querido("quadros")) await blocoQuadros(ctx, page, relatorio.quadros);
    await ctx.close();

    if (querido("branco")) await blocoBranco(browser, cookie, relatorio.branco);
    await browser.close();
  } finally {
    encerrar();
  }

  const md = [
    `# Diagnóstico da aura — celular ${VIEWPORT.width}×${VIEWPORT.height} (dpr 2), CPU ${CPU}×, intensidade ${INTENSIDADE}`,
    "",
    `Rolagem contínua a ${VELOCIDADE} px/s, janela até ${JANELA_MAX_MS}ms ou o fim da página.`,
    `Mediana de ${CARGAS} cargas independentes.`,
    "",
    "## 1. fps rolando a página inteira, por modo de cor",
    "",
    "| alvo | fps (mediana) | cargas | pior quadro | quadros >50ms |",
    "|---|---|---|---|---|",
    ...relatorio.fps.map(
      (l) =>
        `| \`${l.alvo}\` | **${l.fps.toFixed(1)}** | ${l.medidas.map((m) => m.toFixed(1)).join(" / ")} | ` +
        `${l.piorMs.toFixed(0)}ms | ${l.longos} |`,
    ),
    "",
    "## 2. atribuição (arco-íris, uma coisa de cada vez)",
    "",
    "| variante | fps (mediana) | Mpx/s repintados | cargas |",
    "|---|---|---|---|",
    ...relatorio.atribuicao.map(
      (l) =>
        `| ${l.variante} | **${l.fps.toFixed(1)}** | **${l.mpxs.toFixed(1)}** | ` +
        `${l.medidas.map((m) => m.toFixed(1)).join(" / ")} |`,
    ),
    "",
    "## 3. compositing (pinturas por segundo durante a rolagem)",
    "",
    "| estado | fps | pinturas/s | pinturas/quadro | camadas | área (Mpx) | recalc | layout | script |",
    "|---|---|---|---|---|---|---|---|---|",
    ...relatorio.compositing.map(
      (l) =>
        `| ${l.rotulo} | ${l.fps.toFixed(1)} | ${l.pinturasPorSegundo.toFixed(1)} | ${l.pinturasPorQuadro.toFixed(2)} | ` +
        `${l.camadas} | ${l.areaCamadasMpx.toFixed(1)} | ${l.recalcMs.toFixed(0)}ms | ${l.layoutMs.toFixed(0)}ms | ${l.scriptMs.toFixed(0)}ms |`,
    ),
    "",
    "## 6. quadros COMPOSTOS durante a rolagem (screencast, não screenshot)",
    "",
    "| estado | quadros | apresentados/s | brancos médio % | pior quadro % | luminância do pior |",
    "|---|---|---|---|---|---|",
    ...relatorio.quadros.map(
      (l) =>
        `| ${l.rotulo} | ${l.quadros} | ${l.apresentadosPorSegundo.toFixed(1)} | ${l.brancosMedio.toFixed(3)} | ` +
        `${l.brancosPior.toFixed(3)} (#${l.quadroPior}) | ${l.lumPior.toFixed(3)} |`,
    ),
    "",
    "## 5. estouro em branco por fase do ciclo de cor",
    "",
    "| preset | modo | fase | brancos % | quase-brancos % | luminância média | desvio | L máx da cor |",
    "|---|---|---|---|---|---|---|---|",
    ...relatorio.branco.map(
      (l) =>
        `| ${l.preset} | ${l.modo} | ${l.fase} | ${l.brancosPct.toFixed(2)} | ${l.quasePct.toFixed(2)} | ` +
        `${l.lumMedia.toFixed(3)} | ${l.lumDesvio.toFixed(3)} | ${l.picoL === null ? "—" : l.picoL.toFixed(3)} |`,
    ),
    "",
  ].join("\n");
  const arquivo = path.join(SAIDA, "_aura-diagnostico.md");
  await fs.writeFile(arquivo, md);
  console.log(`\ntabelas em ${path.relative(process.cwd(), arquivo)}`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
