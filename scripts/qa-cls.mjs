#!/usr/bin/env node
/**
 * Laço de MEDIÇÃO DE DESLOCAMENTO DE LAYOUT (CLS — Cumulative Layout
 * Shift), em viewport de celular. Existe porque "elemento que entra depois
 * do primeiro desenho empurra conteúdo já visível" não se julga por teste
 * unitário nem por uma captura de tela isolada (a tela final pode estar
 * perfeita e o caminho até ela ter empurrado tudo três vezes) — precisa da
 * MESMA API que o navegador usa para o Core Web Vital real
 * (`PerformanceObserver` do tipo `layout-shift`), instalada ANTES de
 * qualquer script da página rodar.
 *
 * Três telas, os três lugares em que o relato apareceu:
 *   - `--so=skins`  — rota pública das 8 skins (via harness /interno/demo-qa,
 *     mesma árvore que a rota pública renderiza — ver qa-visual.mjs);
 *   - `--so=editor` — o PREVIEW do editor (o iframe de /demo-preview embutido
 *     em /leads/{id}/demo/editar), não o painel — é ele que reflete o que
 *     será publicado;
 *   - `--so=app`    — as 7 abas principais do Radar (a plataforma autenticada).
 *
 * PORTÃO: por padrão o script LANÇA (código de saída ≠ 0) se qualquer tela
 * pontuar acima de `CLS_LIMIAR` (0.1, o mesmo piso "bom" do Core Web Vital
 * real). Use `--sem-portao` para só medir e reportar sem interromper — é o
 * que a rodada "antes" da correção precisa, já que ela É esperada reprovar.
 *
 * Cada entrada `layout-shift` traz `sources` (até 5 nós que mais
 * contribuíram para AQUELE deslocamento) — o script imprime, por tela, os
 * elementos que mais empurraram conteúdo, não só o número final.
 *
 * ⚠️ PATCH TEMPORÁRIO (aplicado e revertido na MESMA sessão, mesmo esquema
 * de qa-plataforma.mjs/qa-editor.mjs — princípio 2, nenhum caminho de banco
 * falso commitado):
 *
 *   1. em `src/lib/firebase/admin.ts`, no topo de `getDb()`:
 *
 *        if (process.env.RADAR_FAKE_DB === "1") {
 *          return require("@/lib/testing/qa-fake-db").getFakeDb();
 *        }
 *
 *   2. `src/lib/testing/qa-fake-db.ts` — implementa `AppDb` sobre um JSON em
 *      /tmp (não um singleton em memória — mesma armadilha do build de
 *      produção registrada em qa-editor.mjs).
 *
 * `--so=skins` sozinho não precisa do patch (usa o harness sem banco, como
 * `qa-visual.mjs`) — só `--so=editor`/`--so=app` (e a rodada default, que
 * inclui as três).
 *
 * Uso:
 *   node scripts/qa-cls.mjs                  # as três telas, PORTÃO ligado
 *   node scripts/qa-cls.mjs --so=skins
 *   node scripts/qa-cls.mjs --so=editor
 *   node scripts/qa-cls.mjs --so=app
 *   node scripts/qa-cls.mjs --sem-portao      # só mede e reporta
 *   node scripts/qa-cls.mjs --marca=antes     # rótulo no relatório salvo
 *   node scripts/qa-cls.mjs --sem-build       # reusa o .next já buildado
 */

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = path.join(RAIZ, "qa-shots");
const CHROMIUM = process.env.QA_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORTA = Number(process.env.QA_PORTA ?? 3177);
const BASE = `http://127.0.0.1:${PORTA}`;
const BANCO = process.env.RADAR_FAKE_DB_FILE ?? "/tmp/radar-qa-cls.json";
const VIEWPORT = { width: 390, height: 844 };

/** Piso "bom" do Core Web Vital real — o portão do item 4. */
const CLS_LIMIAR = 0.1;

const args = process.argv.slice(2);
const opcao = (nome) => args.find((a) => a.startsWith(`--${nome}=`))?.split("=").slice(1).join("=");
const temFlag = (nome) => args.includes(`--${nome}`);
const marca = opcao("marca") ? `-${opcao("marca")}` : "";
const filtro = opcao("so")?.split(",").map((s) => s.trim()).filter(Boolean);
const querido = (id) => !filtro || filtro.includes(id);
const semPortao = temFlag("sem-portao");

const SKINS = [
  "barbearia-editorial",
  "barbearia2-sul",
  "tatuagem-editorial",
  "tatuagem-pigmento-vivo",
  "lancheria-chapa-burger",
  "imobiliaria-curada",
  "multimarcas-vortice",
  "petshop-focinho-feliz",
];

/**
 * As abas principais da nav inferior (mesma lista de qa-plataforma.mjs).
 *
 * `leads` entra com `?buscaId=` (o link real de "leads →" em `/buscas`),
 * não `/leads` pelado: sem o grupo ativo, "Mostrando leads da busca",
 * Precificação e o badge "argumento forte" nunca renderizam, e o banco
 * falso podia ficar com dado incompleto pra eles sem o portão notar (ver
 * ARCHITECTURE.md, "Deslocamento de layout").
 */
const ABAS = [
  { id: "hoje", url: "/hoje", rotulo: "Hoje" },
  { id: "painel", url: "/", rotulo: "Painel" },
  {
    id: "leads",
    url: "/leads?buscaId=busca-centro&buscaNome=Dentistas%20%E2%80%94%20Centro",
    rotulo: "Leads (grupo)",
  },
  { id: "buscas", url: "/buscas", rotulo: "Buscas" },
  { id: "demos", url: "/demos", rotulo: "Demos" },
  { id: "chat", url: "/mensagens", rotulo: "Chat" },
  { id: "config", url: "/config", rotulo: "Config" },
];

function criarSessaoToken({ userId, papel, versao }, secret) {
  const payload = `${userId}.${papel}.${versao}`;
  const sig = crypto.createHmac("sha256", `radar-session:${secret}`).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function iso(diasAtras) {
  return new Date(Date.now() - diasAtras * 86400000).toISOString();
}

function chaveDia() {
  return new Date().toISOString().slice(0, 10);
}

function chaveMes() {
  return new Date().toISOString().slice(0, 7);
}

/** Seed mínimo para as abas do Radar renderizarem com dado realista. */
function semear() {
  const mapa = {
    "usuarios/admin": {
      id: "admin",
      nome: "admin",
      papel: "admin",
      ativo: true,
      sessao: 1,
      metas: { prospeccoesDia: 5, prospeccoesSemana: 25 },
      criadoEm: iso(30),
      atualizadoEm: iso(30),
    },
    "usuarios/membro-1": {
      id: "membro-1",
      nome: "membro-1",
      papel: "membro",
      ativo: true,
      sessao: 1,
      limites: { buscasDia: 30, enriquecimentosDia: 20 },
      metas: { prospeccoesDia: 4, prospeccoesSemana: 20 },
      criadoEm: iso(20),
      atualizadoEm: iso(20),
    },
    "config/app": {
      nicho: "dentista",
      regiao: "Porto Alegre RS",
      filtros: { temSite: "qualquer", temTelefone: "qualquer" },
      mensagemPadrao: "Oi {nome}, tudo bem? Montei uma prévia do site de vocês: {demo}",
      followUpDias: 4,
      maxBuscasRecorrentes: 3,
      atualizadoEm: iso(2),
    },
    "buscas/busca-centro": {
      id: "busca-centro",
      nome: "Dentistas — Centro",
      nicho: "dentista",
      regiao: "Porto Alegre RS",
      cor: "#2f82e0",
      recorrente: true,
      qualificada: true,
      quantidade: 20,
      criadaEm: iso(3),
      totalCriados: 14,
      totalExistentes: 6,
      userId: "membro-1",
      // Forma REAL de `PenetracaoSite` (lib/leads/penetracao.ts) — não
      // `{ comSiteProprio, semSiteProprio, total, percentual }` (formato
      // antigo, nunca lido pela UI): sem `percentuais`, o bloco "Penetração
      // de site" caía sempre no ramo "base pequena demais" e o badge
      // "argumento forte" nunca acendia — o portão de CLS media uma tela
      // que não tinha, de fato, o conteúdo que o relato descreveu.
      // >60% em comSiteProprio também cobre o badge "argumento forte".
      penetracao: {
        total: 20,
        comSiteProprio: 13,
        soRedeSocial: 4,
        semNada: 3,
        desconhecidos: 2,
        percentuais: { comSiteProprio: 65, soRedeSocial: 20, semNada: 15 },
      },
    },
    "buscas/busca-zona-sul": {
      id: "busca-zona-sul",
      nome: "Dentistas — Zona Sul",
      nicho: "dentista",
      subNicho: "implante",
      regiao: "Porto Alegre RS",
      cor: "#149f77",
      criadaEm: iso(9),
      totalCriados: 8,
      totalExistentes: 2,
      userId: "admin",
    },
    "cron/ultima": {
      em: iso(0),
      concluidaEm: iso(0),
      recorrentes: 1,
      totalNovos: 3,
      totalExistentes: 11,
      buscas: [{ buscaId: "busca-centro", nome: "Dentistas — Centro", novos: 3, existentes: 11 }],
    },
    [`usage/${chaveMes()}`]: {
      period: chaveMes(),
      textSearch: 1840,
      textSearchEnterprise: 260,
      detailsEssentials: 3100,
      detailsEnterprise: 420,
      detailsProHours: 980,
      porUsuario: {
        admin: { textSearch: 900, detailsEnterprise: 200 },
        "membro-1": { textSearch: 940, detailsEnterprise: 220 },
      },
    },
    [`usage_users/admin/dias/${chaveDia()}`]: { buscas: 3, enriquecimentos: 7 },
    [`usage_users/membro-1/dias/${chaveDia()}`]: { buscas: 4, enriquecimentos: 11 },
    "leads/lead-qa": {
      placeId: "lead-qa",
      nome: "Barbearia Norte",
      endereco: "Rua das Tesouras, 100 - Porto Alegre, RS, Brasil",
      status: "novo",
      enriquecido: false,
      temTelefone: true,
      telefone: "(51) 99999-0000",
      telefoneIntl: "5551999990000",
      busca: { nicho: "barbearia", regiao: "Porto Alegre RS", em: iso(3) },
      buscaId: ["busca-centro"],
      criadoEm: iso(3),
      atualizadoEm: iso(1),
      demo: {
        skinId: "barbearia-editorial",
        themeId: "norte",
        dados: {},
        criadoEm: iso(3),
        atualizadoEm: iso(1),
      },
    },
    "leads/lead-2": {
      placeId: "lead-2",
      nome: "Sorriso & Cia",
      endereco: "Av. Brasil, 100 — Porto Alegre, RS",
      status: "contactado",
      enriquecido: true,
      temSite: true,
      siteProprio: true,
      siteUrl: "https://sorrisoecia.com.br",
      temTelefone: true,
      telefone: "(51) 99999-0000",
      telefoneIntl: "5551999990000",
      busca: { nicho: "dentista", regiao: "Porto Alegre RS", em: iso(3) },
      buscaId: ["busca-centro"],
      contato: { primeiroContatoEm: iso(7), primeiroContatoPor: "membro-1" },
      criadoEm: iso(3),
      atualizadoEm: iso(1),
    },
    "leads/lead-3": {
      placeId: "lead-3",
      nome: "Dental Prime",
      endereco: "Av. Brasil, 200 — Porto Alegre, RS",
      status: "respondeu",
      enriquecido: true,
      temSite: false,
      temTelefone: true,
      telefone: "(51) 98888-0000",
      telefoneIntl: "5551988880000",
      busca: { nicho: "dentista", regiao: "Porto Alegre RS", em: iso(3) },
      buscaId: ["busca-centro"],
      contato: { primeiroContatoEm: iso(2), primeiroContatoPor: "admin" },
      demo: {
        skinId: "tatuagem-editorial",
        themeId: "meia-noite",
        dados: {},
        criadoEm: iso(2),
        atualizadoEm: iso(1),
      },
      criadoEm: iso(3),
      atualizadoEm: iso(1),
    },
    "mensagens/msg-0": {
      id: "msg-0",
      deUserId: "membro-1",
      paraUserId: "admin",
      texto: "Fechei a Vale Verde hoje",
      criadaEm: iso(2),
      lidaEm: iso(2),
    },
    "mensagens/msg-1": {
      id: "msg-1",
      deUserId: "admin",
      paraUserId: "membro-1",
      texto: "Boa! Manda o link da demo que eu reviso",
      criadaEm: iso(1),
    },
  };
  fsSync.writeFileSync(BANCO, JSON.stringify(mapa));
}

/** Instalado ANTES de qualquer script da página/frame rodar (page.addInitScript
 *  cobre a página E os iframes que ela cria — é assim que o preview do
 *  editor, que é um iframe, também fica coberto sem nada especial). */
function instalarObservador() {
  window.__cls = { value: 0, maiores: [] };
  try {
    const rotulo = (el) => {
      if (!el || el.nodeType !== 1) return "(nó sem elemento)";
      const id = el.id ? `#${el.id}` : "";
      const classe =
        typeof el.className === "string" && el.className.trim()
          ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
          : "";
      const slot = el.getAttribute?.("data-demo-slot");
      return `${el.tagName.toLowerCase()}${id}${classe}${slot ? `[data-demo-slot="${slot}"]` : ""}`;
    };
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__cls.value += entry.value;
        window.__cls.maiores.push({
          value: entry.value,
          time: entry.startTime,
          fontes: (entry.sources ?? []).map((s) => rotulo(s.node)),
        });
      }
      window.__cls.maiores.sort((a, b) => b.value - a.value);
      window.__cls.maiores = window.__cls.maiores.slice(0, 6);
    });
    po.observe({ type: "layout-shift", buffered: true });
  } catch {
    // navegador sem suporte — __cls fica em 0, não derruba o laço.
  }
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
  throw new Error(`porta ${PORTA} já ocupada. Encerre-a ou use QA_PORTA=<outra>.`);
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

/** Rola até o fim em passos (dispara lazy-load/scroll-mount) e volta ao topo. */
async function rolarPagina(target) {
  const altura = await target.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < altura; y += 400) {
    await target.evaluate((v) => window.scrollTo(0, v), y);
    await target.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  await target.evaluate(() => window.scrollTo(0, 0));
  await target.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function lerCls(target) {
  return target.evaluate(() => window.__cls ?? { value: 0, maiores: [] });
}

/** Mede uma tela normal (página própria, sem iframe). */
async function medirPagina(page, url, { settleMs = 3000 } = {}) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(settleMs);
  await rolarPagina(page);
  await page.waitForTimeout(400);
  return lerCls(page);
}

/** Mede o PREVIEW do editor: um iframe dentro de /leads/{id}/demo/editar. */
async function medirPreviewEditor(page) {
  await page.goto(`${BASE}/leads/lead-qa/demo/editar`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3200); // postMessage inicial + fontes/efeito montando
  const frame = page.frames().find((f) => f.url().includes("/demo-preview"));
  if (!frame) throw new Error("iframe /demo-preview não encontrado em /leads/lead-qa/demo/editar");
  await rolarPagina(frame);
  await frame.waitForTimeout(400);
  return lerCls(frame);
}

function imprimirResultado(nome, resultado) {
  const marcador = resultado.value > CLS_LIMIAR ? "✗ REPROVA" : "ok";
  console.log(`${nome.padEnd(34)} CLS=${resultado.value.toFixed(4).padStart(7)}  ${marcador}`);
  for (const item of resultado.maiores.slice(0, 3)) {
    if (item.value <= 0) continue;
    console.log(
      `    +${item.value.toFixed(4)} @${Math.round(item.time)}ms  ${item.fontes.join(", ") || "(sem fonte)"}`,
    );
  }
}

async function main() {
  await fs.mkdir(SAIDA, { recursive: true });
  const secret = crypto.randomBytes(16).toString("hex");
  const precisaBanco = querido("editor") || querido("app");
  if (precisaBanco) semear();

  const env = {
    ...process.env,
    APP_PASSWORD: secret,
    PORT: String(PORTA),
    NODE_ENV: undefined,
    ...(precisaBanco ? { RADAR_FAKE_DB: "1", RADAR_FAKE_DB_FILE: BANCO } : {}),
  };

  await exigirPortaLivre(BASE);
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
  try {
    await esperarServidor(BASE);
    const browser = await chromium.launch({ executablePath: CHROMIUM });
    const ctx = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      reducedMotion: "no-preference",
    });
    await ctx.addCookies([
      {
        name: "radar_session",
        value: criarSessaoToken({ userId: "admin", papel: "admin", versao: 1 }, secret),
        url: BASE,
      },
    ]);
    await ctx.addInitScript(instalarObservador);
    const page = await ctx.newPage();

    if (querido("skins")) {
      console.log("\n── Rota pública das skins (via /interno/demo-qa) ──");
      for (const skin of SKINS) {
        const resultado = await medirPagina(
          page,
          `${BASE}/interno/demo-qa?skin=${skin}&imagens=foto&intro=0`,
        );
        relatorio.push({ tela: `skin:${skin}`, ...resultado });
        imprimirResultado(skin, resultado);
      }
    }

    if (querido("editor")) {
      console.log("\n── Preview do editor de demo ──");
      const resultado = await medirPreviewEditor(page);
      relatorio.push({ tela: "editor:preview", ...resultado });
      imprimirResultado("preview do editor", resultado);
    }

    if (querido("app")) {
      console.log("\n── Abas do Radar ──");
      await page.goto(`${BASE}/hoje`, { waitUntil: "networkidle" }); // aquece sessão/tema
      for (const aba of ABAS) {
        const resultado = await medirPagina(page, `${BASE}${aba.url}`);
        relatorio.push({ tela: `app:${aba.id}`, ...resultado });
        imprimirResultado(aba.rotulo, resultado);
      }
    }

    await browser.close();
  } finally {
    encerrar();
  }

  const linhas = relatorio.map((r) => `| ${r.tela} | ${r.value.toFixed(4)} | ${r.value <= CLS_LIMIAR ? "ok" : "REPROVA"} |`);
  const tabela = [`| tela | CLS | veredito |`, `|---|---|---|`, ...linhas].join("\n");
  const destino = path.join(SAIDA, `_cls${marca}.md`);
  await fs.writeFile(destino, `${tabela}\n`);
  console.log(`\n${tabela}\n\nRelatório salvo em ${path.relative(RAIZ, destino)}`);

  const reprovadas = relatorio.filter((r) => r.value > CLS_LIMIAR);
  if (reprovadas.length > 0 && !semPortao) {
    throw new Error(
      `[cls] ${reprovadas.length} tela(s) acima do piso ${CLS_LIMIAR}: ${reprovadas
        .map((r) => `${r.tela} (${r.value.toFixed(4)})`)
        .join(", ")}`,
    );
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
