#!/usr/bin/env node
/**
 * Laço de captura + MEDIÇÃO do TÍTULO HERO das skins (hoje a tatuagem, a
 * única com vídeo-no-título). Existe porque o defeito relatado — "o título
 * aparece em duas camadas sobrepostas com quebras de linha diferentes" — é
 * invisível no HTML servido: a segunda camada nasce na HIDRATAÇÃO, e uma
 * captura sozinha não diz QUANTAS caixas de texto existem nem de que campo
 * cada uma lê.
 *
 * O que ele mede, com a hidratação já concluída:
 *   1. quantos nós renderizam o título (caixa de texto do CSS + `<text>`
 *      de SVG da camada de mídia), com o texto de cada um;
 *   2. as quebras de linha REAIS de cada camada (linhas do DOM via
 *      Range.getClientRects, tspans do SVG) — é a divergência entre elas
 *      que produz o texto duplicado/desalinhado;
 *   3. a `font-family` computada do título (o seletor de fontes de título
 *      do editor tem de alcançá-la);
 *   4. a caixa (x/y/largura/altura) de cada camada, pra provar alinhamento;
 *   5. a mesma coisa com ALINHAMENTO, ESCALA e ENTRE-LETRAS trocados POR
 *      CÓDIGO, sem remontar: a máscara é MEDIDA da caixa, e medição que só
 *      roda uma vez deixa as duas camadas deslocadas (ver "A medição tem
 *      de ser viva" em ARCHITECTURE.md);
 *   6. a FAIXA ACIMA do título depois do repique da rolagem, contra a
 *      mesma faixa no nível `imagem` — o que o vídeo acrescenta ali é o
 *      "rastro claro na borda superior" do relato.
 *
 * PORTÃO: reprova (código ≠ 0) se qualquer caso tiver mais de UM
 * preenchimento de glifo (duas cópias do título na tela), se a máscara da
 * mídia divergir da caixa de texto em linhas/posição, se as camadas
 * mostrarem textos diferentes ou se a fonte escolhida não chegar ao
 * título. A matriz roda em DUAS telas: no desktop o título cabe folgado (o
 * caso que esconde o defeito), e é no celular que `pre-line` quebra de
 * verdade.
 *
 * Uso:
 *   node scripts/qa-titulo.mjs                 # a matriz inteira (desktop + celular)
 *   node scripts/qa-titulo.mjs --marca=antes   # sufixo nos arquivos
 *   node scripts/qa-titulo.mjs --sem-build     # reusa o .next já buildado
 *   node scripts/qa-titulo.mjs --sem-portao    # mede e reporta, não reprova
 */

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

import { lerPng } from "./png.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = path.join(RAIZ, "qa-shots");
const CHROMIUM = process.env.QA_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORTA = Number(process.env.QA_PORTA ?? 3126);
const BASE = `http://127.0.0.1:${PORTA}`;
/**
 * Duas telas. O desktop é onde o título hero cabe folgado (o caso que
 * ESCONDE o defeito); o celular é onde `white-space: pre-line` quebra de
 * verdade — um nome longo vira 4-5 linhas ali, e é a quebra que a camada
 * de mídia tem de acompanhar. Medir só a larga daria o veredito errado.
 */
const TELAS = [
  { id: "desktop", viewport: { width: 1100, height: 700 }, dpr: 1 },
  { id: "celular", viewport: { width: 390, height: 844 }, dpr: 2 },
];
const SKIN = "tatuagem-editorial";

/** Vídeo de teste: gerado pelo próprio Playwright (nunca versionado). */
const VIDEO_DIR = path.join(RAIZ, "public", "qa-tmp");
const VIDEO_URL = "/qa-tmp/titulo.webm";

const args = process.argv.slice(2);
const opcao = (nome) => args.find((a) => a.startsWith(`--${nome}=`))?.split("=").slice(1).join("=");
const temFlag = (nome) => args.includes(`--${nome}`);
const marca = opcao("marca") ? `-${opcao("marca")}` : "";

/**
 * A matriz do relato. Nome curto cabe numa linha em qualquer camada — é o
 * caso que ESCONDE o defeito. Nome longo COM quebra manual (o que
 * `quebrarTitulo` grava em `secoes.hero.titulo` a partir do nome do lead) e
 * nome longo SEM quebra (o usuário apagou o "\n" no editor) são os dois em
 * que a caixa de texto do CSS quebra e a camada de mídia pode não quebrar.
 */
const CASOS = [
  { id: "curto", titulo: "ÓSSEA" },
  { id: "longo-com-quebra", titulo: "ÓSSEA STUDIO\nDE TATUAGEM AUTORAL" },
  { id: "longo-sem-quebra", titulo: "ÓSSEA STUDIO DE TATUAGEM AUTORAL" },
];

/** Mesmo esquema de assinatura de src/lib/auth.ts#criarSessaoToken. */
function criarSessaoToken({ userId, papel, versao }, secret) {
  const payload = `${userId}.${papel}.${versao}`;
  const sig = crypto
    .createHmac("sha256", `radar-session:${secret}`)
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

function executar(comando, argumentos, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(comando, argumentos, { cwd: RAIZ, env, stdio: "inherit" });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${comando} saiu com ${code}`))));
    p.on("error", reject);
  });
}

async function exigirPortaLivre(url) {
  try {
    await fetch(url, { redirect: "manual" });
  } catch {
    return;
  }
  throw new Error(`porta ${PORTA} já ocupada. Encerre o servidor ou use QA_PORTA=<outra>.`);
}

async function esperarServidor(url, timeoutMs = 120000) {
  const limite = Date.now() + timeoutMs;
  while (Date.now() < limite) {
    try {
      await fetch(url, { redirect: "manual" });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`servidor não respondeu em ${url}`);
}

function url({ titulo, heroFonte, video, preset = "sangue" }) {
  const q = new URLSearchParams({ skin: SKIN, preset, intro: "0" });
  if (titulo !== undefined) q.set("titulo", titulo.replace(/\n/g, "\\n"));
  if (heroFonte) q.set("heroFonte", heroFonte);
  if (video) q.set("video", video);
  return `${BASE}/interno/demo-qa?${q}`;
}

/**
 * Grava um webm curto e colorido (o Playwright usa o ffmpeg do próprio
 * bundle) pra servir de `videos.titulo`. Sem isso o nível mais rico do
 * vídeo-no-título — o único em que a máscara roda sobre conteúdo em
 * movimento — nunca seria exercitado, porque a Forja não versiona vídeo.
 *
 * Roda ANTES de subir o servidor: o `next start` monta o índice de
 * `public/` na inicialização, e um arquivo criado depois responde 404 (foi
 * exatamente assim que a primeira rodada mediu o nível `imagem` achando
 * que media o `video`).
 */
async function gerarVideo(browser) {
  await fs.rm(VIDEO_DIR, { recursive: true, force: true });
  await fs.mkdir(VIDEO_DIR, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 480, height: 270 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 480, height: 270 } },
  });
  const page = await ctx.newPage();
  await page.setContent(`<style>
      body { margin:0; height:100vh;
             background: linear-gradient(120deg,#ff2e88,#ffd23f,#22d3a5,#00c2ff);
             background-size: 400% 100%; animation: p 1.2s linear infinite; }
      @keyframes p { to { background-position: 400% 0; } }
    </style>`);
  await page.waitForTimeout(1600);
  const bruto = await page.video().path();
  await ctx.close();
  await fs.rename(bruto, path.join(VIDEO_DIR, "titulo.webm"));
  return VIDEO_URL;
}

/**
 * Inventário do título com a hidratação concluída. Roda no browser: varre
 * TODO nó de texto e todo `<text>`/`<tspan>` de SVG dentro do wordmark e
 * devolve, por camada, o texto, as linhas reais e a caixa — a evidência de
 * "quantas caixas de texto o título tem".
 */
const INVENTARIO = () => {
  const alvo = document.querySelector('[data-demo-slot="secoes.hero.titulo"]');
  if (!alvo) return { erro: "wordmark não encontrado" };
  const raiz = alvo.getBoundingClientRect();
  const rel = (r) => ({
    x: +(r.left - raiz.left).toFixed(1),
    y: +(r.top - raiz.top).toFixed(1),
    w: +r.width.toFixed(1),
    h: +r.height.toFixed(1),
  });

  /** Linhas REAIS de um nó de texto: um rect por linha renderizada. */
  const linhasDoNo = (no) => {
    const faixa = document.createRange();
    faixa.selectNodeContents(no);
    const rects = [...faixa.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    // Junta rects na mesma linha (mesmo topo, dentro de 1px).
    const linhas = [];
    for (const r of rects) {
      const anterior = linhas[linhas.length - 1];
      if (anterior && Math.abs(anterior.top - r.top) < 1) {
        anterior.left = Math.min(anterior.left, r.left);
        anterior.right = Math.max(anterior.right, r.right);
        continue;
      }
      linhas.push({ top: r.top, left: r.left, right: r.right, bottom: r.bottom });
    }
    return linhas.map((l) =>
      rel({ left: l.left, top: l.top, width: l.right - l.left, height: l.bottom - l.top }),
    );
  };

  const camadas = [];

  // 1. Caixas de texto HTML (nós de texto que não estão dentro de <svg>).
  const andarilho = document.createTreeWalker(alvo, NodeFilter.SHOW_TEXT);
  for (let no = andarilho.nextNode(); no; no = andarilho.nextNode()) {
    if (!no.textContent.trim()) continue;
    const pai = no.parentElement;
    if (pai.closest("svg")) continue;
    const estilo = getComputedStyle(pai);
    camadas.push({
      tipo: "html",
      seletor: pai.className || pai.tagName.toLowerCase(),
      texto: no.textContent,
      linhas: linhasDoNo(no),
      fonte: estilo.fontFamily,
      tamanho: estilo.fontSize,
      visivel:
        estilo.visibility !== "hidden" &&
        estilo.display !== "none" &&
        Number(estilo.opacity) > 0,
      // Pinta alguma coisa? fill (background-clip:text / color) ou contorno.
      pinta: {
        fundo: estilo.backgroundImage,
        cor: estilo.color,
        contorno: estilo.webkitTextStrokeWidth,
      },
    });
  }

  // 2. Texto de SVG — o que a camada de mídia usa como máscara. Sem
  //    viewBox e com o <svg> cobrindo o wordmark (inset-0, 100%×100%), a
  //    unidade de usuário do SVG JÁ é px na origem do wordmark, o mesmo
  //    referencial de `rel()` — dá pra comparar linha a linha.
  //
  //    Medido pelo AVANÇO (getStartPositionOfChar + getComputedTextLength),
  //    não pelo getBBox: getBBox devolve a caixa de TINTA (o traço do glifo),
  //    e a caixa HTML medida por Range devolve a de AVANÇO. Comparar uma
  //    com a outra acusa "desalinhamento" de vários px onde o glifo só tem
  //    lateral negativa — foi o que a primeira rodada depois da correção
  //    reportou na linha que começa em "T".
  const medidaDoTexto = (el) => {
    try {
      const inicio = el.getStartPositionOfChar(0);
      return {
        x: +inicio.x.toFixed(1),
        y: +inicio.y.toFixed(1),
        w: +el.getComputedTextLength().toFixed(1),
        h: +el.getBBox().height.toFixed(1),
      };
    } catch {
      const b = el.getBBox();
      return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
    }
  };
  for (const t of alvo.querySelectorAll("text")) {
    const partes = [...t.querySelectorAll("tspan")];
    camadas.push({
      tipo: "svg-text",
      seletor: `text${t.closest("mask") ? " (em <mask>)" : ""}`,
      texto: t.textContent,
      // Um <text> por linha (uma linha) ou um <tspan> por linha.
      linhas:
        partes.length > 0
          ? partes.map((s) => ({ ...medidaDoTexto(s), texto: s.textContent }))
          : [{ ...medidaDoTexto(t), texto: t.textContent }],
      fonte: getComputedStyle(t).fontFamily,
      tamanho: getComputedStyle(t).fontSize,
      // Texto dentro de <mask>/<defs> não é pintado: ele RECORTA a mídia.
      // Vira "caixa vista" só se a mídia que ele recorta estiver na tela.
      visivel: !t.closest("mask, defs") || Boolean(alvo.querySelector("video, image")),
      mascara: Boolean(t.closest("mask, defs")),
    });
  }

  // 3. A mídia em si (o que a máscara recorta), pra saber o nível ativo.
  const midia = alvo.querySelector("video")
    ? "video"
    : alvo.querySelector("image, img")
      ? "imagem"
      : "nenhum";

  return {
    caixa: { w: +raiz.width.toFixed(1), h: +raiz.height.toFixed(1) },
    fonteWordmark: getComputedStyle(alvo).fontFamily,
    midia,
    camadas,
    ariaLabel: alvo.getAttribute("aria-label"),
  };
};

async function medir(page, alvo) {
  await page.goto(alvo, { waitUntil: "networkidle" });
  // A camada de mídia decide o nível num setTimeout(…,0) DEPOIS da
  // hidratação — medir antes disso mediria só o HTML do servidor.
  await page.waitForTimeout(900);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  return page.evaluate(INVENTARIO);
}

async function fotoDoTitulo(page, nome) {
  const alvo = page.locator('[data-demo-slot="secoes.hero.titulo"]');
  const caixa = await alvo.boundingBox();
  const arquivo = path.join(SAIDA, `titulo-${nome}${marca}.png`);
  await page.screenshot({
    path: arquivo,
    clip: caixa
      ? {
          x: Math.max(0, caixa.x - 20),
          y: Math.max(0, caixa.y - 30),
          width: Math.min(page.viewportSize().width, caixa.width + 40),
          height: caixa.height + 60,
        }
      : undefined,
  });
  return arquivo;
}

/**
 * PREENCHIMENTOS do título — a medida que decide se há texto duplicado.
 *
 * O que a pessoa vê como "uma cópia do título" é uma superfície de glifos
 * PREENCHIDA. Contorno (`-webkit-text-stroke`) não conta: ele acompanha a
 * mesma caixa, é a assinatura da skin e não produz uma segunda leitura do
 * texto. Então: cada caixa HTML com preenchimento (gradiente/foto via
 * `background-clip: text`, ou `color` opaca) é 1; a mídia recortada por
 * máscara (vídeo/imagem) é mais 1. Dois preenchimentos = duas cópias.
 */
function preenchimentos(inv) {
  const fontes = [];
  for (const c of inv.camadas) {
    if (c.tipo !== "html" || !c.visivel) continue;
    const temFundo = c.pinta.fundo !== "none";
    const temCor = !/rgba\(0, 0, 0, 0\)|transparent/.test(c.pinta.cor);
    if (temFundo || temCor) fontes.push(`${c.seletor} (${temFundo ? "background-clip:text" : "color"})`);
  }
  if (inv.midia !== "nenhum") fontes.push(`mídia mascarada (${inv.midia})`);
  return fontes;
}

/** Centro horizontal de uma linha — comparável entre caixa HTML e <text>. */
const centro = (l) => +(l.x + l.w / 2).toFixed(1);

function relatarCaso(linhas, rotulo, inv, foto) {
  linhas.push(`### ${rotulo}`, "");
  if (inv.erro) {
    linhas.push(`- ✗ ${inv.erro}`, "");
    return;
  }
  const fills = preenchimentos(inv);
  linhas.push(
    `- caixa do wordmark: ${inv.caixa.w}×${inv.caixa.h}px · mídia ativa: \`${inv.midia}\``,
    `- \`font-family\` do wordmark: \`${inv.fonteWordmark}\``,
    `- nós que renderizam o título: **${inv.camadas.length}** · preenchimentos de glifo: **${fills.length}** (${fills.join(" + ") || "—"})`,
    "",
  );
  for (const c of inv.camadas) {
    linhas.push(
      `  - \`${c.tipo}\` (${c.seletor}) — fonte \`${c.fonte}\` · ${c.tamanho}`,
      `    - texto: ${JSON.stringify(c.texto)}`,
      `    - ${c.linhas.length} linha(s): ${c.linhas
        .map(
          (l) =>
            `[${l.texto !== undefined ? `${JSON.stringify(l.texto)} ` : ""}x=${l.x} y=${l.y} ${l.w}×${l.h} centro=${centro(l)}]`,
        )
        .join(" ")}`,
    );
  }
  linhas.push("", `  ![${rotulo}](${path.basename(foto)})`, "");
}

/** Tolerância do centro de linha entre a caixa HTML e a máscara (px). */
const TOL_CENTRO = 3;

/** Altura da faixa medida acima do wordmark, em px CSS. */
const ALTURA_FAIXA = 70;
/**
 * Quantos px claros a MAIS a faixa acima do título pode ter por causa do
 * vídeo. Não é zero porque as duas capturas são de rodadas diferentes (a
 * foto do hero é a mesma, mas o antialiasing do texto acima não é
 * bit-a-bit); o vazamento relatado é uma faixa de ~20px de altura na
 * largura do título — milhares de pixels, não dezenas.
 */
const TOL_RASTRO = 60;

/** px claros de um PNG inteiro (luminância ≥ 150). */
function clarosNoPng(arquivo) {
  const { w, h, canais, px } = lerPng(arquivo);
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    const p = i * canais;
    if (0.2126 * px[p] + 0.7152 * px[p + 1] + 0.0722 * px[p + 2] >= 150) n++;
  }
  return n;
}

/**
 * Veredito por caso:
 *
 *   1. DOIS preenchimentos de glifo = duas cópias do título na tela — o
 *      defeito relatado, e o que a captura mostra como texto duplicado;
 *   2. máscara com quebra/linha diferente da caixa de texto = a mídia
 *      recorta letras em lugar diferente do texto (desalinhamento), mesmo
 *      quando só ela pinta;
 *   3. textos diferentes entre as camadas = as duas leem campos
 *      diferentes, e o campo do editor só alcança uma delas.
 */
function veredito(inv) {
  if (inv.erro) return [inv.erro];
  const problemas = [];

  const fills = preenchimentos(inv);
  if (fills.length > 1) {
    problemas.push(`${fills.length} preenchimentos de glifo (${fills.join(" + ")}) — título duplicado`);
  }

  // A máscara pode ser um <text> por linha: as partes de SVG são UMA
  // camada só, comparada linha a linha com a caixa de texto.
  const caixa = inv.camadas.find((c) => c.tipo === "html");
  const partes = inv.camadas.filter((c) => c.tipo === "svg-text");
  if (caixa && partes.length > 0) {
    const linhasMascara = partes.flatMap((p) => p.linhas);
    if (linhasMascara.length !== caixa.linhas.length) {
      problemas.push(
        `máscara com ${linhasMascara.length} linha(s) e caixa de texto com ${caixa.linhas.length}`,
      );
    } else {
      const fora = linhasMascara
        .map((l, i) => ({ i, d: +Math.abs(centro(l) - centro(caixa.linhas[i])).toFixed(1) }))
        .filter(({ d }) => d > TOL_CENTRO);
      if (fora.length > 0) {
        problemas.push(
          `máscara desalinhada da caixa de texto: ${fora.map(({ i, d }) => `linha ${i + 1} ${d}px`).join(", ")}`,
        );
      }
    }
    const soLetras = (t) => t.replace(/\s+/g, "").toUpperCase();
    const daMascara = soLetras(partes.map((p) => p.texto).join(""));
    if (daMascara !== soLetras(caixa.texto)) {
      problemas.push(
        `máscara e caixa de texto com TEXTOS diferentes: ${JSON.stringify(soLetras(caixa.texto))} ≠ ${JSON.stringify(daMascara)}`,
      );
    }
  }
  return problemas;
}

async function main() {
  await fs.mkdir(SAIDA, { recursive: true });
  const secret = crypto.randomBytes(16).toString("hex");
  const env = { ...process.env, APP_PASSWORD: secret, PORT: String(PORTA), NODE_ENV: undefined };

  await exigirPortaLivre(BASE);

  // O webm de teste tem de existir ANTES do `next start` (ver gerarVideo).
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const video = await gerarVideo(browser);

  if (!temFlag("sem-build")) await executar("npx", ["next", "build"], env);

  const servidor = spawn("npx", ["next", "start", "-p", String(PORTA)], {
    cwd: RAIZ,
    env,
    stdio: ["ignore", "inherit", "inherit"],
    detached: true,
  });
  const encerrar = () => {
    try {
      process.kill(-servidor.pid, "SIGTERM");
    } catch {
      servidor.kill("SIGTERM");
    }
  };
  process.on("exit", encerrar);
  process.on("SIGINT", () => {
    encerrar();
    process.exit(130);
  });

  const relatorio = [];
  const reprovados = [];
  try {
    await esperarServidor(BASE);
    const sessao = criarSessaoToken({ userId: "qa", papel: "admin", versao: 1 }, secret);

    for (const tela of TELAS) {
      const ctx = await browser.newContext({
        viewport: tela.viewport,
        deviceScaleFactor: tela.dpr,
        reducedMotion: "no-preference",
      });
      await ctx.addCookies([{ name: "radar_session", value: sessao, url: BASE }]);
      const page = await ctx.newPage();
      await page.goto(url({ titulo: "TESTE" }), { waitUntil: "domcontentloaded" });
      if (new URL(page.url()).pathname !== "/interno/demo-qa") {
        throw new Error(`sessão recusada — caiu em ${page.url()}`);
      }
      relatorio.push(
        `# Tela ${tela.id} (${tela.viewport.width}×${tela.viewport.height}, dpr ${tela.dpr})`,
        "",
      );

      // ── 1. Os três casos do relato, no nível de mídia que sempre roda
      //       (imagem: `imagens.hero` existe em toda demo) e no nível vídeo.
      for (const nivel of [
        { id: "imagem", video: undefined },
        { id: "video", video },
      ]) {
        relatorio.push(`## Mídia: ${nivel.id}`, "");
        for (const caso of CASOS) {
          const alvo = url({ titulo: caso.titulo, video: nivel.video });
          const inv = await medir(page, alvo);
          const nome = `${tela.id}-${nivel.id}-${caso.id}`;
          const foto = await fotoDoTitulo(page, nome);
          relatarCaso(relatorio, `${caso.id} — ${JSON.stringify(caso.titulo)}`, inv, foto);
          const problemas = veredito(inv);
          if (nivel.id === "video" && inv.midia !== "video") {
            problemas.push(`nível de mídia esperado \`video\`, obtido \`${inv.midia}\``);
          }
          if (problemas.length > 0) reprovados.push(`${nome}: ${problemas.join("; ")}`);
        }
      }

      // ── 2. O hero INTEIRO, não só o recorte do título: a caixa do
      //       wordmark mudou de composição, e é aqui que se vê se ela
      //       continua no lugar em relação ao resto da abertura.
      await medir(page, url({ titulo: CASOS[1].titulo, video }));
      const heroPng = path.join(SAIDA, `titulo-${tela.id}-hero${marca}.png`);
      await page.screenshot({ path: heroPng });
      relatorio.push("## Hero inteiro (nome longo com quebra, vídeo)", "", `![hero ${tela.id}](${path.basename(heroPng)})`, "");

      // ── 2b. O RASTRO NA BORDA SUPERIOR, medido: o hero no topo da
      //       rolagem DEPOIS do repique, que é o instante do relato ("o
      //       vídeo vaza para fora do recorte das letras e aparece como
      //       rastro claro na borda superior").
      //
      //       O que se mede é a faixa ACIMA da caixa do wordmark, onde
      //       nenhum pixel de vídeo tem o que fazer. Sozinho o número não
      //       diz nada — a foto do hero também é clara em pedaços —, então
      //       a referência é a MESMA faixa no nível `imagem`, sem vídeo
      //       nenhum: o que o vídeo ACRESCENTA ali é o vazamento.
      const faixaAcima = async (comVideo) => {
        await medir(page, url({ titulo: CASOS[1].titulo, video: comVideo ? video : undefined }));
        const caixa = await page
          .locator('[data-demo-slot="secoes.hero.titulo"]')
          .boundingBox();
        const recorte = {
          x: 0,
          y: Math.max(0, caixa.y - ALTURA_FAIXA),
          width: page.viewportSize().width,
          height: Math.min(ALTURA_FAIXA, caixa.y),
        };
        // Desce e volta ao topo: é a volta que obriga a camada a ser
        // redesenhada. Gesto de toque, que é como acontece no celular.
        for (let i = 0; i < 3; i++) {
          await page.mouse.wheel(0, 900);
          await page.waitForTimeout(120);
          await page.mouse.wheel(0, -1600);
          await page.waitForTimeout(200);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        const nivel = comVideo ? "video" : "imagem";
        // O hero INTEIRO neste instante — a faixa medida é um recorte dele,
        // e o número sozinho não substitui olhar a imagem.
        const hero = path.join(SAIDA, `titulo-${tela.id}-repique-${nivel}${marca}.png`);
        await page.screenshot({ path: hero });
        const arquivo = path.join(SAIDA, `titulo-${tela.id}-topo-${nivel}${marca}.png`);
        await page.screenshot({ path: arquivo, clip: recorte });
        return { claros: clarosNoPng(arquivo), arquivo, hero };
      };

      const semVideo = await faixaAcima(false);
      const comVideo = await faixaAcima(true);
      const ganho = comVideo.claros - semVideo.claros;
      relatorio.push(
        "## Borda superior no topo da rolagem (o rastro do relato)",
        "",
        `- faixa de ${ALTURA_FAIXA}px acima do wordmark, depois do repique`,
        `- px claros SEM vídeo (referência): **${semVideo.claros}**`,
        `- px claros COM vídeo: **${comVideo.claros}** → ganho **${ganho}** (tolerância ${TOL_RASTRO})`,
        "",
        `![topo sem vídeo](${path.basename(semVideo.arquivo)})`,
        `![topo com vídeo](${path.basename(comVideo.arquivo)})`,
        "",
        "O hero inteiro no mesmo instante (depois do repique, no topo):",
        "",
        `![hero no repique, com vídeo](${path.basename(comVideo.hero)})`,
        "",
      );
      if (ganho > TOL_RASTRO) {
        reprovados.push(
          `${tela.id}-borda-superior: o vídeo acrescentou ${ganho} px claros acima do título (rastro fora do recorte)`,
        );
      }

      // ── 3. O seletor de fontes de título alcança o wordmark?
      relatorio.push("## Seletor de fontes do título (aba Tema)", "");
      const fontes = [
        { id: "", rotulo: "padrão da skin (decorativa)", esperado: "pirata" },
        { id: "bebas", rotulo: "Bebas Neue", esperado: "bebas" },
        { id: "cinzel", rotulo: "Cinzel", esperado: "cinzel" },
      ];
      for (const fonte of fontes) {
        const inv = await medir(page, url({ titulo: "ÓSSEA STUDIO", heroFonte: fonte.id }));
        const foto = await fotoDoTitulo(page, `${tela.id}-fonte-${fonte.id || "padrao"}`);
        const familias = inv.camadas.map((c) => c.fonte);
        relatorio.push(
          `- **${fonte.rotulo}** (\`heroFonte=${fonte.id || "—"}\`): wordmark \`${inv.fonteWordmark}\``,
          `  - por camada: ${familias.map((f) => `\`${f}\``).join(", ")}`,
          `  ![fonte ${fonte.rotulo}](${path.basename(foto)})`,
        );
        const usa = (f) => f.toLowerCase().includes(fonte.esperado);
        const rotuloFonte = `${tela.id}-fonte-${fonte.id || "padrão"}`;
        if (!usa(inv.fonteWordmark)) {
          reprovados.push(`${rotuloFonte}: esperava \`${fonte.esperado}\` em \`${inv.fonteWordmark}\``);
        }
        for (const f of familias.filter((f) => !usa(f))) {
          reprovados.push(`${rotuloFonte}: camada com \`${f}\` (esperava \`${fonte.esperado}\`)`);
        }
      }
      relatorio.push("");

      // ── 4. REGRESSÃO: alinhamento trocado POR CÓDIGO, sem remontar.
      //
      //    A geometria da máscara é MEDIDA da caixa de texto. Medida UMA
      //    vez, ela fica onde estava: trocar o alinhamento MOVE a caixa sem
      //    REDIMENSIONÁ-LA (`.d-wordmark-text` é inline-block), o
      //    ResizeObserver não dispara e as duas camadas ficam deslocadas —
      //    era o defeito relatado, e mudar o TAMANHO da fonte o escondia,
      //    porque aí a caixa muda de tamanho e o observador acorda.
      //
      //    A troca aqui é feita no DOM (estilo inline no bloco do título),
      //    de propósito: é o caso mais duro, que não passa por render
      //    nenhum do React, então passar nele cobre também o caminho do
      //    editor (novo tema → nova classe no bloco, wordmark no lugar).
      relatorio.push("## Alinhamento trocado por código (sem remontar)", "");
      await medir(page, url({ titulo: CASOS[1].titulo, video }));
      for (const alinhamento of ["left", "right", "center"]) {
        await page.evaluate((a) => {
          const alvo = document.querySelector('[data-demo-slot="secoes.hero.titulo"]');
          alvo.parentElement.style.textAlign = a;
        }, alinhamento);
        // Folga para a recontagem (observadores + efeito de layout).
        await page.waitForTimeout(400);
        const inv = await page.evaluate(INVENTARIO);
        const nome = `${tela.id}-alinhamento-${alinhamento}`;
        const foto = await fotoDoTitulo(page, nome);
        relatarCaso(relatorio, `text-align: ${alinhamento}`, inv, foto);
        const problemas = veredito(inv);
        if (inv.midia !== "video") {
          problemas.push(`nível de mídia esperado \`video\`, obtido \`${inv.midia}\``);
        }
        if (problemas.length > 0) reprovados.push(`${nome}: ${problemas.join("; ")}`);
      }
      relatorio.push("");

      // ── 5. Os dois controles NOVOS da aba Tema, trocados POR CÓDIGO,
      //       pela mesma porta: as custom properties que a skin lê. Se
      //       algum deles não disparasse a recontagem, a máscara ficaria
      //       para trás igual ao alinhamento — o teto de escala subiu para
      //       1,70, e é no topo dele que a divergência seria maior.
      relatorio.push("## Escala e entre-letras trocados por código", "");
      const controles = [
        { id: "escala-1.70", prop: "--d-hero-escala", valor: "1.7" },
        { id: "escala-0.70", prop: "--d-hero-escala", valor: "0.7" },
        { id: "espacamento-0.30em", prop: "--d-hero-espacamento", valor: "0.3em" },
        { id: "espacamento--0.05em", prop: "--d-hero-espacamento", valor: "-0.05em" },
      ];
      for (const controle of controles) {
        await medir(page, url({ titulo: CASOS[1].titulo, video }));
        await page.evaluate(({ prop, valor }) => {
          const alvo = document.querySelector('[data-demo-slot="secoes.hero.titulo"]');
          alvo.style.setProperty(prop, valor);
        }, controle);
        await page.waitForTimeout(400);
        const inv = await page.evaluate(INVENTARIO);
        const nome = `${tela.id}-${controle.id}`;
        const foto = await fotoDoTitulo(page, nome);
        relatarCaso(relatorio, `${controle.prop}: ${controle.valor}`, inv, foto);
        const problemas = veredito(inv);
        if (inv.midia !== "video") {
          problemas.push(`nível de mídia esperado \`video\`, obtido \`${inv.midia}\``);
        }
        if (problemas.length > 0) reprovados.push(`${nome}: ${problemas.join("; ")}`);
      }
      relatorio.push("");

      await ctx.close();
    }

    await browser.close();
  } finally {
    await fs.rm(VIDEO_DIR, { recursive: true, force: true }).catch(() => {});
    encerrar();
  }

  relatorio.push("# Veredito", "");
  if (reprovados.length === 0) {
    relatorio.push("✅ uma única caixa de texto por caso, camadas alinhadas e fonte do editor aplicada.");
  } else {
    relatorio.push(...reprovados.map((r) => `- ✗ ${r}`));
  }
  const md = path.join(SAIDA, `_titulo${marca}.md`);
  await fs.writeFile(md, relatorio.join("\n") + "\n");
  console.log(relatorio.join("\n"));
  console.log(`\n→ ${md}`);

  if (reprovados.length > 0 && !temFlag("sem-portao")) {
    throw new Error(`título hero REPROVADO em ${reprovados.length} caso(s) — ver ${md}`);
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
