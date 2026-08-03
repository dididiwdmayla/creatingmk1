#!/usr/bin/env node
/**
 * Laço de captura da PLATAFORMA (o app autenticado — não as demos, que têm
 * o `qa-visual.mjs`). Existe para o sistema de temas por usuário: nada aqui
 * — "o rosa aparece demais", "o gradiente passou por baixo do texto", "a
 * aba ativa sumiu neste tema" — se julga por teste unitário.
 *
 * O que ele faz:
 *   1. sobe o app real (`next build && next start`) com APP_PASSWORD
 *      efêmero e semeia um banco falso com dados de exemplo;
 *   2. cunha um cookie de sessão ASSINADO com esse segredo (o proxy roda no
 *      Edge e só confere o HMAC — ver src/lib/auth.ts);
 *   3. percorre TEMA × ABA capturando um PNG por estado, desktop e celular,
 *      e monta uma folha de contato por tema;
 *   4. `--so=contraste` lê os tokens COMPUTADOS de cada tema no browser e
 *      imprime a tabela de contraste (o que o CSS de fato entrega, não o
 *      que a planilha de design dizia);
 *   5. `--so=iris` mede a proporção de matiz do CROMO (quanto de lima,
 *      quanto do miolo, quanto de rosa) — é como "rosa em quantidade bem
 *      menor" vira número em vez de opinião;
 *   6. `--so=fps` mede quadros por segundo em celular com CPU 4×
 *      NAVEGANDO ENTRE AS ABAS, por tema — a condição do dia inteiro.
 *
 * ⚠️ PATCH TEMPORÁRIO (aplicado e revertido na MESMA sessão): as páginas do
 * app leem o Firestore, e o repo não tem — nem quer — um caminho de banco
 * falso commitado (princípio 2). Para rodar isto:
 *
 *   1. em `src/lib/firebase/admin.ts`, no topo de `getDb()`:
 *
 *        if (process.env.RADAR_FAKE_DB === "1") {
 *          return require("@/lib/testing/qa-fake-db").getFakeDb();
 *        }
 *
 *   2. `src/lib/testing/qa-fake-db.ts`: um AppDb backed por ARQUIVO (não um
 *      singleton em memória — o build de produção separa cada route handler
 *      no próprio bundle e um módulo em memória não é compartilhado).
 *
 * Uso:
 *   node scripts/qa-plataforma.mjs                # temas × abas (desktop + celular)
 *   node scripts/qa-plataforma.mjs --so=contraste
 *   node scripts/qa-plataforma.mjs --so=iris
 *   node scripts/qa-plataforma.mjs --so=fps
 *   node scripts/qa-plataforma.mjs --so=usuario   # a escolha é POR USUÁRIO (2 sessões)
 *   node scripts/qa-plataforma.mjs --marca=antes  # sufixo nos arquivos
 *   node scripts/qa-plataforma.mjs --sem-build    # reusa o .next já buildado
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
const PORTA = Number(process.env.QA_PORTA ?? 3141);
const BASE = `http://127.0.0.1:${PORTA}`;
const BANCO = "/tmp/radar-qa-plataforma.json";

const VIEWPORT_DESKTOP = { width: 1100, height: 900 };
const VIEWPORT_CELULAR = { width: 390, height: 844 };

/** Temas da plataforma (espelha src/lib/tema.ts — TEMAS_APP). */
const TEMAS = process.env.QA_TEMAS?.split(",").map((t) => t.trim()).filter(Boolean) ?? [
  "escuro",
  "claro",
  "acido",
  "vapor",
  "prisma",
];

/** As abas principais da nav inferior, na ordem em que aparecem nela. */
const ABAS = [
  { id: "hoje", url: "/hoje", rotulo: "Hoje" },
  { id: "painel", url: "/", rotulo: "Painel" },
  { id: "leads", url: "/leads", rotulo: "Leads" },
  { id: "buscas", url: "/buscas", rotulo: "Buscas" },
  { id: "demos", url: "/demos", rotulo: "Demos" },
  { id: "chat", url: "/mensagens", rotulo: "Chat" },
  { id: "config", url: "/config", rotulo: "Config" },
];

/**
 * MEDIÇÃO DE FPS — mesma condição do piso das demos (`qa-visual.mjs`), com
 * uma diferença que é o ponto do item: aqui a página não fica PARADA. A
 * plataforma fica aberta o dia inteiro e a pessoa navega; o número que
 * importa é o do cromo enquanto se troca de aba.
 */
const FPS_VIEWPORT = VIEWPORT_CELULAR;
const FPS_CPU_THROTTLE = 4;
const FPS_CARGAS = Number(process.env.QA_FPS_CARGAS ?? 5);
const FPS_JANELA_MS = 4000;
/** Piso de aprovação, o mesmo do registro de efeitos. */
const FPS_MINIMO = 45;

const args = process.argv.slice(2);
const opcao = (nome) => args.find((a) => a.startsWith(`--${nome}=`))?.split("=").slice(1).join("=");
const temFlag = (nome) => args.includes(`--${nome}`);
const marca = opcao("marca") ? `-${opcao("marca")}` : "";
const filtro = opcao("so")?.split(",").map((s) => s.trim()).filter(Boolean);
const querido = (id) => !filtro || filtro.includes(id);

/** Mesmo esquema de assinatura de src/lib/auth.ts#criarSessaoToken. */
function criarSessaoToken({ userId, papel, versao }, secret) {
  const payload = `${userId}.${papel}.${versao}`;
  const sig = crypto.createHmac("sha256", `radar-session:${secret}`).update(payload).digest("hex");
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
 * O segredo é sorteado por rodada: um servidor sobrando de uma rodada
 * anterior ACEITA a conexão e RECUSA o cookie novo — toda captura viraria
 * tela de login sem ninguém perceber. Falha aqui, antes de subir.
 */
async function exigirPortaLivre() {
  try {
    await fetch(BASE, { redirect: "manual" });
  } catch {
    return;
  }
  throw new Error(`porta ${PORTA} ocupada (servidor de outra rodada?). Encerre-o ou use QA_PORTA=`);
}

async function esperarServidor(timeoutMs = 120000) {
  const limite = Date.now() + timeoutMs;
  while (Date.now() < limite) {
    try {
      await fetch(BASE, { redirect: "manual" });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`servidor não respondeu em ${BASE}`);
}

/* ── Dados de exemplo ────────────────────────────────────────────────── */

const AGORA = new Date();
const iso = (diasAtras = 0) =>
  new Date(AGORA.getTime() - diasAtras * 86400000).toISOString();

/** Mesmo formato de src/lib/usuarios/senha.ts — pra o login REAL funcionar. */
const SENHA_QA = "qa-1234";
function hashSenha(senha) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(senha, salt, 100_000, 32, "sha256");
  return `pbkdf2:100000:${salt.toString("hex")}:${hash.toString("hex")}`;
}
/** Chave de dia/mês no fuso de São Paulo (mesma convenção de lib/costs). */
const chaveDia = (d = AGORA) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
const chaveMes = () => chaveDia().slice(0, 7);

function semear() {
  const buscaId = "busca-centro";
  const base = { criadoEm: iso(3), atualizadoEm: iso(1), enriquecido: true };
  const lead = (placeId, nome, status, extra = {}) => ({
    placeId,
    nome,
    endereco: "Av. Brasil, 100 — Porto Alegre, RS",
    status,
    busca: { nicho: "dentista", regiao: "Porto Alegre RS", em: iso(3) },
    buscaId: [buscaId],
    temTelefone: true,
    telefone: "(51) 99999-0000",
    telefoneIntl: "5551999990000",
    ...base,
    ...extra,
  });

  const mapa = {
    "usuarios/admin": {
      id: "admin",
      nome: "admin",
      papel: "admin",
      ativo: true,
      sessao: 0,
      senhaHash: hashSenha(SENHA_QA),
      metas: { prospeccoesDia: 5, prospeccoesSemana: 25 },
      criadoEm: iso(30),
      atualizadoEm: iso(30),
    },
    "usuarios/membro-1": {
      id: "membro-1",
      nome: "membro-1",
      papel: "membro",
      ativo: true,
      sessao: 0,
      senhaHash: hashSenha(SENHA_QA),
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
    [`buscas/${buscaId}`]: {
      id: buscaId,
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
      penetracao: { comSiteProprio: 9, semSiteProprio: 11, total: 20, percentual: 0.45 },
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
      buscas: 1,
      criados: 3,
      erros: [],
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
  };

  const leads = [
    lead("lead-1", "Clínica Odonto Norte", "novo", {
      temSite: false,
      siteProprio: false,
      favorito: true,
      notas: "Sem site. Instagram ativo, 4,8 estrelas.",
    }),
    lead("lead-2", "Sorriso & Cia", "contactado", {
      temSite: true,
      siteProprio: true,
      siteUrl: "https://sorrisoecia.com.br",
      contato: { primeiroContatoEm: iso(7), primeiroContatoPor: "membro-1" },
    }),
    lead("lead-3", "Dental Prime", "respondeu", {
      temSite: false,
      siteProprio: false,
      contato: { primeiroContatoEm: iso(2), primeiroContatoPor: "admin" },
      demo: {
        skinId: "barbearia-editorial",
        themeId: "norte",
        dados: {},
        criadoEm: iso(2),
        atualizadoEm: iso(1),
        criadoPor: "admin",
      },
    }),
    lead("lead-4", "Odontologia Vale Verde", "fechado", {
      temSite: false,
      siteProprio: false,
      contato: { primeiroContatoEm: iso(12), primeiroContatoPor: "membro-1" },
      demo: {
        skinId: "lancheria-chapa",
        themeId: "chapa",
        dados: {},
        criadoEm: iso(10),
        atualizadoEm: iso(9),
        criadoPor: "membro-1",
      },
    }),
    lead("lead-5", "Implantes Centro", "novo", { temSite: false, siteProprio: false }),
    lead("lead-6", "Clínica Aurora", "contactado", {
      temSite: true,
      siteProprio: false,
      siteUrl: "https://instagram.com/clinicaaurora",
      contato: { primeiroContatoEm: iso(9), primeiroContatoPor: "admin" },
    }),
  ];
  for (const l of leads) mapa[`leads/${l.placeId}`] = l;

  const conversa = [
    ["membro-1", "admin", "Fechei a Vale Verde hoje 🎉", 4],
    ["admin", "membro-1", "Boa! Manda o link da demo que eu reviso", 3],
    ["membro-1", "admin", "Já está em /demos, dei uma ajustada no hero", 2],
    ["admin", "membro-1", "Vi aqui, ficou muito bom. Segue nos dentistas do centro", 1],
  ];
  conversa.forEach(([de, para, texto, dias], i) => {
    mapa[`mensagens/msg-${i}`] = {
      id: `msg-${i}`,
      deUserId: de,
      paraUserId: para,
      texto,
      criadaEm: iso(dias),
      ...(i < conversa.length - 1 && { lidaEm: iso(dias) }),
    };
  });

  fsSync.writeFileSync(BANCO, JSON.stringify(mapa));
}

function lerTemaDoDoc(userId) {
  const mapa = JSON.parse(fsSync.readFileSync(BANCO, "utf8"));
  return mapa[`usuarios/${userId}`]?.tema;
}

/* ── Captura ─────────────────────────────────────────────────────────── */

async function contextoLogado(browser, { viewport, userId = "admin", papel = "admin", secret, tema }) {
  const ctx = await browser.newContext({
    viewport,
    ...(viewport === VIEWPORT_CELULAR && { deviceScaleFactor: 2, isMobile: true, hasTouch: true }),
    reducedMotion: "no-preference",
  });
  await ctx.addCookies([
    {
      name: "radar_session",
      value: criarSessaoToken({ userId, papel, versao: 0 }, secret),
      url: BASE,
    },
    // O cookie-espelho do tema é o que o RootLayout lê no servidor. Cunhá-lo
    // aqui reproduz exatamente o estado de quem já tinha escolhido o tema.
    ...(tema ? [{ name: "radar_tema", value: tema, url: BASE }] : []),
  ]);
  return ctx;
}

async function assentar(page) {
  // As páginas do app buscam dados no cliente; `networkidle` sozinho pega o
  // HTML antes das listas chegarem.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
}

/** Confere que a captura é a PÁGINA, não a tela de login (cookie recusado). */
async function exigirLogado(page, onde) {
  if (new URL(page.url()).pathname === "/login") {
    throw new Error(`caiu no /login em ${onde} — cookie de sessão recusado`);
  }
}

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
        (linha) => `<div style="display:flex;gap:6px;padding:0 14px 10px;align-items:flex-start">${linha.itens
          .map(
            (item) => `<figure style="margin:0;flex:1;min-width:0">
              <figcaption style="padding:2px 0;color:#9a9a9a">${linha.rotulo} · ${item.rotulo}</figcaption>
              <img src="${item.src}" style="width:100%;display:block;border:1px solid #333">
            </figure>`,
          )
          .join("")}</div>`,
      )
      .join("")}
  </body>`;
  await page.setContent(html);
  await page.waitForTimeout(200);
  const destino = path.join(SAIDA, `_folha-${arquivo}${marca}.png`);
  await page.screenshot({ path: destino, fullPage: true });
  return destino;
}

/* ── Item: tema × aba ────────────────────────────────────────────────── */

async function capturarTemasEAbas(browser, secret, viewport, sufixo) {
  const gerados = [];
  for (const tema of TEMAS) {
    const ctx = await contextoLogado(browser, { viewport, secret, tema });
    const page = await ctx.newPage();
    const itens = [];
    for (const aba of ABAS) {
      await page.goto(`${BASE}${aba.url}`, { waitUntil: "domcontentloaded" });
      await assentar(page);
      await exigirLogado(page, `${tema}/${aba.id}`);
      const png = path.join(SAIDA, `tema-${tema}-${aba.id}-${sufixo}${marca}.png`);
      await page.screenshot({ path: png });
      gerados.push(png);
      itens.push({ rotulo: aba.rotulo, png });
    }
    // Uma folha por TEMA (as 7 abas lado a lado): é o que se abre pra julgar
    // um tema inteiro de uma vez, em vez de 7 arquivos soltos.
    gerados.push(
      await folhaDeContato(page, `Tema "${tema}" — ${sufixo}`, `tema-${tema}-${sufixo}`, [
        { rotulo: tema, itens: itens.slice(0, 4) },
        { rotulo: tema, itens: itens.slice(4) },
      ]),
    );
    await ctx.close();
  }
  return gerados;
}

/* ── Item: a escolha é POR USUÁRIO ───────────────────────────────────── */

async function provarPorUsuario(browser) {
  const gerados = [];
  const itens = [];
  console.log("\n  [usuario] a escolha vive no doc do usuário, não no navegador:");

  // UM único contexto de browser (um "navegador", uma máquina compartilhada)
  // em que duas pessoas logam em sequência — é o caso que o localStorage
  // errava: o segundo herdava o tema do primeiro.
  const ctx = await browser.newContext({ viewport: VIEWPORT_DESKTOP });
  const page = await ctx.newPage();

  async function entrar(nome) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    const resposta = await page.evaluate(
      async ({ nome, senha }) => {
        const r = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome, senha }),
        });
        return r.status;
      },
      { nome, senha: SENHA_QA },
    );
    if (resposta !== 204) throw new Error(`login de ${nome} respondeu ${resposta}`);
  }

  async function sair() {
    await page.evaluate(() => fetch("/api/logout", { method: "POST" }));
  }

  // Dois temas DIFERENTES quaisquer da lista ativa (assim a prova vale tanto
  // com os cinco temas quanto restrita a claro/escuro por QA_TEMAS).
  const escolhas = [
    { userId: "admin", tema: TEMAS[TEMAS.length - 1] },
    { userId: "membro-1", tema: TEMAS[TEMAS.length - 2] },
  ];

  // Fase 1 — cada um entra e escolhe o seu tema pelo SELETOR de verdade.
  for (const { userId, tema } of escolhas) {
    await entrar(userId);
    await page.goto(`${BASE}/hoje`, { waitUntil: "domcontentloaded" });
    await assentar(page);
    await exigirLogado(page, `usuario/${userId}`);

    // Escolher o tema que já está ativo é (corretamente) um no-op, e não
    // provaria gravação nenhuma. Passa por outro tema primeiro, garantindo
    // que a escolha final seja uma troca de verdade.
    const trajeto = [TEMAS.find((t) => t !== tema), tema].filter(Boolean);
    for (const alvo of trajeto) {
      await page.getByRole("button", { name: /Trocar de tema/ }).click();
      await page.getByRole("menuitemradio", { name: new RegExp(`^${alvo}`, "i") }).click();
      await page.waitForTimeout(700);
    }

    const noDom = await page.evaluate(() => document.documentElement.dataset.theme);
    const noDoc = lerTemaDoDoc(userId);
    console.log(
      `    ${userId.padEnd(10)} escolheu "${tema}" pelo seletor → DOM=${noDom}  doc=${noDoc}` +
        `  ${noDom === tema && noDoc === tema ? "ok" : "XX"}`,
    );
    await sair();
  }

  console.log(
    `    docs: admin=${lerTemaDoDoc("admin")}  membro-1=${lerTemaDoDoc("membro-1")}` +
      `  ${lerTemaDoDoc("admin") !== lerTemaDoDoc("membro-1") ? "→ independentes ok" : "XX iguais"}`,
  );

  // Fase 2 — o teste que importa: relogar no MESMO navegador e conferir que
  // o tema certo já vem no HTML DO SERVIDOR (primeira pintura, sem flash),
  // sem herdar o de quem usou a máquina antes.
  for (const { userId, tema } of escolhas) {
    await entrar(userId);
    const resposta = await page.goto(`${BASE}/hoje`, { waitUntil: "domcontentloaded" });
    const noHtml = (await resposta.text()).match(/<html[^>]*data-theme="([^"]+)"/)?.[1];
    await assentar(page);
    const png = path.join(SAIDA, `usuario-${userId}-${tema}${marca}.png`);
    await page.screenshot({ path: png });
    gerados.push(png);
    itens.push({ rotulo: `${userId} → ${noHtml}`, png });
    console.log(
      `    ${userId.padEnd(10)} relogou no MESMO navegador → data-theme no HTML do servidor` +
        ` = ${noHtml}  ${noHtml === tema ? "ok (sem flash)" : "XX"}`,
    );
    await sair();
  }

  gerados.push(
    await folhaDeContato(page, "Mesmo navegador, dois usuários, dois temas", "usuario", [
      { rotulo: "primeira pintura", itens },
    ]),
  );
  await ctx.close();
  return gerados;
}

/* ── Item: contraste lido do CSS computado ───────────────────────────── */

/** Pares que precisam passar — a regra de legibilidade do item 3. */
const PARES_CONTRASTE = [
  ["--foreground", "--surface", 7.0, "texto de leitura em card"],
  ["--foreground", "--background", 7.0, "texto de leitura na página"],
  ["--ink-secondary", "--surface", 4.5, "texto secundário em card"],
  ["--ink-muted", "--surface", 4.5, "rótulo/legenda em card"],
  ["--ink-muted", "--background", 4.5, "rótulo/legenda na página"],
  ["--accent", "--surface", 4.5, "aba ativa / link"],
  ["--accent-ink", "--accent", 4.5, "texto sobre o botão primário"],
  ["--warning", "--surface", 4.5, '"Perto do teto"'],
  ["--critical", "--surface", 4.5, '"No limite" / erro'],
  ["--good", "--surface", 4.5, "meta atingida"],
  ["--good-ink", "--good", 4.5, "texto sobre fill good"],
  ["--critical-ink", "--critical", 4.5, "texto sobre fill critical"],
  ["--apoio", "--surface", 4.5, "verde-lima de apoio como texto"],
  ["--faisca", "--surface", 4.5, "rosa de destaque como texto"],
  ["--faisca-ink", "--faisca", 4.5, "texto sobre o rosa"],
];

const RAMPA_STATUS = [
  ["--status-novo", "#ffffff"],
  ["--status-contactado", "#ffffff"],
  ["--status-respondeu", "#000000"],
  ["--status-fechado", "#000000"],
];

async function medirContraste(browser, secret) {
  const ctx = await contextoLogado(browser, { viewport: VIEWPORT_DESKTOP, secret });
  const page = await ctx.newPage();
  const linhas = [];
  let falhas = 0;

  for (const tema of TEMAS) {
    await page.goto(`${BASE}/hoje`, { waitUntil: "domcontentloaded" });
    await assentar(page);
    await exigirLogado(page, `contraste/${tema}`);
    const medida = await page.evaluate(
      ({ tema, pares, rampa }) => {
        document.documentElement.dataset.theme = tema;
        const estilo = getComputedStyle(document.documentElement);
        // O browser resolve toda cor para "rgb(r, g, b)" — nada de adivinhar
        // hex a partir do texto do CSS: é o valor PINTADO que interessa.
        const rgb = (v) => {
          const m = v.trim().match(/(-?[\d.]+)/g);
          return m ? m.slice(0, 3).map(Number) : null;
        };
        const doToken = (t) => (t.startsWith("--") ? rgb(estilo.getPropertyValue(t)) : rgb(t));
        const lin = (c) => {
          const s = c / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
        const razao = (a, b) => {
          const la = lum(a);
          const lb = lum(b);
          return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        };
        const hex = (c) =>
          `#${c.map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;
        return {
          pares: pares.map(([a, b, min, papel]) => {
            const ca = doToken(a);
            const cb = doToken(b);
            return ca && cb
              ? { a, b, min, papel, r: razao(ca, cb), hexA: hex(ca), hexB: hex(cb) }
              : { a, b, min, papel, ausente: true };
          }),
          rampa: rampa.map(([token, ink]) => {
            const c = doToken(token);
            return c
              ? { token, hex: hex(c), L: lum(c) * 100, r: razao(c, doToken(ink)), ink }
              : { token, ausente: true };
          }),
        };
      },
      { tema, pares: PARES_CONTRASTE, rampa: RAMPA_STATUS },
    );

    console.log(`\n  [contraste] tema "${tema}"`);
    for (const p of medida.pares) {
      if (p.ausente) continue;
      const ok = p.r >= p.min;
      if (!ok) falhas++;
      console.log(
        `    ${ok ? "ok " : "XX "} ${p.r.toFixed(2).padStart(6)}:1 (min ${p.min})  ` +
          `${p.a} ${p.hexA} sobre ${p.b} ${p.hexB} — ${p.papel}`,
      );
    }
    let anterior = -1;
    for (const d of medida.rampa) {
      if (d.ausente) continue;
      const monot = d.L > anterior;
      const ok = d.r >= 4.5 && monot;
      if (!ok) falhas++;
      anterior = d.L;
      console.log(
        `    ${ok ? "ok " : "XX "} ${d.r.toFixed(2).padStart(6)}:1  ${d.token} ${d.hex} ` +
          `L=${d.L.toFixed(1)} ${monot ? "↑" : "não-monótono"} (ink ${d.ink})`,
      );
    }
    linhas.push({ tema, medida });
  }

  await ctx.close();
  const md = [
    "# Contraste por tema — lido do CSS COMPUTADO no browser",
    "",
    "Texto de leitura vive em superfície SÓLIDA (`--surface` / `--background`);",
    "nenhum par abaixo é medido contra gradiente. Ver ARCHITECTURE.md.",
    "",
    "| tema | par | papel | contraste | mínimo | veredito |",
    "|---|---|---|---|---|---|",
    ...linhas.flatMap(({ tema, medida }) =>
      medida.pares
        .filter((p) => !p.ausente)
        .map(
          (p) =>
            `| \`${tema}\` | \`${p.a}\` sobre \`${p.b}\` | ${p.papel} | **${p.r.toFixed(2)}:1** | ${p.min} | ${
              p.r >= p.min ? "passa" : "**REPROVA**"
            } |`,
        ),
    ),
  ].join("\n");
  const destino = path.join(SAIDA, `_contraste${marca}.md`);
  await fs.writeFile(destino, md);
  console.log(`\n  [contraste] ${falhas === 0 ? "todos os pares passam" : `${falhas} FALHA(S)`}`);
  return [destino];
}

/* ── Item: proporção de matiz no cromo (o "rosa em quantidade menor") ── */

async function medirIris(browser, secret) {
  const ctx = await contextoLogado(browser, { viewport: VIEWPORT_DESKTOP, secret });
  const page = await ctx.newPage();
  console.log(
    "\n  [iris] fração de pixels COLORIDOS do cromo (header + nav) por faixa de matiz:",
  );
  const linhas = [];
  for (const tema of TEMAS) {
    await page.goto(`${BASE}/hoje`, { waitUntil: "domcontentloaded" });
    await assentar(page);
    await exigirLogado(page, `iris/${tema}`);
    const medida = await page.evaluate(async (tema) => {
      document.documentElement.dataset.theme = tema;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      // Amostra os elementos de CROMO: header, nav e a borda ativa.
      const alvos = [document.querySelector("header"), document.querySelector("nav")].filter(
        Boolean,
      );
      const faixas = { lima: 0, miolo: 0, rosa: 0 };
      let coloridos = 0;
      let total = 0;
      for (const alvo of alvos) {
        const caixa = alvo.getBoundingClientRect();
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(caixa.width);
        canvas.height = Math.round(caixa.height);
        // Sem html2canvas: lê as cores DECLARADAS do próprio elemento e dos
        // filhos, ponderadas pela área que cada um ocupa. É o que responde
        // "quanto de rosa tem no cromo" sem depender de rasterização.
        const nos = [alvo, ...alvo.querySelectorAll("*")];
        for (const no of nos) {
          const r = no.getBoundingClientRect();
          const area = Math.max(0, r.width) * Math.max(0, r.height);
          if (area <= 0) continue;
          const cs = getComputedStyle(no);
          for (const prop of ["backgroundImage", "backgroundColor", "color", "borderTopColor"]) {
            const valor = cs[prop];
            if (!valor || valor === "none") continue;
            for (const m of valor.matchAll(/rgba?\(([^)]+)\)/g)) {
              const [rr, gg, bb, aa] = m[1].split(",").map((n) => Number.parseFloat(n));
              if (aa !== undefined && aa < 0.15) continue;
              const max = Math.max(rr, gg, bb);
              const min = Math.min(rr, gg, bb);
              const d = max - min;
              total += area;
              if (d < 28 || max < 40) continue; // cinza/preto: não é matiz
              coloridos += area;
              let h;
              if (max === rr) h = (((gg - bb) / d) % 6) * 60;
              else if (max === gg) h = ((bb - rr) / d + 2) * 60;
              else h = ((rr - gg) / d + 4) * 60;
              if (h < 0) h += 360;
              if (h >= 55 && h < 110) faixas.lima += area;
              else if (h >= 280 || h < 20) faixas.rosa += area;
              else faixas.miolo += area;
            }
          }
        }
      }
      return { faixas, coloridos, total };
    }, tema);

    const soma = medida.faixas.lima + medida.faixas.miolo + medida.faixas.rosa || 1;
    const pct = (v) => ((v / soma) * 100).toFixed(1).padStart(5);
    console.log(
      `    ${tema.padEnd(7)} lima ${pct(medida.faixas.lima)}%  miolo ${pct(medida.faixas.miolo)}%` +
        `  rosa ${pct(medida.faixas.rosa)}%` +
        `  ${medida.faixas.rosa / soma <= 0.2 ? "ok (rosa ≤20%)" : "XX rosa demais"}`,
    );
    linhas.push({ tema, ...medida, soma });
  }
  await ctx.close();
  const destino = path.join(SAIDA, `_iris${marca}.md`);
  await fs.writeFile(
    destino,
    [
      "# Proporção de matiz no CROMO (header + barra inferior)",
      "",
      "Área ponderada das cores declaradas em `background-image`/`background-color`/",
      "`color`/`border-*`, classificada por faixa de matiz. Faixas: lima 55–110°,",
      "rosa ≥280° ou <20°, miolo o resto. Cinza/preto (croma < 28) não conta.",
      "",
      "| tema | lima | miolo | rosa |",
      "|---|---|---|---|",
      ...linhas.map(
        (l) =>
          `| \`${l.tema}\` | ${((l.faixas.lima / l.soma) * 100).toFixed(1)}% | ` +
          `${((l.faixas.miolo / l.soma) * 100).toFixed(1)}% | ` +
          `**${((l.faixas.rosa / l.soma) * 100).toFixed(1)}%** |`,
      ),
    ].join("\n"),
  );
  return [destino];
}

/* ── Item: fps navegando entre as abas ───────────────────────────────── */

async function medirFps(browser, secret) {
  const gerados = [];
  const linhas = [];
  console.log(
    `\n  [fps] celular ${FPS_VIEWPORT.width}×${FPS_VIEWPORT.height} dpr2, CPU ${FPS_CPU_THROTTLE}×, ` +
      `NAVEGANDO entre as abas — mediana de ${FPS_CARGAS} cargas:`,
  );

  for (const tema of TEMAS) {
    const medidas = [];
    for (let carga = 0; carga < FPS_CARGAS; carga++) {
      const ctx = await contextoLogado(browser, { viewport: FPS_VIEWPORT, secret, tema });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: FPS_CPU_THROTTLE });

      await page.goto(`${BASE}/hoje`, { waitUntil: "domcontentloaded" });
      await assentar(page);
      await exigirLogado(page, `fps/${tema}`);

      // Conta quadros CONTINUAMENTE enquanto a navegação acontece por
      // client-side routing (a nav é <Link>): o contador vive num rAF que
      // sobrevive à troca de rota, que é justamente o momento medido.
      const medida = await page.evaluate(async (janela) => {
        let quadros = 0;
        let rodando = true;
        const inicio = performance.now();
        const passo = () => {
          if (!rodando) return;
          quadros++;
          requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);

        const abas = ["/", "/leads", "/buscas", "/demos", "/mensagens", "/hoje"];
        const porAba = janela / abas.length;
        for (const href of abas) {
          const link = document.querySelector(`nav a[href="${href}"]`);
          if (link) link.click();
          await new Promise((r) => setTimeout(r, porAba));
        }
        rodando = false;
        const decorrido = performance.now() - inicio;
        return (quadros * 1000) / decorrido;
      }, FPS_JANELA_MS);
      medidas.push(medida);

      if (carga === FPS_CARGAS - 1) {
        const png = path.join(SAIDA, `fps-plataforma-${tema}${marca}.png`);
        await page.screenshot({ path: png });
        gerados.push(png);
      }
      await ctx.close();
    }
    medidas.sort((a, b) => a - b);
    const mediana = medidas[Math.floor(medidas.length / 2)];
    linhas.push({ tema, mediana, medidas });
    console.log(
      `    ${tema.padEnd(8)} mediana ${mediana.toFixed(1).padStart(5)} fps  ` +
        `(cargas: ${medidas.map((m) => m.toFixed(1)).join(" / ")})` +
        `${mediana < FPS_MINIMO ? "  ← REPROVADO" : ""}`,
    );
  }

  const destino = path.join(SAIDA, `_fps-plataforma${marca}.md`);
  await fs.writeFile(
    destino,
    [
      `# fps do cromo da plataforma — celular ${FPS_VIEWPORT.width}×${FPS_VIEWPORT.height} (dpr 2), CPU ${FPS_CPU_THROTTLE}×`,
      "",
      `Contagem contínua de quadros ENQUANTO se navega pelas abas (6 trocas de rota`,
      `em ${FPS_JANELA_MS}ms), mediana de ${FPS_CARGAS} cargas independentes.`,
      `Piso de aprovação: ${FPS_MINIMO} fps.`,
      "",
      "| tema | fps (mediana) | cargas | veredito |",
      "|---|---|---|---|",
      ...linhas.map(
        (l) =>
          `| \`${l.tema}\` | **${l.mediana.toFixed(1)}** | ${l.medidas
            .map((m) => m.toFixed(1))
            .join(" / ")} | ${l.mediana >= FPS_MINIMO ? "passa" : "**REPROVADO**"} |`,
      ),
    ].join("\n"),
  );
  gerados.push(destino);
  return gerados;
}

/* ── main ────────────────────────────────────────────────────────────── */

async function main() {
  await fs.mkdir(SAIDA, { recursive: true });
  await exigirPortaLivre();

  const secret = crypto.randomBytes(16).toString("hex");
  semear();

  const env = {
    ...process.env,
    APP_PASSWORD: secret,
    RADAR_FAKE_DB: "1",
    RADAR_FAKE_DB_FILE: BANCO,
    PORT: String(PORTA),
    NODE_ENV: "production",
  };

  if (!temFlag("sem-build")) await executar("npx", ["next", "build"], env);

  const servidor = spawn("npx", ["next", "start", "-p", String(PORTA)], {
    cwd: RAIZ,
    env,
    stdio: "inherit",
    detached: true,
  });
  // `next start` deixa um filho que sobrevive ao SIGTERM do wrapper — mata em grupo.
  const encerrar = () => {
    try {
      process.kill(-servidor.pid, "SIGKILL");
    } catch {
      /* já morreu */
    }
  };
  process.on("exit", encerrar);

  const gerados = [];
  try {
    await esperarServidor();
    const browser = await chromium.launch({ executablePath: CHROMIUM });

    if (querido("abas") || !filtro) {
      gerados.push(...(await capturarTemasEAbas(browser, secret, VIEWPORT_DESKTOP, "desktop")));
      gerados.push(...(await capturarTemasEAbas(browser, secret, VIEWPORT_CELULAR, "celular")));
    }
    if (querido("usuario")) gerados.push(...(await provarPorUsuario(browser)));
    if (querido("contraste")) gerados.push(...(await medirContraste(browser, secret)));
    if (querido("iris")) gerados.push(...(await medirIris(browser, secret)));
    if (querido("fps")) gerados.push(...(await medirFps(browser, secret)));

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
