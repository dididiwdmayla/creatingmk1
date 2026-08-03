#!/usr/bin/env node
/**
 * Laço de verificação VISUAL da camada decorativa das demos (efeitos de
 * fundo + estilos de LED). Nenhum teste unitário consegue julgar "aresta
 * dura", "opacidade alta demais" ou "polígono reconhecível" — este script
 * existe pra produzir a evidência que se olha.
 *
 * O que ele faz:
 *   1. sobe o app real (`next build && next start`) com um APP_PASSWORD
 *      efêmero, gerado aqui;
 *   2. cunha um cookie de sessão ASSINADO com esse mesmo segredo — o
 *      proxy (Edge) só verifica a assinatura HMAC, nunca o Firestore
 *      (ver src/lib/auth.ts + src/proxy.ts), então a rota-harness
 *      /interno/demo-qa abre sem banco, sem lead e sem demo salva;
 *   3. percorre a matriz (efeito × intensidade × tema, LED estilo × nível
 *      × tema × scroll) capturando um PNG por estado em qa-shots/;
 *   4. monta uma folha de contato por item (grade tema × intensidade),
 *      renderizada pelo próprio Chromium a partir dos PNGs — é o que se
 *      abre pra avaliar um item inteiro de uma vez.
 *
 * Uso:
 *   node scripts/qa-visual.mjs                 # matriz inteira
 *   node scripts/qa-visual.mjs --so=led        # só os estilos de LED
 *   node scripts/qa-visual.mjs --so=veios,gradiente
 *   node scripts/qa-visual.mjs --so=cores      # só os modos de cor (efeito + LED)
 *   node scripts/qa-visual.mjs --so=secao      # animação ligada/desligada por seção
 *   node scripts/qa-visual.mjs --so=transicao  # a fronteira: antes/durante/depois
 *   node scripts/qa-visual.mjs --marca=antes   # sufixo nos arquivos
 *   node scripts/qa-visual.mjs --sem-build     # reusa o .next já buildado
 */

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = path.join(RAIZ, "qa-shots");
/** Chromium do ambiente: a versão que o playwright-core espera não é a instalada. */
const CHROMIUM = process.env.QA_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORTA = Number(process.env.QA_PORTA ?? 3123);
const BASE = `http://127.0.0.1:${PORTA}`;
const VIEWPORT = { width: 1100, height: 700 };

const SKIN = "barbearia-editorial";
/** Presets da skin acima: um escuro, um claro (ver components/demos/barbearia/themes.ts). */
const TEMAS = [
  { id: "norte", rotulo: "escuro" },
  { id: "creme", rotulo: "claro" },
];
const EFEITOS = [
  "aura",
  "grao",
  "gradiente",
  "particulas",
  "veios",
  "filotaxia",
  "ondas",
  "faiscas",
  "varredura-de-luz",
];
const INTENSIDADES = [1, 2, 3];
const LED_ESTILOS = ["barra", "dissipado", "cantos", "moldura"];
/**
 * `Theme.led` tem só DOIS níveis acesos (o terceiro valor é "desligado") —
 * não existe um nível 3 de LED pra capturar. A matriz de LED usa os dois
 * níveis reais no lugar do eixo de 3 intensidades dos efeitos.
 */
const LED_NIVEIS = ["sutil", "marcante"];

const args = process.argv.slice(2);
const opcao = (nome) => args.find((a) => a.startsWith(`--${nome}=`))?.split("=").slice(1).join("=");
const temFlag = (nome) => args.includes(`--${nome}`);
const marca = opcao("marca") ? `-${opcao("marca")}` : "";
const filtro = opcao("so")?.split(",").map((s) => s.trim()).filter(Boolean);

function querido(id) {
  if (!filtro) return true;
  return (
    filtro.includes(id) ||
    (filtro.includes("led") && id.startsWith("led-")) ||
    (filtro.includes("cores") && id.startsWith("cores-"))
  );
}

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

/**
 * O segredo de sessão é sorteado a cada rodada: um servidor sobrando de uma
 * rodada anterior ainda ocupando a porta aceitaria a conexão e recusaria o
 * cookie novo — capturas viram tela de login. Falha aqui, antes de subir.
 */
async function exigirPortaLivre(url) {
  try {
    await fetch(url, { redirect: "manual" });
  } catch {
    return;
  }
  throw new Error(
    `porta ${PORTA} já ocupada (servidor de uma rodada anterior?). Encerre-o ou use QA_PORTA=<outra>.`,
  );
}

async function esperarServidor(url, timeoutMs = 120000) {
  const limite = Date.now() + timeoutMs;
  while (Date.now() < limite) {
    try {
      // Qualquer resposta HTTP serve: 307 pro /login já prova que o Next subiu.
      await fetch(url, { redirect: "manual" });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`servidor não respondeu em ${url}`);
}

/** Seção usada nos itens de ANIMAÇÃO POR SEÇÃO (skin barbearia-editorial). */
const SECAO_ALVO = "filosofia";

function url({
  efeito,
  intensidade,
  led,
  ledEstilo,
  preset,
  corModo,
  cores,
  ledCorModo,
  ledCores,
  semAnim,
}) {
  const q = new URLSearchParams({ skin: SKIN, preset, intro: "0" });
  if (efeito) q.set("efeito", efeito);
  if (intensidade !== undefined) q.set("intensidade", String(intensidade));
  if (led) q.set("led", led);
  if (ledEstilo) q.set("ledEstilo", ledEstilo);
  if (corModo) q.set("corModo", corModo);
  if (cores) q.set("cores", cores.join(","));
  if (ledCorModo) q.set("ledCorModo", ledCorModo);
  if (ledCores) q.set("ledCores", ledCores.join(","));
  if (semAnim) q.set("semAnim", semAnim);
  return `${BASE}/interno/demo-qa?${q}`;
}

/**
 * MODOS DE COR (ver src/lib/demos/cores/modos.ts). Os três animados só
 * podem ser julgados em MAIS DE UM instante — uma captura sozinha não
 * distingue "cor fixa" de "cor que muda devagar". Cada um vira três
 * capturas do MESMO estado com o relógio da animação de cor fixado em
 * fases diferentes do ciclo (ver `congelarCores`), lado a lado na folha.
 */
const COR_MODOS = [
  { id: "fixa", cores: ["#00c2ff"], fases: [0] },
  { id: "transicao", cores: ["#ff2e88", "#22d3a5", "#ffd23f"], fases: [0, 0.34, 0.67] },
  // 0 / 0.25 / 0.75 (não 0.5): o ciclo do iridescente é 0 → +16° → 0 →
  // -16° → 0, então a fase 0.5 é IGUAL à 0 e a folha mostraria dois
  // estados no lugar de três.
  { id: "iridescente", fases: [0, 0.25, 0.75] },
  { id: "arco-iris", fases: [0, 0.33, 0.66] },
];
/**
 * Efeitos representativos: um por técnica de pintura (CSS, blob, SVG,
 * canvas). `ondas` está aqui porque é o único que NÃO recebe a cor como
 * string CSS interpolada no markup — ele lê a `color` computada do próprio
 * canvas a cada poucos desenhos (ver ondas/Ondas.tsx); se o modo de cor
 * animado parasse de chegar até lá, só uma captura por fase mostraria.
 */
const COR_EFEITOS = ["particulas", "aura", "veios", "ondas"];

/**
 * Efeitos com janela de "aceso" curta (a varredura ocupa ~14% do ciclo,
 * a faísca vive menos de 1s) não podem ser julgados por uma captura em
 * instante aleatório: fixa o relógio das animações CSS num ponto DENTRO da
 * janela visível, via WAAPI. Ver ARCHITECTURE.md, "Verificação da UI".
 */
const FASE_POR_EFEITO = {
  // A passada ocupa os primeiros 14% do ciclo e percorre 340vw; o feixe
  // nasce em -60vw, então ~85vw de deslocamento é o instante em que ele
  // está no meio da tela: 0.14 × 85/340 ≈ 0.035.
  "varredura-de-luz": 0.035,
  faiscas: 0.45,
};

/**
 * Fixa o relógio SÓ da animação de cor (`d-cores-*`) numa fase do ciclo.
 * Sem isso, a captura pega um instante aleatório de um ciclo de 20-42s e
 * duas fotos do mesmo modo saem praticamente iguais — o que não prova
 * nada sobre a cor estar mudando.
 */
async function congelarCores(page, fase) {
  await page.evaluate((f) => {
    for (const anim of document.getAnimations()) {
      if (!String(anim.animationName ?? "").startsWith("d-cores-")) continue;
      const ciclo = anim.effect?.getComputedTiming?.().duration;
      if (typeof ciclo !== "number" || !Number.isFinite(ciclo) || ciclo <= 0) continue;
      anim.pause();
      anim.currentTime = ciclo * f;
    }
  }, fase);
  await page.waitForTimeout(150);
}

async function capturar(page, alvo, arquivo) {
  await page.goto(alvo, { waitUntil: "networkidle" });
  // O efeito entra por next/dynamic sem SSR — precisa de um beat pra montar.
  await page.waitForTimeout(700);
  const fase = FASE_POR_EFEITO[alvo.match(/efeito=([^&]+)/)?.[1] ?? ""];
  if (fase !== undefined) {
    await page.evaluate((f) => {
      for (const anim of document.getAnimations()) {
        // SÓ as animações da camada de efeito: congelar as da própria skin
        // (revelações de seção, hover) mudaria o conteúdo por baixo e a
        // captura deixaria de ser comparável com o baseline.
        if (!String(anim.animationName ?? "").startsWith("d-efeito-")) continue;
        const t = anim.effect?.getComputedTiming?.();
        const ciclo = t?.duration;
        if (typeof ciclo !== "number" || !Number.isFinite(ciclo) || ciclo <= 0) continue;
        const delay = Number(t.delay) || 0;
        anim.pause();
        // `currentTime` corre na linha do tempo da animação, que só entra no
        // ciclo DEPOIS do delay — sem somá-lo, um delay de 2s deixa a captura
        // presa na fase de espera (nada desenhado) por mais alta que seja a
        // fração pedida. Os efeitos usam delay NEGATIVO pra defasar cópias, o
        // que levaria a um currentTime negativo (inválido): avança ciclos
        // inteiros até ficar positivo — a fase dentro do ciclo é a mesma.
        const ciclosExtras = Math.ceil(Math.max(0, -delay) / ciclo);
        anim.currentTime = delay + ciclo * (ciclosExtras + f);
      }
    }, fase);
    await page.waitForTimeout(120);
  }
  const destino = path.join(SAIDA, `${arquivo}${marca}.png`);
  await page.screenshot({ path: destino });
  return destino;
}

/** Folha de contato: os PNGs de um item numa grade só, montada no browser. */
async function folhaDeContato(page, titulo, arquivo, linhas) {
  const cells = await Promise.all(
    linhas.map(async (linha) => ({
      rotulo: linha.rotulo,
      itens: await Promise.all(
        linha.itens.map(async (item) => ({
          rotulo: item.rotulo,
          src: `data:image/png;base64,${(await fs.readFile(item.png)).toString("base64")}`,
        })),
      ),
    })),
  );
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111;color:#eee;font:13px system-ui">
    <div style="padding:10px 14px;font-size:15px;font-weight:600">${titulo}</div>
    ${cells
      .map(
        (linha) => `<div style="display:flex;gap:6px;padding:0 14px 10px">${linha.itens
          .map(
            (item) => `<figure style="margin:0;flex:1">
              <figcaption style="padding:2px 0;color:#9a9a9a">${linha.rotulo} · ${item.rotulo}</figcaption>
              <img src="${item.src}" style="width:100%;display:block;border:1px solid #333">
            </figure>`,
          )
          .join("")}</div>`,
      )
      .join("")}
  </body>`;
  await page.setContent(html);
  await page.waitForTimeout(150);
  const destino = path.join(SAIDA, `_folha-${arquivo}${marca}.png`);
  await page.screenshot({ path: destino, fullPage: true });
  return destino;
}

async function main() {
  await fs.mkdir(SAIDA, { recursive: true });
  const secret = crypto.randomBytes(16).toString("hex");
  const env = { ...process.env, APP_PASSWORD: secret, PORT: String(PORTA), NODE_ENV: undefined };

  await exigirPortaLivre(BASE);
  if (!temFlag("sem-build")) await executar("npx", ["next", "build"], env);

  const servidor = spawn("npx", ["next", "start", "-p", String(PORTA)], {
    cwd: RAIZ,
    env,
    stdio: ["ignore", "inherit", "inherit"],
    detached: true, // grupo próprio, pra `encerrar` levar o filho junto
  });
  // `next start` deixa um filho (o servidor de verdade) que sobrevive ao
  // SIGTERM do wrapper — mata o grupo inteiro, senão a porta fica presa.
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

  const gerados = [];
  try {
    await esperarServidor(BASE);
    const browser = await chromium.launch({ executablePath: CHROMIUM });
    const ctx = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      // reduced-motion NÃO reduzido: as capturas precisam do estado animado.
      reducedMotion: "no-preference",
    });
    await ctx.addCookies([
      {
        name: "radar_session",
        value: criarSessaoToken({ userId: "qa", papel: "admin", versao: 1 }, secret),
        url: BASE,
      },
    ]);
    const page = await ctx.newPage();

    // Guarda: se o cookie deixar de ser aceito (mudança em auth.ts/proxy.ts),
    // toda captura viraria a tela de login sem ninguém perceber.
    await page.goto(url({ preset: "norte" }), { waitUntil: "domcontentloaded" });
    if (new URL(page.url()).pathname !== "/interno/demo-qa") {
      throw new Error(`sessão recusada — caiu em ${page.url()} (ver criarSessaoToken em src/lib/auth.ts)`);
    }

    for (const efeito of ["nenhum", ...EFEITOS]) {
      if (!querido(efeito)) continue;
      const linhas = [];
      for (const tema of TEMAS) {
        const itens = [];
        for (const intensidade of efeito === "nenhum" ? [1] : INTENSIDADES) {
          const nome = `efeito-${efeito}-i${intensidade}-${tema.rotulo}`;
          const png = await capturar(
            page,
            url({ efeito, intensidade, preset: tema.id, led: "desligado" }),
            nome,
          );
          gerados.push(png);
          itens.push({ rotulo: `intensidade ${intensidade}`, png });
        }
        linhas.push({ rotulo: tema.rotulo, itens });
      }
      gerados.push(await folhaDeContato(page, `Efeito: ${efeito}`, `efeito-${efeito}`, linhas));
    }

    for (const estilo of LED_ESTILOS) {
      const id = `led-${estilo}`;
      if (!querido(id)) continue;
      const linhas = [];
      for (const tema of TEMAS) {
        const itens = [];
        for (const nivel of LED_NIVEIS) {
          const nome = `led-${estilo}-${nivel}-${tema.rotulo}`;
          const png = await capturar(
            page,
            url({ efeito: "nenhum", led: nivel, ledEstilo: estilo, preset: tema.id }),
            nome,
          );
          gerados.push(png);
          itens.push({ rotulo: nivel, png });
        }
        // --d-led-scroll move o ponto mais brilhante: o meio da página é o
        // único ponto em que "moldura"/"cantos" mostram o estado do meio.
        await page.goto(url({ efeito: "nenhum", led: "marcante", ledEstilo: estilo, preset: tema.id }), {
          waitUntil: "networkidle",
        });
        await page.evaluate(() =>
          window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) / 2),
        );
        await page.waitForTimeout(400);
        const meio = path.join(SAIDA, `led-${estilo}-marcante-meio-${tema.rotulo}${marca}.png`);
        await page.screenshot({ path: meio });
        gerados.push(meio);
        itens.push({ rotulo: "marcante · scroll 50%", png: meio });
        linhas.push({ rotulo: tema.rotulo, itens });
      }
      gerados.push(await folhaDeContato(page, `LED: ${estilo}`, id, linhas));
    }

    /* ── Modos de cor: efeito de fundo ──────────────────────────── */
    for (const efeito of COR_EFEITOS) {
      const id = `cores-${efeito}`;
      if (!querido(id)) continue;
      const linhas = [];
      for (const tema of TEMAS) {
        // Linha de referência: o MESMO efeito no modo "do tema".
        const base = await capturar(
          page,
          url({ efeito, intensidade: 3, preset: tema.id, led: "desligado" }),
          `cores-${efeito}-tema-${tema.rotulo}`,
        );
        gerados.push(base);
        linhas.push({ rotulo: `${tema.rotulo} · do tema`, itens: [{ rotulo: "—", png: base }] });

        for (const modo of COR_MODOS) {
          const itens = [];
          for (const fase of modo.fases) {
            await page.goto(
              url({
                efeito,
                intensidade: 3,
                preset: tema.id,
                led: "desligado",
                corModo: modo.id,
                cores: modo.cores,
              }),
              { waitUntil: "networkidle" },
            );
            await page.waitForTimeout(700);
            await congelarCores(page, fase);
            const png = path.join(
              SAIDA,
              `cores-${efeito}-${modo.id}-f${String(fase).replace(".", "")}-${tema.rotulo}${marca}.png`,
            );
            await page.screenshot({ path: png });
            gerados.push(png);
            itens.push({ rotulo: `fase ${fase}`, png });
          }
          linhas.push({ rotulo: `${tema.rotulo} · ${modo.id}`, itens });
        }
      }
      gerados.push(await folhaDeContato(page, `Modos de cor: ${efeito}`, id, linhas));
    }

    /* ── Modos de cor: LED ──────────────────────────────────────── */
    if (querido("cores-led")) {
      const linhas = [];
      for (const tema of TEMAS) {
        const base = await capturar(
          page,
          url({ efeito: "nenhum", led: "marcante", ledEstilo: "moldura", preset: tema.id }),
          `cores-led-tema-${tema.rotulo}`,
        );
        gerados.push(base);
        linhas.push({ rotulo: `${tema.rotulo} · do tema`, itens: [{ rotulo: "—", png: base }] });

        for (const modo of COR_MODOS) {
          const itens = [];
          for (const fase of modo.fases) {
            await page.goto(
              url({
                efeito: "nenhum",
                led: "marcante",
                ledEstilo: "moldura",
                preset: tema.id,
                ledCorModo: modo.id,
                ledCores: modo.cores,
              }),
              { waitUntil: "networkidle" },
            );
            await page.waitForTimeout(500);
            await congelarCores(page, fase);
            const png = path.join(
              SAIDA,
              `cores-led-${modo.id}-f${String(fase).replace(".", "")}-${tema.rotulo}${marca}.png`,
            );
            await page.screenshot({ path: png });
            gerados.push(png);
            itens.push({ rotulo: `fase ${fase}`, png });
          }
          linhas.push({ rotulo: `${tema.rotulo} · ${modo.id}`, itens });
        }
      }
      gerados.push(await folhaDeContato(page, "Modos de cor: LED (moldura)", "cores-led", linhas));
    }

    /* ── Animação por seção: entrada com × sem ──────────────────── */
    if (querido("secao")) {
      const linhas = [];
      for (const tema of TEMAS) {
        const itens = [];
        for (const variante of [
          { id: "com-animacao", semAnim: undefined },
          { id: "sem-animacao", semAnim: SECAO_ALVO },
        ]) {
          await page.goto(
            url({ efeito: "nenhum", preset: tema.id, led: "desligado", semAnim: variante.semAnim }),
            { waitUntil: "networkidle" },
          );
          // Rola até a seção alvo entrar na viewport: é o instante em que
          // a entrada dispara. A captura sai logo depois,
          // ainda dentro da janela da animação — com animação a seção está
          // translúcida/deslocada; sem animação já está sólida no lugar.
          const medida = await page.evaluate((alvo) => {
            const el = document.querySelector(`[data-d-secao="${alvo}"]`);
            if (!el) return { achou: false };
            const topoDoc = el.getBoundingClientRect().top + window.scrollY;
            // 0.6 da viewport: a seção fica visível na metade de baixo da
            // captura (e não logo abaixo da dobra), então a diferença
            // aparece na IMAGEM, não só no número medido.
            window.scrollTo(0, topoDoc - window.innerHeight * 0.6);
            const filho = el.firstElementChild;
            return {
              achou: true,
              anim: el.getAttribute("data-d-secao-anim"),
              // Wrapper de entrada é um elemento a mais do motion: sem
              // animação a seção é filha DIRETA do marcador.
              filhoDireto: filho?.tagName,
              opacidade: filho ? getComputedStyle(filho).opacity : null,
            };
          }, SECAO_ALVO);
          await page.waitForTimeout(160);
          const depois = await page.evaluate((alvo) => {
            const filho = document.querySelector(`[data-d-secao="${alvo}"]`)?.firstElementChild;
            return filho ? getComputedStyle(filho).opacity : null;
          }, SECAO_ALVO);
          console.log(
            `  [secao] ${tema.rotulo} ${variante.id}: data-d-secao-anim=${medida.anim} ` +
              `filho=${medida.filhoDireto} opacidade ao entrar=${depois}`,
          );
          const png = path.join(SAIDA, `secao-${variante.id}-${tema.rotulo}${marca}.png`);
          await page.screenshot({ path: png });
          gerados.push(png);
          itens.push({ rotulo: `${variante.id} · opacidade ${depois}`, png });
        }
        linhas.push({ rotulo: tema.rotulo, itens });
      }
      gerados.push(
        await folhaDeContato(page, `Animação por seção (${SECAO_ALVO})`, "secao", linhas),
      );
    }

    /* ── Transição do efeito na fronteira de seção ──────────────── */
    if (querido("transicao")) {
      const linhas = [];
      for (const tema of TEMAS) {
        await page.goto(
          url({
            efeito: "aura",
            intensidade: 3,
            preset: tema.id,
            led: "marcante",
            ledEstilo: "moldura",
            semAnim: SECAO_ALVO,
          }),
          { waitUntil: "networkidle" },
        );
        await page.waitForTimeout(700);

        // Fronteira = topo da seção sem animação, em coordenadas do documento.
        const fronteira = await page.evaluate((alvo) => {
          const el = document.querySelector(`[data-d-secao="${alvo}"]`);
          return el ? el.getBoundingClientRect().top + window.scrollY : null;
        }, SECAO_ALVO);
        if (fronteira === null) throw new Error(`seção "${SECAO_ALVO}" não encontrada`);

        // Inventário das seções marcadas: altura e estado de animação. É o
        // que explica um platô (seção mais curta que a banda de foco nunca
        // zera a camada sozinha) sem precisar adivinhar.
        const marcadas = await page.evaluate(() =>
          [...document.querySelectorAll("[data-d-secao-anim]")].map((el) => ({
            id: el.dataset.dSecao,
            alturaPx: Math.round(el.getBoundingClientRect().height),
            anim: el.dataset.dSecaoAnim,
          })),
        );
        console.log(
          `  [transicao] ${tema.rotulo} — seções marcadas: ` +
            marcadas.map((m) => `${m.id}(${m.alturaPx}px${m.anim === "0" ? ", SEM anim" : ""})`).join(" "),
        );

        // A RAMPA medida: opacidade computada do efeito e do LED em vários
        // pontos de scroll ao redor da fronteira. É o que separa "some de
        // uma vez" (um salto de 1 pra 0 entre dois pontos vizinhos) de
        // "interpola com distância generosa".
        const rampa = [];
        for (let k = -10; k <= 10; k++) {
          const y = fronteira + (k / 10) * VIEWPORT.height;
          // Espera o QUADRO seguinte ao scroll (o listener é throttled por
          // rAF): sem isso a leitura sai atrasada e a tabela mostra valores
          // repetidos que não existem de verdade.
          await page.evaluate(
            (alvo) =>
              new Promise((r) => {
                window.scrollTo(0, alvo);
                requestAnimationFrame(() => requestAnimationFrame(r));
              }),
            Math.max(0, y),
          );
          await page.waitForTimeout(60);
          const medida = await page.evaluate(() => {
            const camada = document.querySelector("[data-d-efeito-camada]");
            const efeito = camada?.querySelector(":scope > div");
            const led = document.querySelector(".d-led-edges");
            return {
              fade: camada ? getComputedStyle(camada).getPropertyValue("--d-efeito-fade").trim() : "",
              efeito: efeito ? Number(getComputedStyle(efeito).opacity) : null,
              led: led ? Number(getComputedStyle(led).opacity) : null,
            };
          });
          rampa.push({ desloc: (k / 10).toFixed(1), ...medida });
        }
        console.log(`  [transicao] ${tema.rotulo} — deslocamento da fronteira (em viewports):`);
        for (const p of rampa) {
          console.log(
            `    ${String(p.desloc).padStart(5)}  fade=${String(p.fade).padEnd(20)} ` +
              `opacidade efeito=${p.efeito}  LED=${p.led}`,
          );
        }
        // A custom property só é ESCRITA quando muda: antes da primeira
        // mudança ela vem vazia e vale o fallback do `var(..., 1)`. Ler
        // vazio como 0 inventaria um salto de 1 que não existe.
        const comoNumero = (v) => (v === "" ? 1 : Number(v));
        const saltos = rampa
          .slice(1)
          .map((p, i) => Math.abs(comoNumero(p.fade) - comoNumero(rampa[i].fade)));
        console.log(`    maior salto entre pontos vizinhos: ${Math.max(...saltos).toFixed(3)}`);

        // Os três momentos pedidos: antes, durante e depois da fronteira.
        const momentos = [
          { id: "antes", desloc: -0.75 },
          { id: "durante", desloc: -0.5 },
          { id: "depois", desloc: -0.25 },
        ];
        const itens = [];
        for (const m of momentos) {
          await page.evaluate(
            (y) => window.scrollTo(0, Math.max(0, y)),
            fronteira + m.desloc * VIEWPORT.height,
          );
          await page.waitForTimeout(250);
          const fade = await page.evaluate(() =>
            getComputedStyle(document.querySelector("[data-d-efeito-camada]")).getPropertyValue(
              "--d-efeito-fade",
            ).trim(),
          );
          const png = path.join(SAIDA, `transicao-${m.id}-${tema.rotulo}${marca}.png`);
          await page.screenshot({ path: png });
          gerados.push(png);
          itens.push({ rotulo: `${m.id} · fade ${Number(fade).toFixed(2)}`, png });
        }
        linhas.push({ rotulo: tema.rotulo, itens });
      }
      gerados.push(
        await folhaDeContato(page, "Transição na fronteira de seção", "transicao", linhas),
      );

      /* Motor vivo e PAUSADO: sai da seção animada, espera, volta — as
         partículas têm que retomar de onde pararam, não reiniciar. */
      await page.goto(
        url({ efeito: "particulas", intensidade: 3, preset: "norte", led: "desligado", semAnim: SECAO_ALVO }),
        { waitUntil: "networkidle" },
      );
      await page.waitForTimeout(900);
      const alvoDaFronteira = await page.evaluate((alvo) => {
        const el = document.querySelector(`[data-d-secao="${alvo}"]`);
        return el.getBoundingClientRect().top + window.scrollY;
      }, SECAO_ALVO);

      const relogio = () =>
        page.evaluate(() =>
          document
            .getAnimations()
            .filter((a) => String(a.animationName ?? "").startsWith("d-efeito-particulas"))
            .slice(0, 4)
            .map((a) => ({ t: Math.round(Number(a.currentTime)), estado: a.playState })),
        );

      const posicaoAnimada = Math.max(0, alvoDaFronteira - VIEWPORT.height * 1.2);
      await page.evaluate((y) => window.scrollTo(0, y), posicaoAnimada);
      await page.waitForTimeout(400);
      const antes = await relogio();
      const pngAntes = path.join(SAIDA, `transicao-motor-antes${marca}.png`);
      await page.screenshot({ path: pngAntes });

      // Fica 2,5s parado DENTRO da seção sem animação (efeito em fade 0).
      // Centro da seção sem animação na banda de foco: fade 0, motor pausado.
      await page.evaluate((y) => window.scrollTo(0, y), alvoDaFronteira - VIEWPORT.height * 0.25);
      await page.waitForTimeout(2500);
      const durante = await relogio();

      await page.evaluate((y) => window.scrollTo(0, y), posicaoAnimada);
      await page.waitForTimeout(400);
      const depois = await relogio();
      const pngDepois = path.join(SAIDA, `transicao-motor-depois${marca}.png`);
      await page.screenshot({ path: pngDepois });
      gerados.push(pngAntes, pngDepois);

      console.log("  [transicao] motor das partículas (currentTime em ms, 4 primeiras):");
      console.log(`    na seção animada:      ${JSON.stringify(antes)}`);
      console.log(`    2,5s na seção SEM anim: ${JSON.stringify(durante)}`);
      console.log(`    de volta na animada:   ${JSON.stringify(depois)}`);
      gerados.push(
        await folhaDeContato(page, "Motor vivo e pausado (partículas)", "transicao-motor", [
          {
            rotulo: "mesmo scroll",
            itens: [
              { rotulo: "antes da excursão", png: pngAntes },
              { rotulo: "depois de 2,5s fora", png: pngDepois },
            ],
          },
        ]),
      );
    }

    await browser.close();
  } finally {
    encerrar();
  }

  console.log(`\n${gerados.length} arquivos em ${SAIDA}`);
  for (const g of gerados) console.log("  " + path.relative(RAIZ, g));
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
