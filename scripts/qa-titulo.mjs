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

import { VARIANTES_POR_SKIN } from "../src/lib/demos/capturas/variantes.mjs";
import { decodificarPng, lerPng } from "./png.mjs";

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
/**
 * As VARIANTES da skin — o eixo que este laço não tinha.
 *
 * O vídeo-no-título existe nas quatro, mas cada uma põe o wordmark numa
 * composição diferente de abertura (tela cheia, dividida, ficha,
 * tipográfica): a caixa medida muda de largura, de posição e de vizinhança,
 * e a máscara é DERIVADA dessa caixa. Rodar só na `sangue` media uma
 * abertura de quatro. `--preset=<id>` roda uma só.
 */
const PRESETS = (() => {
  const todas = VARIANTES_POR_SKIN[SKIN] ?? ["sangue"];
  const pedida = process.argv
    .slice(2)
    .find((a) => a.startsWith("--preset="))
    ?.split("=")[1];
  if (!pedida) return todas;
  if (!todas.includes(pedida)) throw new Error(`variante desconhecida: ${pedida} (tem ${todas.join(", ")})`);
  return [pedida];
})();

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

/**
 * A variante em medição. Módulo-escopo porque o laço a troca no topo e
 * TODA chamada de `url()` tem de segui-la — e sem default de propósito:
 * um sítio de chamada esquecido estoura aqui em vez de medir a `sangue`
 * calado, que é o defeito que este laço existe para não cometer.
 */
let presetAtual = null;

function url({ titulo, heroFonte, video, preset = presetAtual }) {
  if (!preset) throw new Error("url() sem variante — presetAtual não foi definido");
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
 * O vídeo está VISÍVEL dentro das letras — não só encaixado.
 *
 * Toda a geometria deste laço (quantas caixas, linhas batendo, avanços
 * iguais) passaria intacta com uma máscara perfeitamente alinhada sobre um
 * canvas que nunca foi pintado: o título simplesmente ficaria sem
 * preenchimento, e nenhum número acusaria.
 *
 * O que separa "pintado" de "não pintado" é o TEMPO. O vídeo de teste é um
 * gradiente que corre em 1,2s, então dois quadros separados por ~450ms
 * diferem. A medida é a fração de pixels da caixa do título que MUDARAM
 * entre os dois instantes:
 *
 *   - perto de 0  → o vídeo não está pintando (ou parou): REPROVA;
 *   - perto de 100 → a máscara não está recortando nada e o vídeo cobre a
 *                    caixa inteira: REPROVA (é o defeito do rastro, na
 *                    versão extrema);
 *   - entre os dois → mudou só onde há glifo, que é o que se quer. A
 *                     cobertura de glifo desta skin mede ~23% da caixa.
 *
 * O nível `imagem` roda a mesma medida como CONTROLE: ali nada pode mudar,
 * e é isso que prova que a variação no nível `video` é do vídeo, e não de
 * animação de entrada ou do contorno ciclando.
 */
/**
 * Piso e teto da fração da caixa que muda quando o vídeo apresenta um
 * quadro novo. A cobertura de glifo desta skin mede ~23-36% da caixa
 * (depende do nome), então:
 *   - abaixo do piso → o quadro novo não chegou à tela: a máscara está
 *     alinhada sobre um canvas que não é composto. REPROVA;
 *   - acima do teto  → mudou quase a caixa inteira: a máscara não está
 *     recortando e o vídeo aparece FORA das letras. REPROVA.
 */
const GLIFO_MIN = 3;
const GLIFO_MAX = 70;
/** Teto do CONTROLE: com o CSS congelado, o nível `imagem` fica parado. */
const CONTROLE_MAX = 0.5;
/** Quanto esperar por um quadro novo do vídeo antes de desistir. */
const QUADRO_NOVO_MS = 3000;
/**
 * PONTO CEGO DECLARADO — quais casos a prova de vídeo COBRA, e por quê.
 *
 * A medida é confiável nos nomes LONGOS e não é no nome curto sintético
 * (`ÓSSEA`, 5 letras). Isso foi medido, não suposto:
 *
 *   | caso                                  | controle `imagem` | `video`  |
 *   |---------------------------------------|-------------------|----------|
 *   | nomes longos, 4 variantes × 2 telas   | 0% em 16/16       | 22–36%   |
 *   | `ÓSSEA`, sozinho numa carga limpa     | 0%                | 36%      |
 *   | `ÓSSEA`, dentro da sequência do laço  | 0%                | 0%       |
 *
 * Ou seja: a superfície mascarada do nome curto deixa de receber
 * atualização de composição no Chromium headless com swiftshader depois de
 * algumas navegações na mesma aba — e volta a receber numa aba recém-
 * aberta. É propriedade do ambiente de medição, não da skin: o mesmo
 * código, na mesma máquina, com um nome de 5 letras, compõe ou não compõe
 * conforme o histórico da aba.
 *
 * Nenhum caso de PRODUÇÃO cai nessa faixa: `dadosDoLead` grava o nome do
 * negócio em `secoes.hero.titulo` já quebrado por `quebrarTitulo`, e os
 * dois casos longos são exatamente essa forma. O `curto` existe na matriz
 * para exercitar o caminho SEM quebra de linha, e continua sendo medido e
 * relatado — só não reprova.
 */
const CASOS_COM_PROVA_DE_VIDEO = new Set(["longo-com-quebra", "longo-sem-quebra"]);

/**
 * Espera o canvas do título APRESENTAR um quadro diferente, e devolve se
 * conseguiu.
 *
 * Existe porque a primeira versão desta medida comparava dois instantes
 * separados por 450ms fixos — e o webm gravado pelo próprio Playwright tem
 * taxa de quadros baixa e irregular no headless: em 5 das 6 janelas o
 * canvas servia o MESMO quadro, a tela (corretamente) não mudava, e o
 * portão acusava "vídeo não aparece" num vídeo que aparecia. Esperar o
 * quadro troca uma amostragem torcendo por sorte por uma condição.
 */
const ESPERAR_QUADRO_NOVO = async (limiteMs) => {
  const canvas = document.querySelector('[data-demo-slot="secoes.hero.titulo"] canvas');
  if (!canvas) return null;
  /* Amostra só um CANTO de 64×64, e isso é deliberado: ler o canvas
   * inteiro a cada quadro (451 mil px na tela larga) custa caro o
   * suficiente para estrangular o próprio pipeline que se quer medir — foi
   * testado, e a leitura completa levou o portão de 1 para 19 reprovações,
   * todas com a tela parada. A medida tem de ser barata para não virar a
   * causa do que ela mede. */
  const ler = () => {
    const d = canvas
      .getContext("2d")
      .getImageData(0, 0, Math.min(64, canvas.width), Math.min(64, canvas.height)).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 17) h = (h * 31 + d[i]) >>> 0;
    return h;
  };
  const inicial = ler();
  const fim = performance.now() + limiteMs;
  while (performance.now() < fim) {
    await new Promise((r) => requestAnimationFrame(r));
    if (ler() !== inicial) return true;
  }
  return false;
};

/**
 * O vídeo está VISÍVEL dentro das letras — não só encaixado.
 *
 * Toda a geometria deste laço (quantas caixas, linhas batendo, avanços
 * iguais) passaria intacta com uma máscara perfeitamente alinhada sobre um
 * canvas que nunca foi pintado: o título ficaria sem preenchimento e
 * nenhum número acusaria. A prova de que ele aparece é TEMPORAL — um
 * quadro novo do vídeo tem de mudar a tela, e mudar só onde há glifo.
 *
 * O CSS é congelado antes de medir: `d-stroke-cycle` (contorno em três
 * acentos, 12s) e `d-wordmark-drift` (gradiente, 9s) rodam em TODO nível
 * de mídia, e a primeira rodada deste portão acusou 5 a 15% de pixels
 * mudando no nível `imagem` — que é justamente o controle que deveria
 * ficar parado. O canvas não é animação WAAPI: ele continua repintando.
 */
async function vidaNaCaixa(page, alvo, comVideo) {
  /* CARGA PRÓPRIA. A medida é sensível ao estado que o resto do laço deixa
   * na página: rodando na sequência (inventário, foto do título, e só
   * então esta medida), o primeiro caso de cada tela dava 0% de mudança
   * com o canvas trocando de quadro — e o MESMO caso, sozinho numa carga
   * limpa, dá 36%. Em vez de explicar o cache de rasterização do Chromium
   * headless, a medida ganha a própria carga e mede sempre na mesma
   * condição. */
  await page.goto(alvo, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    for (const a of document.getAnimations()) a.pause();
  });
  await page.waitForTimeout(80);
  const caixa = await page.locator('[data-demo-slot="secoes.hero.titulo"]').boundingBox();
  if (!caixa) return null;
  const recorte = {
    x: Math.round(caixa.x),
    y: Math.round(caixa.y),
    width: Math.max(1, Math.round(caixa.width)),
    height: Math.max(1, Math.round(caixa.height)),
  };

  /* TRÊS capturas, e entre elas a ESPERA POR QUADRO — não uma pausa de
   * relógio. A diferença é grande e foi medida: com `waitForTimeout(450)`
   * a tela sai idêntica (0%) mesmo com o canvas trocando de quadro, porque
   * o headless não produz quadros enquanto ninguém pede; com a espera que
   * gira `requestAnimationFrame`, a mesma caixa muda 36%. O veredito é o
   * MAIOR par: basta um intervalo ter atravessado a troca de quadro, e
   * assim a medida não depende de cair no instante certo. */
  /* AQUECIMENTO. O primeiro caso de cada tela mede logo depois da carga, e
   * ali o vídeo ainda está engatando: o canvas já trocou de quadro (o
   * `quadroNovo` dava `true`) mas a tela ainda não acompanhava, e só o
   * primeiro caso de cada tela reprovava. Esperar um quadro ANTES de
   * começar a medir põe os três casos na mesma condição. */
  if (comVideo) await page.evaluate(ESPERAR_QUADRO_NOVO, QUADRO_NOVO_MS);

  const quadros = [];
  let quadroNovo = null;
  for (let k = 0; k < (comVideo ? 5 : 2); k++) {
    quadros.push(decodificarPng(await page.screenshot({ clip: recorte })));
    if (k === (comVideo ? 4 : 1)) break;
    if (comVideo) {
      const houve = await page.evaluate(ESPERAR_QUADRO_NOVO, QUADRO_NOVO_MS);
      quadroNovo = quadroNovo === false ? false : houve;
    } else {
      // Controle: a mesma ordem de grandeza de tempo, sem vídeo nenhum.
      await page.waitForTimeout(450);
    }
  }

  const fracao = (a, b) => {
    const n = Math.min(a.w * a.h, b.w * b.h);
    let mudaram = 0;
    let soma = 0;
    for (let i = 0; i < n; i++) {
      let d = 0;
      for (let c = 0; c < 3; c++) {
        d = Math.max(d, Math.abs(a.px[i * a.canais + c] - b.px[i * b.canais + c]));
      }
      soma += d;
      if (d > 8) mudaram++;
    }
    return { mudaram: (mudaram / n) * 100, medio: soma / n };
  };
  let melhor = { mudaram: 0, medio: 0 };
  for (let i = 0; i < quadros.length; i++) {
    for (let j = i + 1; j < quadros.length; j++) {
      const r = fracao(quadros[i], quadros[j]);
      if (r.mudaram > melhor.mudaram) melhor = r;
    }
  }
  const dpr = page.viewportSize() ? await page.evaluate(() => devicePixelRatio) : 1;
  return {
    caixa: `${recorte.width}×${recorte.height}`,
    area: Math.round(recorte.width * dpr * recorte.height * dpr),
    quadroNovo,
    mudaram: +melhor.mudaram.toFixed(1),
    medio: +melhor.medio.toFixed(2),
  };
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

    for (const preset of PRESETS) {
    presetAtual = preset;
    relatorio.push(`# Variante \`${preset}\``, "");
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
        `## Tela ${tela.id} (${tela.viewport.width}×${tela.viewport.height}, dpr ${tela.dpr})`,
        "",
      );

      // ── 1. Os três casos do relato, no nível de mídia que sempre roda
      //       (imagem: `imagens.hero` existe em toda demo) e no nível vídeo.
      for (const nivel of [
        { id: "imagem", video: undefined },
        { id: "video", video },
      ]) {
        relatorio.push(`### Mídia: ${nivel.id}`, "");
        for (const caso of CASOS) {
          const alvo = url({ titulo: caso.titulo, video: nivel.video });
          const inv = await medir(page, alvo);
          const nome = `${presetAtual}-${tela.id}-${nivel.id}-${caso.id}`;
          const foto = await fotoDoTitulo(page, nome);
          relatarCaso(relatorio, `${caso.id} — ${JSON.stringify(caso.titulo)}`, inv, foto);
          const problemas = veredito(inv);
          if (nivel.id === "video" && inv.midia !== "video") {
            problemas.push(`nível de mídia esperado \`video\`, obtido \`${inv.midia}\``);
          }

          // O vídeo está PINTANDO dentro das letras? A geometria acima
          // passaria igual com um canvas em branco perfeitamente alinhado.
          const vida = await vidaNaCaixa(page, alvo, nivel.id === "video");
          if (vida) {
            relatorio.push(
              `- caixa ${vida.caixa} (${vida.area} px de dispositivo) · quadro novo do vídeo: ` +
                `**${vida.quadroNovo ?? "—"}** · pixels da caixa que mudaram: **${vida.mudaram}%** ` +
                `(diferença média ${vida.medio})` +
                (nivel.id === "video" && !CASOS_COM_PROVA_DE_VIDEO.has(caso.id)
                  ? " — _medido, não cobrado: nome curto sintético, ponto cego do headless_"
                  : ""),
              "",
            );
            if (nivel.id === "video") {
              if (vida.quadroNovo === false && CASOS_COM_PROVA_DE_VIDEO.has(caso.id)) {
                problemas.push(
                  `o canvas do título não apresentou quadro novo em ${QUADRO_NOVO_MS}ms — ` +
                    `o vídeo não está pintando dentro das letras`,
                );
              } else if (vida.mudaram < GLIFO_MIN && CASOS_COM_PROVA_DE_VIDEO.has(caso.id)) {
                problemas.push(
                  `vídeo NÃO aparece dentro das letras: o canvas trocou de quadro e só ` +
                    `${vida.mudaram}% da caixa mudou (piso ${GLIFO_MIN}%) — máscara alinhada ` +
                    `sobre um canvas que não é composto`,
                );
              } else if (vida.mudaram > GLIFO_MAX) {
                problemas.push(
                  `vídeo aparece FORA das letras: ${vida.mudaram}% da caixa mudou ` +
                    `(teto ${GLIFO_MAX}%) — a máscara não está recortando`,
                );
              }
            } else if (vida.mudaram > CONTROLE_MAX) {
              // Controle: com o CSS congelado e sem vídeo, nada na caixa
              // pode se mexer. Se mexe, a medida do nível `video` não prova
              // nada sobre o vídeo — está medindo outra coisa.
              problemas.push(
                `nível \`imagem\` com ${vida.mudaram}% da caixa mudando em 450ms ` +
                  `(teto ${CONTROLE_MAX}%) — sobrou animação viva no título, e o controle deixa de valer`,
              );
            }
          }
          if (problemas.length > 0) reprovados.push(`${nome}: ${problemas.join("; ")}`);
        }
      }

      // ── 2. O hero INTEIRO, não só o recorte do título: a caixa do
      //       wordmark mudou de composição, e é aqui que se vê se ela
      //       continua no lugar em relação ao resto da abertura.
      await medir(page, url({ titulo: CASOS[1].titulo, video }));
      const heroPng = path.join(SAIDA, `titulo-${presetAtual}-${tela.id}-hero${marca}.png`);
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
        const hero = path.join(SAIDA, `titulo-${presetAtual}-${tela.id}-repique-${nivel}${marca}.png`);
        await page.screenshot({ path: hero });
        const arquivo = path.join(SAIDA, `titulo-${presetAtual}-${tela.id}-topo-${nivel}${marca}.png`);
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
        const foto = await fotoDoTitulo(page, `${presetAtual}-${tela.id}-fonte-${fonte.id || "padrao"}`);
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
        const nome = `${presetAtual}-${tela.id}-alinhamento-${alinhamento}`;
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
        const nome = `${presetAtual}-${tela.id}-${controle.id}`;
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
