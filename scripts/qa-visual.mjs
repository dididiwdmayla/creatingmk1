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
 *   node scripts/qa-visual.mjs --so=aura,gradiente
 *   node scripts/qa-visual.mjs --so=cores      # só os modos de cor (efeito + LED)
 *   node scripts/qa-visual.mjs --so=secao      # animação ligada/desligada por seção
 *   node scripts/qa-visual.mjs --so=transicao  # a fronteira: antes/durante/depois
 *   node scripts/qa-visual.mjs --so=barra      # cor da barra do navegador (todas as skins)
 *   node scripts/qa-visual.mjs --so=fps        # quadros por segundo no celular (ver abaixo)
 *   node scripts/qa-visual.mjs --so=colapso    # PORTÃO: nenhuma foto com w/h zero (todas as skins)
 *   node scripts/qa-visual.mjs --marca=antes   # sufixo nos arquivos
 *   node scripts/qa-visual.mjs --sem-build     # reusa o .next já buildado
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
/** Chromium do ambiente: a versão que o playwright-core espera não é a instalada. */
const CHROMIUM = process.env.QA_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORTA = Number(process.env.QA_PORTA ?? 3123);
const BASE = `http://127.0.0.1:${PORTA}`;
const VIEWPORT = { width: 1100, height: 700 };

/**
 * PORTÃO DE QUALIDADE DO REGISTRO (`--so=fps`) — a medição que REPROVA.
 * Nenhuma captura mostra travamento; o número aqui é o que separa "efeito
 * bonito" de "efeito que trava o celular de quem abre a demo".
 *
 * A condição é deliberadamente a PIOR que uma demo publicada consegue
 * montar num aparelho modesto:
 *
 *   - viewport de celular (390×844, dpr 2 — o efeito rasteriza no dobro
 *     dos pixels, que é o teto do `devicePixelRatioClamped`);
 *   - CPU limitada em 4× via CDP (`Emulation.setCPUThrottlingRate`), a
 *     distância típica entre a máquina do dev e um Android de entrada;
 *   - intensidade 3, a mais cara;
 *   - **TODOS os cinco modos de cor**, um por coluna da tabela. Antes só o
 *     arco-íris era medido; a rodada da aura mostrou que isso não basta —
 *     um efeito pode passar num modo e reprovar em outro, e o veredito é
 *     POR CÉLULA (modo que reprova é desabilitado, não o efeito inteiro);
 *   - a página **ROLANDO de cima a baixo** durante a janela de medição.
 *     Página parada não exercita o caminho que a pessoa usa: a aura, por
 *     exemplo, tem o alvo das esferas preso ao progresso de scroll, e
 *     rolagem é o momento em que o compositor tem mais o que fazer.
 *
 * CINCO cargas independentes por célula, mediana entre elas. A rodada do
 * editor já tinha achado que uma varredura de uma tacada só dá leituras de
 * 13 a 52 fps para o MESMO estado (ruído de carga da máquina) e passou a
 * medir 3×; aqui, com a CPU limitada em 4×, três ainda deixavam passar
 * outliers de uma carga só (uma leitura de 12,2 fps no meio de duas de 44
 * e 59), então a mediana é de cinco.
 *
 * ## A segunda coluna: SUPERFÍCIE REPINTADA (Mpx/s)
 *
 * fps sozinho passou um efeito quebrado: a aura media 55–60 fps AQUI e
 * travava no celular de verdade. O motivo é metodológico e vale registrar
 * — `Emulation.setCPUThrottlingRate` limita a thread PRINCIPAL, e a
 * rasterização acontece em outra thread (`--num-raster-threads=2` no
 * renderer, mais o processo de GPU). Custo de PINTURA, que é justamente o
 * que derruba um aparelho real, fica invisível pro contador de rAF.
 *
 * A tabela mede então a coisa direto, com `LayerTree.layerPainted`: quantos
 * megapixels o navegador repinta por segundo durante a rolagem. É um número
 * de TRABALHO, independente de quão rápida é esta máquina — a referência é
 * `nenhum` (a própria página), e um efeito só responde pelo que ele soma.
 */
const FPS_VIEWPORT = { width: 390, height: 844 };
const FPS_CPU_THROTTLE = 4;
const FPS_CARGAS = Number(process.env.QA_FPS_CARGAS ?? 5);
/** Piso de aprovação: abaixo disto a célula (efeito × modo) NÃO passa. */
const FPS_MINIMO = 45;
/**
 * Superfície repintada por segundo, em megapixels ACIMA da referência
 * `nenhum`, a partir da qual a célula sai MARCADA. Uma viewport de celular
 * no dpr 2 tem 0,66 Mpx: 40 Mpx/s é ~1 viewport inteira repintada por
 * quadro a 60 Hz, o orçamento que um Android de entrada sustenta rolando.
 * A aura quebrada media +72 Mpx/s; a corrigida, +0,4.
 *
 * **Marca, não reprova** — e a diferença foi aprendida medindo. O veredito
 * do portão é o piso de fps, e só ele: `faiscas` repinta +245 Mpx/s em
 * TODOS os cinco modos, inclusive `tema`, porque o `mix-blend-mode` dos
 * pontos obriga o grupo inteiro a repintar. Isso não é propriedade de um
 * modo de cor — é do efeito, e é anterior a esta rodada. Um teto que
 * reprovasse derrubaria as cinco células de uma vez, o que contradiz a
 * regra do registro ("modo que reprova é desabilitado, não o efeito
 * inteiro") usando um critério que ninguém escolheu. Então a coluna
 * INFORMA: ela é o instrumento que enxerga o custo que o fps não vê nesta
 * máquina (a CPU limitada não alcança a thread de rasterização), e quem
 * decide o que fazer com um número alto é quem lê a tabela.
 */
const REPINTE_ATENCAO_MPXS = 40;
/** px/s da rolagem contínua durante a medição — fling de celular. */
const FPS_ROLAGEM_PXS = 1800;
/** Teto da janela: a página inteira, ou este tempo, o que vier antes. */
const FPS_JANELA_MS = Number(process.env.QA_FPS_JANELA_MS ?? 9000);
/**
 * Os cinco modos de cor (ver src/lib/demos/cores/modos.ts) — as colunas da
 * tabela. `QA_FPS_COR_MODO=tema` restringe a rodada a um modo só, que é o
 * "desligar uma coisa de cada vez" quando uma célula reprova.
 */
const FPS_MODOS = (process.env.QA_FPS_COR_MODO ?? "tema,fixa,transicao,iridescente,arco-iris")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
/** Cores de exemplo dos modos que exigem escolha (o editor sempre manda). */
const FPS_CORES_DO_MODO = {
  fixa: ["#00c2ff"],
  transicao: ["#ff2e88", "#22d3a5", "#ffd23f"],
};

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
 * canvas a cada poucos quadros (ver ondas/Ondas.tsx); se o modo de cor
 * animado parasse de chegar até lá, só uma captura por fase mostraria.
 */
const COR_EFEITOS = ["particulas", "aura", "ondas"];

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

/**
 * A tabela do portão: cada EFEITO × cada MODO DE COR, na condição descrita
 * acima. Devolve os arquivos gerados (uma captura por efeito, a folha de
 * contato e as tabelas em markdown) e imprime tudo — célula abaixo de
 * FPS_MINIMO sai marcada como REPROVADA, e só ela. A superfície repintada
 * sai na tabela ao lado, marcada com ⚠ acima do limiar mas sem reprovar
 * (ver REPINTE_ATENCAO_MPXS).
 */
async function medirFps(browser, pageDaFolha, secret) {
  const gerados = [];
  const ctx = await browser.newContext({
    viewport: FPS_VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
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
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: FPS_CPU_THROTTLE });

  // Superfície repintada: contada o tempo todo, zerada a cada medição.
  let pinturas = 0;
  let areaPintada = 0;
  cdp.on("LayerTree.layerPainted", (evento) => {
    pinturas++;
    if (evento.clip) areaPintada += evento.clip.width * evento.clip.height;
  });
  await cdp.send("LayerTree.enable");

  /** Uma medição: rola a página inteira contando quadros e pinturas. */
  const medir = async () => {
    pinturas = 0;
    areaPintada = 0;
    const r = await page.evaluate(
      ({ velocidade, maxMs }) =>
        new Promise((resolve) => {
          window.scrollTo(0, 0);
          const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
          let quadros = 0;
          let piorMs = 0;
          let y = 0;
          let inicio = 0;
          let ultimo = 0;
          const passo = (t) => {
            if (inicio === 0) {
              // O primeiro quadro só ancora o relógio — o intervalo até ele
              // inclui o agendamento do rAF, não é quadro de animação.
              inicio = ultimo = t;
              requestAnimationFrame(passo);
              return;
            }
            const dt = t - ultimo;
            ultimo = t;
            quadros++;
            if (dt > piorMs) piorMs = dt;
            y += (velocidade * dt) / 1000;
            window.scrollTo(0, Math.min(max, y));
            const decorrido = t - inicio;
            if (y < max && decorrido < maxMs) requestAnimationFrame(passo);
            else resolve({ fps: (quadros * 1000) / decorrido, ms: decorrido, piorMs });
          };
          requestAnimationFrame(passo);
        }),
      { velocidade: FPS_ROLAGEM_PXS, maxMs: FPS_JANELA_MS },
    );
    return { ...r, mpxs: areaPintada / 1e6 / (r.ms / 1000), pinturasS: pinturas / (r.ms / 1000) };
  };

  // "nenhum" é a referência: o teto que a PÁGINA consegue nesta condição, e
  // a linha de base de repintura. Um efeito só responde pelo que SOMA.
  // QA_FPS_EFEITOS=ondas,aura restringe a tabela — pra iterar num efeito só
  // sem pagar a matriz inteira.
  const alvos = process.env.QA_FPS_EFEITOS?.split(",").map((e) => e.trim()).filter(Boolean) ?? [
    "nenhum",
    ...EFEITOS,
  ];
  /** celulas[efeito][modo] = { fps, medidas, mpxs, piorMs } */
  const celulas = {};
  const itens = [];
  for (const efeito of alvos) {
    celulas[efeito] = {};
    for (const modo of FPS_MODOS) {
      const medidas = [];
      let ultima;
      for (let carga = 0; carga < FPS_CARGAS; carga++) {
        await page.goto(
          url({
            efeito,
            intensidade: 3,
            preset: "norte",
            led: "desligado",
            corModo: modo,
            cores: FPS_CORES_DO_MODO[modo],
          }),
          { waitUntil: "networkidle" },
        );
        // O efeito entra por next/dynamic sem SSR e a página ainda está
        // assentando: medir antes disso mede o carregamento, não o efeito.
        await page.waitForTimeout(1800);
        ultima = await medir();
        medidas.push(ultima.fps);
      }
      medidas.sort((a, b) => a - b);
      const mediana = medidas[Math.floor(medidas.length / 2)];
      celulas[efeito][modo] = { fps: mediana, medidas, mpxs: ultima.mpxs, piorMs: ultima.piorMs };
      console.log(
        `  [fps] ${efeito.padEnd(18)} ${modo.padEnd(12)} mediana ${mediana.toFixed(1).padStart(5)} fps ` +
          `(${medidas.map((m) => m.toFixed(1)).join(" / ")}) · ` +
          `${ultima.mpxs.toFixed(1).padStart(5)} Mpx/s repintados · pior quadro ${ultima.piorMs.toFixed(0)}ms` +
          `${efeito !== "nenhum" && mediana < FPS_MINIMO ? "  ← REPROVADO" : ""}`,
      );
      // A captura é sempre do modo mais caro que a rodada mediu.
      if (modo === FPS_MODOS[FPS_MODOS.length - 1]) {
        const png = path.join(SAIDA, `fps-mobile-${efeito}${marca}.png`);
        await page.screenshot({ path: png });
        gerados.push(png);
        itens.push({ efeito, png });
      }
    }
  }
  await cdp.send("LayerTree.disable");

  const refMpxs = Object.fromEntries(
    FPS_MODOS.map((modo) => [modo, celulas.nenhum?.[modo]?.mpxs ?? 0]),
  );
  // REPROVA é só o piso de fps (ver REPINTE_ATENCAO_MPXS pra por que a
  // superfície repintada marca em vez de reprovar).
  const reprova = (efeito, modo) => {
    if (efeito === "nenhum") return false;
    return celulas[efeito][modo].fps < FPS_MINIMO;
  };
  const atencao = (efeito, modo) => {
    if (efeito === "nenhum") return false;
    return celulas[efeito][modo].mpxs - refMpxs[modo] > REPINTE_ATENCAO_MPXS;
  };
  const linhaDaTabela = (efeito, valor) =>
    `| \`${efeito}\` | ${FPS_MODOS.map((modo) => valor(efeito, modo)).join(" | ")} |`;

  const cabecalho =
    `# Portão de qualidade dos efeitos — celular ${FPS_VIEWPORT.width}×${FPS_VIEWPORT.height} ` +
    `(dpr 2), CPU ${FPS_CPU_THROTTLE}×, intensidade 3, rolando a página inteira\n\n` +
    `Mediana de ${FPS_CARGAS} cargas independentes por célula; rolagem contínua a ` +
    `${FPS_ROLAGEM_PXS} px/s até o fim da página (teto de ${FPS_JANELA_MS}ms). ` +
    `Veredito: **${FPS_MINIMO} fps** em TODO modo de cor — e só isso reprova. ` +
    `A superfície repintada é reportada junto e MARCADA (⚠) acima de ` +
    `**+${REPINTE_ATENCAO_MPXS} Mpx/s** sobre a referência \`nenhum\`, sem reprovar.\n\n`;
  const tabelaFps =
    `## fps (mediana)\n\n| efeito | ${FPS_MODOS.join(" | ")} |\n` +
    `|---|${FPS_MODOS.map(() => "---").join("|")}|\n` +
    alvos
      .map((efeito) =>
        linhaDaTabela(efeito, (e, m) => {
          const v = celulas[e][m].fps.toFixed(1);
          return reprova(e, m) ? `**${v} ✗**` : v;
        }),
      )
      .join("\n");
  const tabelaMpx =
    `\n\n## superfície repintada (Mpx/s, rolando)\n\n| efeito | ${FPS_MODOS.join(" | ")} |\n` +
    `|---|${FPS_MODOS.map(() => "---").join("|")}|\n` +
    alvos
      .map((efeito) =>
        linhaDaTabela(efeito, (e, m) => {
          const v = celulas[e][m].mpxs.toFixed(1);
          return atencao(e, m) ? `${v} ⚠` : v;
        }),
      )
      .join("\n");
  const reprovadas = alvos.flatMap((efeito) =>
    FPS_MODOS.filter((modo) => reprova(efeito, modo)).map((modo) => `\`${efeito}\` × ${modo}`),
  );
  // Efeito cuja superfície repintada estoura em TODO modo medido não tem
  // problema de modo de cor: o custo é dele, e a coluna só informa.
  const marcados = alvos.filter((efeito) => FPS_MODOS.every((modo) => atencao(efeito, modo)));
  const veredito =
    `\n\n## veredito\n\n` +
    (reprovadas.length
      ? `REPROVADAS ${reprovadas.length} célula(s) pelo piso de ${FPS_MINIMO} fps: ${reprovadas.join(", ")}. ` +
        `Modo de cor que reprova é DESABILITADO para aquele efeito — o efeito inteiro não sai do registro.`
      : `Todas as células passam o piso de ${FPS_MINIMO} fps.`) +
    (marcados.length
      ? `\n\nMARCADOS (⚠, não reprovados): ${marcados
          .map((e) => `\`${e}\``)
          .join(", ")} repinta(m) acima de +${REPINTE_ATENCAO_MPXS} Mpx/s em TODOS os modos medidos, ` +
        `inclusive \`tema\` — custo do efeito, não do modo de cor. Decisão de quem lê a tabela.`
      : "");

  const md = path.join(SAIDA, `_fps-mobile${marca}.md`);
  await fs.writeFile(md, `${cabecalho}${tabelaFps}${tabelaMpx}${veredito}\n`);
  gerados.push(md);
  console.log(`\n${cabecalho}${tabelaFps}${tabelaMpx}${veredito}\n`);

  // Folha de contato: a captura de cada efeito NA MESMA condição da tabela.
  const modoDaCaptura = FPS_MODOS[FPS_MODOS.length - 1];
  const porLinha = 5;
  const grade = [];
  for (let i = 0; i < itens.length; i += porLinha) {
    grade.push({
      rotulo: `celular · CPU ${FPS_CPU_THROTTLE}× · i3 · ${modoDaCaptura}`,
      itens: itens.slice(i, i + porLinha).map((item) => ({
        rotulo: `${item.efeito} · ${celulas[item.efeito][modoDaCaptura].fps.toFixed(1)} fps`,
        png: item.png,
      })),
    });
  }
  gerados.push(
    await folhaDeContato(
      pageDaFolha,
      `fps em celular com CPU ${FPS_CPU_THROTTLE}× (intensidade 3, cor ${modoDaCaptura})`,
      "fps-mobile",
      grade,
    ),
  );
  await ctx.close();
  return gerados;
}

/* ── BARRA DO NAVEGADOR (`--so=barra`) ────────────────────────────────
 *
 * A cor da barra NÃO aparece numa captura de tela: quem a pinta é o cromo
 * do navegador, fora da página. Este item é, por isso, uma MEDIÇÃO — e a
 * imagem que se olha no fim é montada a partir dela: a rampa de cor por
 * posição de scroll, desenhada como faixa, uma linha por skin.
 *
 * Três perguntas, uma por requisito:
 *
 *   1. **A troca é rampa, não degrau?** Rolando a página inteira em
 *      passos pequenos, o maior salto de cor entre dois passos
 *      consecutivos tem que ser uma fração da AMPLITUDE da rampa — e o
 *      número de cores DISTINTAS pela página tem que ser grande (um
 *      degrau daria duas ou três).
 *   2. **A barra assume mesmo a cor do que está na tela?** Nos PLATÔS da
 *      rampa — os trechos em que a cor não está mudando, ou seja, onde a
 *      banda de foco está inteira dentro de uma faixa só — a cor da barra
 *      tem que ser exatamente o PIXEL que a página pinta ali. O pixel sai
 *      do PNG nas duas bordas laterais (3px de cada lado, na meia-altura
 *      da tela); as duas têm que CONCORDAR, senão tem conteúdo encostado
 *      na margem (a fileira de fotos do portfólio da tatuagem) e o ponto
 *      não diz qual é o fundo — sai do veredito em vez de virar falso
 *      positivo.
 *
 *      Medir no platô, e não "no meio de cada seção", é o que torna a
 *      checagem CEGA à implementação e livre de ressalva: não pressupõe
 *      que uma seção tenha uma cor só (o rodapé da imobiliária tem duas,
 *      e foi assim que o defeito apareceu) nem que ela seja mais alta que
 *      a tela.
 *   3. **Degrada sem quebrar?** A cor inicial é lida do HTML SERVIDO
 *      (`fetch` cru, sem navegador e sem JavaScript nenhum), que é o que
 *      todo navegador que ignora a atualização dinâmica vai usar; e os
 *      modos fixos são verificados como fixos de verdade — cor certa no
 *      HTML e imóvel ao rolar.
 */
const BARRA_VIEWPORT = { width: 390, height: 844 };
/** Passo da varredura de scroll. 40px dá ~100 leituras numa demo típica. */
const BARRA_PASSO = 40;
/**
 * Teto do salto entre dois passos, como fração da AMPLITUDE da própria
 * rampa (a maior distância por canal entre a cor mais escura e a mais
 * clara que a barra assumiu na página). A fração sai da matemática da
 * transição, não de um chute: o núcleo tem inclinação de pico `2/banda`
 * com `banda = 0,5 × altura da viewport`, então um passo de
 * BARRA_PASSO px move no máximo `2 × 40 / (0,5 × 844) ≈ 0,19` da
 * amplitude. 0,30 é isso com folga pra bordas de seção que caem no meio
 * de um passo — e continua uma ordem de grandeza abaixo do 1,0 que uma
 * troca seca produziria.
 */
const BARRA_SALTO_MAXIMO = 0.3;
/** Quantos platôs por skin recebem captura (o resto é a mesma cor de novo). */
const BARRA_PLATOS_AMOSTRADOS = 8;
/** Todas as skins do registro — a barra é da rota, não de uma skin. */
const BARRA_SKINS = [
  "barbearia-editorial",
  "barbearia2-sul",
  "tatuagem-editorial",
  "tatuagem-pigmento-vivo",
  "lancheria-chapa-burger",
  "imobiliaria-curada",
  "multimarcas-vortice",
  "petshop-focinho-feliz",
];

const corParaRgb = (cor) => {
  const hex = cor.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const rgb = cor.match(/rgba?\(([^)]+)\)/i);
  return rgb ? rgb[1].split(/[\s,/]+/).slice(0, 3).map(Number) : [NaN, NaN, NaN];
};
/** Distância máxima por canal — a medida de "salto de cor" usada aqui. */
const distanciaCor = (a, b) => {
  const [x, y] = [corParaRgb(a), corParaRgb(b)];
  return Math.max(...[0, 1, 2].map((i) => Math.abs(x[i] - y[i])));
};

async function medirBarra(browser, pageDaFolha, secret) {
  const gerados = [];
  const token = criarSessaoToken({ userId: "qa", papel: "admin", versao: 1 }, secret);
  const ctx = await browser.newContext({
    viewport: BARRA_VIEWPORT,
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  await ctx.addCookies([{ name: "radar_session", value: token, url: BASE }]);
  const page = await ctx.newPage();

  const alvoDe = (skin, extra = "") =>
    `${BASE}/interno/demo-qa?skin=${skin}&intro=0&efeito=nenhum&led=desligado${extra}`;
  /** Dois quadros: o listener é throttled por rAF (ler antes do quadro em
   *  que ele roda devolveria o valor do passo anterior — o mesmo defeito
   *  de laço já registrado na rampa da cobertura). */
  const doisQuadros = () =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  /**
   * DEFEITO DO LAÇO, achado na primeira rodada e caro: duas skins
   * (imobiliaria e multimarcas) declaram `html { scroll-behavior: smooth }`.
   * Com isso `window.scrollTo` vira uma ANIMAÇÃO — pedir 9000 e ler dois
   * quadros depois devolvia `scrollY: 89`. As duas apareceram no relatório
   * com "1 cor distinta na página inteira", que lido de fora é exatamente
   * o sintoma de "a barra não acompanha a seção". Não era: a página é que
   * não tinha rolado. O estilo inline vence a regra da folha da skin.
   */
  const desligarScrollSuave = () =>
    page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
    });
  /** Rola e CONFIRMA que chegou (a leitura antes de chegar é o defeito acima). */
  const rolarAte = async (y) => {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await doisQuadros();
    return page.evaluate(() => window.scrollY);
  };
  const lerBarra = () =>
    page.evaluate(() => ({
      meta: document.querySelector('meta[name="theme-color"]')?.content ?? "",
      plano: getComputedStyle(document.body).backgroundColor,
    }));

  const linhas = [];
  const problemas = [];
  /** Ressalvas do LAÇO (o que ele não conseguiu medir), não do produto. */
  const ressalvas = [];

  for (const skin of BARRA_SKINS) {
    /* (3) HTML SERVIDO — sem navegador, sem JavaScript. */
    const html = await (await fetch(alvoDe(skin), { headers: { cookie: `radar_session=${token}` } })).text();
    const metaServida = html.match(/<meta name="theme-color" content="([^"]+)"/i)?.[1] ?? "(ausente)";
    const planoServido = html.match(/body\{background-color:\s*([^ ;!}]+)/i)?.[1] ?? "(ausente)";

    await page.goto(alvoDe(skin), { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    await desligarScrollSuave();

    const paleta = await page.evaluate(() => {
      const raiz = document.querySelector("[style*='--d-bg']");
      const cs = getComputedStyle(raiz);
      return {
        fundo: cs.getPropertyValue("--d-bg").trim(),
        alt: cs.getPropertyValue("--d-bg-alt").trim(),
      };
    });
    const contraste = distanciaCor(paleta.fundo, paleta.alt);

    console.log(`\n[barra] ${skin}`);
    console.log(`  paleta: --d-bg ${paleta.fundo} · --d-bg-alt ${paleta.alt} (contraste ${contraste})`);
    console.log(`  HTML servido (sem JS): meta ${metaServida} · plano do body ${planoServido}`);
    if (distanciaCor(metaServida, paleta.fundo) > 1) {
      problemas.push(`${skin}: meta servida ${metaServida} != --d-bg ${paleta.fundo}`);
    }
    if (distanciaCor(planoServido, paleta.fundo) > 1) {
      problemas.push(`${skin}: plano servido ${planoServido} != --d-bg ${paleta.fundo}`);
    }

    /* (1) A rampa pela página inteira. */
    const altura = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    const rampa = [];
    for (let y = 0; y <= altura; y += BARRA_PASSO) {
      // A posição REAL, não a pedida: o `scroll anchoring` do Chromium
      // desloca o scroll alguns px quando uma imagem assenta e muda a
      // altura do documento (medido: pedir 8440 e parar em 8522). Isso
      // não atrapalha a varredura — atrapalharia julgá-la como se o passo
      // tivesse sido de 40px. O que a análise do salto precisa é que o
      // passo EFETIVO seja pequeno, e é isso que a guarda abaixo cobra.
      const chegou = await rolarAte(y);
      const anterior = rampa[rampa.length - 1];
      // Passo EFETIVO maior que o pedido: o par seguinte não é comparável
      // com o teto (que é derivado de um passo de BARRA_PASSO). É
      // ressalva do laço, não defeito do produto — por isso sai numa
      // lista separada dos PROBLEMAS.
      const comparavel = !anterior || chegou - anterior.y <= BARRA_PASSO * 2.5;
      if (!comparavel) {
        ressalvas.push(`${skin}: a página pulou de ${anterior.y} para ${chegou} (scroll anchoring)`);
      }
      rampa.push({ y: chegou, cor: (await lerBarra()).meta, comparavel });
    }
    let maiorSalto = 0;
    for (let i = 1; i < rampa.length; i++) {
      if (!rampa[i].comparavel) continue;
      maiorSalto = Math.max(maiorSalto, distanciaCor(rampa[i].cor, rampa[i - 1].cor));
    }
    // Amplitude da própria rampa: é contra ela que o salto é julgado (a
    // página pode ter faixas fora do par fundo/alt — a `avaliacao` da
    // multimarcas usa o destaque como fundo).
    let amplitude = 0;
    for (const a of rampa) {
      for (const b of rampa) amplitude = Math.max(amplitude, distanciaCor(a.cor, b.cor));
    }
    const teto = Math.max(2, Math.round(amplitude * BARRA_SALTO_MAXIMO));
    console.log(
      `  rampa: ${rampa.length} passos de ${BARRA_PASSO}px · ${new Set(rampa.map((r) => r.cor)).size} cores distintas · amplitude ${amplitude} · maior salto ${maiorSalto} (teto ${teto})`,
    );
    if (maiorSalto > teto) {
      problemas.push(`${skin}: salto de ${maiorSalto} entre dois passos (teto ${teto}) — troca seca?`);
    }

    /* (2) Os PLATÔS: onde a cor não está mudando, ela tem que ser o pixel. */
    const platos = [];
    for (let i = 1; i < rampa.length - 1; i++) {
      // Vizinhos idênticos = a banda de foco está inteira numa faixa só.
      if (rampa[i].cor !== rampa[i - 1].cor || rampa[i].cor !== rampa[i + 1].cor) continue;
      const anterior = platos[platos.length - 1];
      if (anterior && anterior.cor === rampa[i].cor && rampa[i].y - anterior.fim <= BARRA_PASSO * 2.5) {
        anterior.fim = rampa[i].y;
      } else {
        platos.push({ cor: rampa[i].cor, inicio: rampa[i].y, fim: rampa[i].y });
      }
    }
    // Um ponto por platô, no meio dele, dos mais LONGOS — uma captura por
    // platô já cobre toda cor que a página apresenta parada.
    const amostrados = platos
      .slice()
      .sort((a, b) => b.fim - b.inicio - (a.fim - a.inicio))
      .slice(0, BARRA_PLATOS_AMOSTRADOS)
      .sort((a, b) => a.inicio - b.inicio);
    for (const plato of amostrados) {
      const meio = Math.round((plato.inicio + plato.fim) / 2);
      await rolarAte(meio);
      await page.waitForTimeout(250);
      const { meta } = await lerBarra();
      const png = path.join(SAIDA, `_barra-px-${skin}-${meio}${marca}.png`);
      await page.screenshot({ path: png });
      const img = lerPng(png);
      await fs.unlink(png);
      const amostra = (x) => {
        const off = (Math.floor(img.h / 2) * img.w + x) * img.canais;
        return `rgb(${img.px[off]},${img.px[off + 1]},${img.px[off + 2]})`;
      };
      const esquerda = amostra(3);
      const direita = amostra(img.w - 4);
      const concordam = distanciaCor(esquerda, direita) <= 2;
      const erro = distanciaCor(meta, esquerda);
      const marcador = !concordam
        ? `  (conteúdo na margem: ${direita} — não conclusivo)`
        : erro > 8
          ? "  <<< DIVERGE"
          : "";
      console.log(
        `    platô y=${String(plato.inicio).padStart(5)}–${String(plato.fim).padEnd(5)} barra ${meta}  pixel ${esquerda.padEnd(18)} erro ${String(erro).padStart(3)}${marcador}`,
      );
      if (concordam && erro > 8) {
        problemas.push(`${skin}: no platô y=${meio} a barra é ${meta} e a tela é ${esquerda} (erro ${erro})`);
      }
    }
    linhas.push({ skin, rampa: rampa.map((r) => r.cor), paleta });

    /* (3b) Os modos fixos, fixos mesmo. */
    for (const [modo, extra, esperado] of [
      ["fundo", "&barra=fundo", paleta.fundo],
      ["destaque", "&barra=destaque", null],
      ["personalizada", "&barra=personalizada&barraCor=%2300c2ff", "#00c2ff"],
    ]) {
      const htmlFixo = await (
        await fetch(alvoDe(skin, extra), { headers: { cookie: `radar_session=${token}` } })
      ).text();
      const servida = htmlFixo.match(/<meta name="theme-color" content="([^"]+)"/i)?.[1] ?? "(ausente)";
      await page.goto(alvoDe(skin, extra), { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      await desligarScrollSuave();
      const antes = (await lerBarra()).meta;
      await rolarAte(await page.evaluate(() => document.documentElement.scrollHeight));
      await page.waitForTimeout(200);
      const depois = (await lerBarra()).meta;
      const imovel = antes === depois;
      console.log(
        `  modo ${modo.padEnd(14)} HTML ${servida} · topo ${antes} · fim ${depois} ${imovel ? "(imóvel)" : "<<< MEXEU"}`,
      );
      if (!imovel) problemas.push(`${skin}/${modo}: a barra mudou ao rolar (${antes} → ${depois})`);
      if (esperado && distanciaCor(servida, esperado) > 1) {
        problemas.push(`${skin}/${modo}: HTML servido ${servida} != esperado ${esperado}`);
      }
    }
  }

  /* A imagem: cada rampa vira uma faixa de cor, uma linha por skin. */
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111;color:#eee;font:13px system-ui">
    <div style="padding:10px 14px;font-size:15px;font-weight:600">Cor da barra do navegador ao rolar a página (topo → fim)</div>
    ${linhas
      .map(
        (l) => `<div style="padding:6px 14px">
          <div style="margin-bottom:4px;opacity:.75">${l.skin} — ${l.paleta.fundo} / ${l.paleta.alt}</div>
          <div style="display:flex;height:34px;border:1px solid #333">
            ${l.rampa.map((c) => `<div style="flex:1;background:${c}"></div>`).join("")}
          </div>
        </div>`,
      )
      .join("")}
  </body>`;
  await pageDaFolha.setViewportSize({ width: 1100, height: 140 + linhas.length * 62 });
  await pageDaFolha.setContent(html);
  const folha = path.join(SAIDA, `_folha-barra${marca}.png`);
  await pageDaFolha.screenshot({ path: folha, fullPage: true });
  await pageDaFolha.setViewportSize(VIEWPORT);
  gerados.push(folha);

  console.log(
    problemas.length
      ? `\n[barra] ${problemas.length} PROBLEMA(S):\n  ${problemas.join("\n  ")}`
      : "\n[barra] sem divergências: barra == pixel no platô, rampa sem degrau, modos fixos imóveis.",
  );
  if (ressalvas.length) {
    console.log(`[barra] ${ressalvas.length} ressalva(s) do laço:\n  ${ressalvas.join("\n  ")}`);
  }
  await ctx.close();
  return gerados;
}

/* ── COLAPSO DE IMAGEM (`--so=colapso`) — PORTÃO, não medição ──────────
 *
 * Bug real encontrado nesta rodada: `imobiliaria-curada` tinha `h-full` E
 * uma altura fixa (`h-[420px] sm:h-[500px]`) na MESMA className do card do
 * bento "Imóveis em destaque" — no CSS compilado por `next build`,
 * `.h-full{height:100%}` vem DEPOIS de `.h-\[420px\]{height:420px}` e
 * vence por ordem de geração (mesma especificidade), então o card — e a
 * foto dentro dele — colapsava pra `height:0` em produção. Invisível numa
 * captura de tela isolada (não tem "antes/depois" pra comparar sem saber
 * que o bug existe) e invisível em `next dev` (a ordem de geração do CSS
 * do Turbopack em dev não reproduziu o defeito — só apareceu em
 * `next build && next start`). Só uma medição de geometria pega isso.
 *
 * Ao contrário de `--so=fps`/`--so=barra` (MARCAM/REPROVAM célula por
 * célula sem interromper o laço — a regra do registro é "modo que reprova
 * é desabilitado, não o efeito inteiro"), aqui não existe gradação: um
 * elemento com foto ou está visível ou não está. Por isso este é o único
 * item do laço que LANÇA (interrompe o processo com código de saída ≠ 0)
 * em vez de só reportar — é o item pensado pra rodar em CI/pre-commit.
 */
async function verificarColapsoDeImagem(browser, secret) {
  const token = criarSessaoToken({ userId: "qa", papel: "admin", versao: 1 }, secret);
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  await ctx.addCookies([{ name: "radar_session", value: token, url: BASE }]);
  const page = await ctx.newPage();
  const problemas = [];
  let totalSlots = 0;

  for (const skin of BARRA_SKINS) {
    // imagensModo "foto": é onde o bug apareceu (o SVG do exemplo sempre
    // teve dimensão intrínseca — a foto real, atrás de um <div data-card>
    // com CSS de altura, é o caminho que colapsa).
    await page.goto(`${BASE}/interno/demo-qa?skin=${skin}&imagens=foto&intro=0`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
    });

    const nomes = await page
      .locator("[data-demo-slot^='imagens.']")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-demo-slot")));

    for (const nome of nomes) {
      totalSlots++;
      const loc = page.locator(`[data-demo-slot="${nome}"]`).first();
      // scrollIntoView: alguns slots só ganham dimensão real depois do
      // lazy-load do next/image entrar na viewport (ver imovel-N acima).
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(60);
      const box = await loc.boundingBox();
      if (!box || box.width <= 0 || box.height <= 0) {
        problemas.push(`${skin} / ${nome}: ${box ? `${box.width}x${box.height}` : "sem bounding box"}`);
      }
    }
  }

  await ctx.close();
  console.log(`[colapso] ${totalSlots} slot(s) de imagem checados em ${BARRA_SKINS.length} skins.`);
  if (problemas.length > 0) {
    throw new Error(
      `[colapso] ${problemas.length} elemento(s) com foto renderizando com largura ou altura zero:\n  ${problemas.join("\n  ")}`,
    );
  }
  console.log("[colapso] ok — nenhum elemento com foto colapsado.");
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

    /* ── Cor da barra do navegador ──────────────────────────────── */
    if (querido("barra")) gerados.push(...(await medirBarra(browser, page, secret)));

    /* ── Quadros por segundo em celular com CPU limitada ────────── */
    if (querido("fps")) gerados.push(...(await medirFps(browser, page, secret)));

    /* ── Portão: nenhuma foto com largura/altura zero ─────────────── */
    if (querido("colapso")) await verificarColapsoDeImagem(browser, secret);

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
