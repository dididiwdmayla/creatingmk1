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
 *   node scripts/qa-plataforma.mjs --so=legibilidade
 *   node scripts/qa-plataforma.mjs --so=custo
 *   node scripts/qa-plataforma.mjs --so=barra
 *   node scripts/qa-plataforma.mjs --so=fps
 *   node scripts/qa-plataforma.mjs --so=listas    # PORTÃO das listas longas: /leads e /buscas no celular
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

import { lerPng } from "./png.mjs";

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
    // Outro MÊS e outro NICHO: sem ela, o agrupamento de /buscas cairia
    // sempre num grupo só e a captura não provaria nada (ver --so=listas).
    "buscas/busca-barbearias": {
      id: "busca-barbearias",
      nome: "Barbearias — Cidade Baixa",
      nicho: "barbearia",
      regiao: "Porto Alegre RS",
      cor: "#c98500",
      criadaEm: iso(47),
      totalCriados: 11,
      totalExistentes: 4,
      userId: "membro-1",
    },
    // Forma COMPLETA de CronExecucao (lib/buscas/cron.ts). Um doc encurtado
    // aqui não é "dado de exemplo pobre": o widget do painel formata
    // `totalNovos`/`buscas.length` direto, então campo faltando derruba a
    // página inteira no cliente — e, quando React desmonta a árvore, o
    // `data-theme` do <html> vai junto e TODA a captura sai no tema errado.
    "cron/ultima": {
      em: iso(0),
      concluidaEm: iso(0),
      recorrentes: 1,
      totalNovos: 3,
      totalExistentes: 11,
      buscas: [
        { buscaId: "busca-centro", nome: "Dentistas — Centro", novos: 3, existentes: 11 },
      ],
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
      detalhes: { telefone: "(51) 3333-1000", rating: 4.6, totalAvaliacoes: 88 },
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
    // Nome longo: é ele que prova que a linha do modo compacto TRUNCA em
    // vez de empurrar selo/score pra fora da tela do celular.
    lead("lead-7", "Centro de Odontologia Estética e Implantodontia Vale do Sol", "novo", {
      buscaId: ["busca-barbearias"],
      temSite: false,
      siteProprio: false,
      notas: "Fachada nova, sem site. Ligar depois das 14h.",
    }),
    lead("lead-8", "Studio Barba & Navalha", "respondeu", {
      buscaId: ["busca-barbearias"],
      temSite: true,
      siteProprio: true,
      siteUrl: "https://barbaenavalha.com.br",
      contato: { primeiroContatoEm: iso(5), primeiroContatoPor: "membro-1" },
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

/**
 * Grava o tema no DOC do usuário — o mesmo campo que o PUT /api/tema usa.
 *
 * Cunhar só o cookie NÃO basta, e essa foi uma armadilha real: o
 * `TemaSeletor` chama `GET /api/tema` ao montar e aplica o valor do DOC
 * (é o desenho, e está certo — é como um segundo dispositivo se corrige).
 * Com o doc vazio, toda captura voltava pro tema padrão e as cinco levas
 * saíam IDÊNTICAS. Quem denunciou foi o `qa-diff.mjs`: "ácido vs vapor,
 * médio=0.000, máx=0". Daí o doc ser semeado antes de capturar, e daí a
 * asserção `exigirTema` logo depois de cada carga.
 */
function definirTemaNoDoc(userId, tema) {
  const mapa = JSON.parse(fsSync.readFileSync(BANCO, "utf8"));
  mapa[`usuarios/${userId}`] = { ...mapa[`usuarios/${userId}`], tema };
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

/**
 * O cromo continua ONDE DEVE: header colado no topo, barra de navegação
 * colada no rodapé da viewport. Existe porque a iridescência entrou como
 * `::after`, e `::after` precisa de ancestral posicionado — a primeira
 * versão pôs `position: relative` na classe `.cromo-linha`, que tem a mesma
 * especificidade das utilities do Tailwind e vem DEPOIS delas no arquivo:
 * venceu o `fixed` da nav e jogou a barra de volta pro fluxo, grudada
 * embaixo do header. Nenhum teste unitário julga isso; a captura mostrou e
 * esta asserção passa a cobrar.
 */
async function exigirCromoNoLugar(page, onde) {
  const caixas = await page.evaluate(() => {
    const header = document.querySelector("header");
    const nav = document.querySelector("nav");
    return {
      navBottom: nav?.getBoundingClientRect().bottom ?? null,
      navPosicao: nav ? getComputedStyle(nav).position : null,
      headerTop: header?.getBoundingClientRect().top ?? null,
      viewport: window.innerHeight,
    };
  });
  if (caixas.navPosicao === null) throw new Error(`sem <nav> em ${onde}`);
  if (caixas.navPosicao !== "fixed") {
    throw new Error(`nav não está fixed em ${onde} (position: ${caixas.navPosicao})`);
  }
  if (Math.abs(caixas.viewport - caixas.navBottom) > 2) {
    throw new Error(
      `nav fora do rodapé em ${onde}: bottom=${caixas.navBottom}, viewport=${caixas.viewport}`,
    );
  }
}

/** Confere que a captura é do tema PEDIDO (ver definirTemaNoDoc). */
async function exigirTema(page, tema, onde) {
  const ativo = await page.evaluate(() => document.documentElement.dataset.theme);
  if (ativo !== tema) {
    throw new Error(`tema errado em ${onde}: pedido "${tema}", ativo "${ativo}"`);
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

/* ── Item: compactação de /leads e /buscas (`--so=listas`) ───────────── */

/**
 * As duas telas longas, no CELULAR, dirigindo os controles DE VERDADE —
 * não uma preferência semeada no banco. Estado semeado provaria só que o
 * componente sabe renderizar fechado; o que precisa ser verificado é o
 * caminho inteiro: tocar no controle → gravar no doc → recarregar e
 * continuar compactado.
 *
 * Junto das capturas, o PORTÃO deste item: **nenhuma linha da lista pode
 * renderizar com altura zero**. É o análogo, para as listas, do
 * `--so=colapso` das skins — um card que "some" por colapsar a caixa não
 * aparece como erro em captura nenhuma (a tela só fica mais curta), mas
 * come um lead da fila do operador. Também cobra que a linha compacta seja
 * mais BAIXA que o card completo (senão não houve compactação nenhuma) e
 * que nada vaze horizontalmente da viewport do celular.
 */
async function medirListas(browser, secret) {
  const gerados = [];
  const ctx = await contextoLogado(browser, {
    viewport: VIEWPORT_CELULAR,
    secret,
    tema: "escuro",
  });
  const page = await ctx.newPage();
  const problemas = [];
  const itens = [];

  /** Altura de cada item de lista + do cabeçalho de grupo visíveis na tela. */
  const medirLinhas = (seletor) =>
    page.$$eval(seletor, (nos) =>
      nos.map((no) => {
        const r = no.getBoundingClientRect();
        return {
          altura: Math.round(r.height),
          largura: Math.round(r.width),
          direita: Math.round(r.right),
          texto: (no.textContent ?? "").trim().slice(0, 40),
        };
      }),
    );

  // O ponto de cor da busca tem hook próprio porque ele já sumiu uma vez
  // sem ninguém notar: <span> inline ignora width/height, então bastou ele
  // deixar de ser filho direto de um flex pra virar uma caixa 0×0 — a tela
  // continua "certa", só sem o ponto.
  const conferirPontos = async (onde) => {
    const pontos = await medirLinhas("[data-ponto-busca]");
    for (const ponto of pontos) {
      if (ponto.altura <= 0 || ponto.largura <= 0) {
        problemas.push(`${onde}: ponto de cor com caixa zerada (${ponto.largura}×${ponto.altura})`);
      }
    }
  };

  const conferir = async (onde, seletor) => {
    const linhas = await medirLinhas(seletor);
    if (linhas.length === 0) problemas.push(`${onde}: nenhuma linha renderizada (${seletor})`);
    for (const linha of linhas) {
      if (linha.altura <= 0 || linha.largura <= 0) {
        problemas.push(
          `${onde}: linha com caixa zerada (${linha.largura}×${linha.altura}) — "${linha.texto}"`,
        );
      }
      if (linha.direita > VIEWPORT_CELULAR.width + 1) {
        problemas.push(
          `${onde}: linha vazando ${linha.direita - VIEWPORT_CELULAR.width}px da viewport — "${linha.texto}"`,
        );
      }
    }
    await conferirPontos(onde);
    return linhas;
  };

  const capturar = async (rotulo, arquivo) => {
    const png = path.join(SAIDA, `listas-${arquivo}${marca}.png`);
    await page.screenshot({ path: png, fullPage: true });
    gerados.push(png);
    itens.push({ rotulo, png });
    return png;
  };

  const alturaMedia = (linhas) =>
    linhas.length === 0 ? 0 : linhas.reduce((s, l) => s + l.altura, 0) / linhas.length;

  // ── /leads: completo → compacto → um card expandido ────────────────
  await page.goto(`${BASE}/leads`, { waitUntil: "domcontentloaded" });
  await assentar(page);
  await exigirLogado(page, "listas/leads");
  const completas = await conferir("leads completo", "section ul > li");
  await capturar("leads · completo", "leads-completo");

  await page.getByRole("button", { name: /Completo|Compacto/ }).click();
  await page.waitForTimeout(400);
  const compactas = await conferir("leads compacto", "section ul > li");
  await capturar("leads · compacto", "leads-compacto");

  if (alturaMedia(compactas) >= alturaMedia(completas)) {
    problemas.push(
      `modo compacto não compactou: média ${alturaMedia(compactas).toFixed(0)}px vs ${alturaMedia(
        completas,
      ).toFixed(0)}px do card completo`,
    );
  }

  // Recarrega: a preferência tem que ter ido pro DOC, não pro estado local.
  await page.reload({ waitUntil: "domcontentloaded" });
  await assentar(page);
  const persistidas = await conferir("leads compacto (recarregado)", "section ul > li");
  if (alturaMedia(persistidas) >= alturaMedia(completas)) {
    problemas.push("modo compacto não sobreviveu à recarga (preferência não foi pro doc)");
  }
  await capturar("leads · compacto após recarga", "leads-compacto-recarga");

  // Tocar num card expande SÓ aquele.
  await page.locator("section ul > li button").first().click();
  await page.waitForTimeout(300);
  const expandidas = await conferir("leads com um expandido", "section ul > li");
  const maiores = expandidas.filter((l) => l.altura > alturaMedia(compactas) * 1.5);
  if (maiores.length !== 1) {
    problemas.push(`tocar no card expandiu ${maiores.length} cards (esperado exatamente 1)`);
  }
  await capturar("leads · um card expandido", "leads-expandido");

  // Grupo dobrado: o cabeçalho tem que se bastar sozinho na tela.
  await page.locator('section > div > button[aria-expanded="true"]').first().click();
  await page.waitForTimeout(400);
  await conferir("leads grupo dobrado", "section > div");
  await capturar("leads · grupo dobrado", "leads-grupo-dobrado");

  // ── /buscas: cards dobrados + agrupamento por mês e por nicho ──────
  await page.goto(`${BASE}/buscas`, { waitUntil: "domcontentloaded" });
  await assentar(page);
  await exigirLogado(page, "listas/buscas");
  const buscasAbertas = await conferir("buscas aberto", "section ul > li");
  await capturar("buscas · aberto", "buscas-aberto");

  // Sempre o PRIMEIRO ainda aberto: coletar os handles antes e clicar em
  // sequência não funciona — cada clique remonta a lista e invalida o resto.
  const aindaAbertas = page.locator('li button[aria-expanded="true"]');
  for (let i = 0; (await aindaAbertas.count()) > 0 && i < 20; i += 1) {
    await aindaAbertas.first().click();
    await page.waitForTimeout(150);
  }
  const buscasDobradas = await conferir("buscas dobrado", "section ul > li");
  if (alturaMedia(buscasDobradas) >= alturaMedia(buscasAbertas)) {
    problemas.push("dobrar as buscas não reduziu a altura dos cards");
  }
  await capturar("buscas · dobrado", "buscas-dobrado");

  for (const [modo, rotulo] of [
    ["mes", "por mês"],
    ["nicho", "por nicho"],
  ]) {
    await page.selectOption("select", modo);
    await page.waitForTimeout(400);
    await conferir(`buscas ${modo}`, "section ul > li");
    const grupos = await medirLinhas("section > button");
    if (grupos.length < 2) {
      problemas.push(`agrupamento ${modo} rendeu ${grupos.length} grupo(s) — seed sem variedade?`);
    }
    await capturar(`buscas · ${rotulo}`, `buscas-${modo}`);
  }

  gerados.push(
    await folhaDeContato(page, "Compactação de /leads e /buscas (celular)", "listas", [
      { rotulo: "leads", itens: itens.slice(0, 3) },
      { rotulo: "leads", itens: itens.slice(3, 5) },
      { rotulo: "buscas", itens: itens.slice(5) },
    ]),
  );
  await ctx.close();

  console.log(`[listas] ${itens.length} estados capturados no celular.`);
  if (problemas.length > 0) {
    throw new Error(`[listas] ${problemas.length} problema(s):\n  ${problemas.join("\n  ")}`);
  }
  console.log("[listas] ok — nenhuma linha com altura zero, nenhuma vazando, compactação medida.");
  return gerados;
}

/* ── Item: tema × aba ────────────────────────────────────────────────── */

async function capturarTemasEAbas(browser, secret, viewport, sufixo) {
  const gerados = [];
  for (const tema of TEMAS) {
    definirTemaNoDoc("admin", tema);
    const ctx = await contextoLogado(browser, { viewport, secret, tema });
    const page = await ctx.newPage();
    const itens = [];
    for (const aba of ABAS) {
      await page.goto(`${BASE}${aba.url}`, { waitUntil: "domcontentloaded" });
      await assentar(page);
      await exigirLogado(page, `${tema}/${aba.id}`);
      await exigirTema(page, tema, `${tema}/${aba.id}`);
      await exigirCromoNoLugar(page, `${tema}/${aba.id}`);
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
  // --surface-2 é o degrau de elevação (chips, linhas de tabela, o item
  // ativo do seletor de tema). Faltava aqui, e era justamente onde o tema
  // escuro reprovava — quem achou foi a varredura no DOM, não esta tabela.
  ["--ink-muted", "--surface-2", 4.5, "rótulo/legenda em superfície elevada"],
  ["--ink-secondary", "--surface-2", 4.5, "texto secundário em superfície elevada"],
  ["--foreground", "--surface-2", 7.0, "texto de leitura em superfície elevada"],
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
        /*
         * getComputedStyle NÃO resolve custom property: `--foreground`
         * volta como o TEXTO declarado ("#eaf4e4"), não como rgb(). Uma
         * regex de números sobre esse texto lê dígitos do hex e inventa
         * uma cor — foi o que a primeira versão desta medição fez, e o
         * relatório saiu com `--status-respondeu #050908`.
         *
         * A saída é deixar o BROWSER pintar: um probe com
         * `color: var(--token)` devolve `rgb(r, g, b)` resolvido, e o
         * mesmo caminho serve para hex literal, rgba() e color-mix().
         */
        const probe = document.createElement("span");
        probe.style.display = "none";
        document.body.appendChild(probe);
        const doToken = (t) => {
          probe.style.color = "";
          probe.style.color = t.startsWith("--") ? `var(${t})` : t;
          const m = getComputedStyle(probe).color.match(/[\d.]+/g);
          return m && m.length >= 3 ? m.slice(0, 3).map(Number) : null;
        };
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
    "\n  [iris] cromo RASTERIZADO (header + barra inferior), pixel a pixel:",
  );
  const linhas = [];
  for (const tema of TEMAS) {
    definirTemaNoDoc("admin", tema);
    await page.goto(`${BASE}/hoje`, { waitUntil: "domcontentloaded" });
    await assentar(page);
    await exigirLogado(page, `iris/${tema}`);
    await exigirTema(page, tema, `iris/${tema}`);

    /*
     * A iridescência é um `::after` — `querySelectorAll("*")` NÃO enxerga
     * pseudo-elemento, e a primeira versão desta medição varria as cores
     * DECLARADAS dos nós e reportava "miolo 99.9%" nos cinco temas, sem
     * nunca ter visto a linha. A resposta honesta é rasterizar: captura o
     * header e a nav e conta pixel, que é o que a pessoa vê.
     */
    const faixas = { lima: 0, miolo: 0, rosa: 0 };
    let coloridos = 0;
    let total = 0;
    // Header e nav contados TAMBÉM em separado: somados, um dos dois poderia
    // estar sem linha nenhuma e o total continuaria bonito.
    const porElemento = {};
    for (const seletor of ["header", "nav"]) {
      const antes = { ...faixas, coloridos };
      const alvo = page.locator(seletor).first();
      const png = path.join(SAIDA, `_iris-${tema}-${seletor}${marca}.png`);
      await alvo.screenshot({ path: png });
      const { w, h, canais, px } = lerPng(png);
      for (let i = 0; i < w * h; i++) {
        const r = px[i * canais];
        const g = px[i * canais + 1];
        const b = px[i * canais + 2];
        total++;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        // Croma baixo = a superfície sólida do cromo (preto/cinza/branco):
        // não é matiz, e é a MAIORIA dos pixels — contá-la afogaria tudo.
        if (d < 40 || max < 45) continue;
        coloridos++;
        let hue;
        if (max === r) hue = (((g - b) / d) % 6) * 60;
        else if (max === g) hue = ((b - r) / d + 2) * 60;
        else hue = ((r - g) / d + 4) * 60;
        if (hue < 0) hue += 360;
        if (hue >= 55 && hue < 110) faixas.lima++;
        else if (hue >= 280 || hue < 20) faixas.rosa++;
        else faixas.miolo++;
      }
      await fs.unlink(png).catch(() => {});
      porElemento[seletor] = {
        lima: faixas.lima - antes.lima,
        miolo: faixas.miolo - antes.miolo,
        rosa: faixas.rosa - antes.rosa,
        coloridos: coloridos - antes.coloridos,
      };
    }

    const soma = faixas.lima + faixas.miolo + faixas.rosa || 1;
    const pct = (v) => ((v / soma) * 100).toFixed(1).padStart(5);
    const rosaPct = (faixas.rosa / soma) * 100;
    console.log(
      `    ${tema.padEnd(7)} lima ${pct(faixas.lima)}%  miolo ${pct(faixas.miolo)}%` +
        `  rosa ${pct(faixas.rosa)}%   |  cromo colorido: ` +
        `${((coloridos / total) * 100).toFixed(1)}% dos pixels` +
        `  ${rosaPct <= 20 ? "ok (rosa ≤20%)" : "XX rosa demais"}`,
    );
    for (const [seletor, v] of Object.entries(porElemento)) {
      const s2 = v.lima + v.miolo + v.rosa || 1;
      const p2 = (n) => ((n / s2) * 100).toFixed(1).padStart(5);
      console.log(
        `            ${seletor.padEnd(7)} lima ${p2(v.lima)}%  miolo ${p2(v.miolo)}%` +
          `  rosa ${p2(v.rosa)}%  (${v.coloridos} px coloridos)` +
          `  ${v.coloridos > 0 ? "ok" : "XX SEM linha iridescente"}`,
      );
    }
    linhas.push({ tema, faixas, soma, coloridos, total, porElemento });
  }
  await ctx.close();
  const destino = path.join(SAIDA, `_iris${marca}.md`);
  await fs.writeFile(
    destino,
    [
      "# Proporção de matiz no CROMO (header + barra inferior), rasterizado",
      "",
      "Captura dos dois elementos de cromo, decodificada pixel a pixel",
      "(`scripts/png.mjs`). Pixel de croma baixo (max-min < 40) é superfície",
      "sólida, não matiz, e fica fora da conta. Faixas: lima 55–110°,",
      "rosa ≥280° ou <20°, miolo o resto.",
      "",
      "| tema | lima | miolo | rosa | cromo colorido |",
      "|---|---|---|---|---|",
      ...linhas.map(
        (l) =>
          `| \`${l.tema}\` | ${((l.faixas.lima / l.soma) * 100).toFixed(1)}% | ` +
          `${((l.faixas.miolo / l.soma) * 100).toFixed(1)}% | ` +
          `**${((l.faixas.rosa / l.soma) * 100).toFixed(1)}%** | ` +
          `${((l.coloridos / l.total) * 100).toFixed(1)}% dos pixels |`,
      ),
    ].join("\n"),
  );
  return [destino];
}

/* ── Item: legibilidade no DOM real ─────────────────────────────────── */

/**
 * Varre TODO elemento que contém texto, em cada aba de cada tema, e responde
 * duas perguntas com número em vez de opinião:
 *
 *   1. tem gradiente na CADEIA DE FUNDO desse texto? (a regra de
 *      legibilidade proíbe — texto de leitura fica em superfície sólida);
 *   2. qual o contraste real entre a cor computada do texto e o fundo
 *      efetivo — não o par de tokens da planilha, mas o que está pintado.
 *
 * O par estático disto é `globals.legibilidade.test.ts`, que lê o CSS. Os
 * dois são necessários: o teste pega a regra nova antes de existir tela,
 * esta varredura pega o caso em que uma classe permitida foi aplicada no
 * lugar errado — coisa que nenhum parser de CSS enxerga.
 */
async function medirLegibilidade(browser, secret) {
  const ctx = await contextoLogado(browser, { viewport: VIEWPORT_DESKTOP, secret });
  const page = await ctx.newPage();
  console.log("\n  [legibilidade] texto × fundo efetivo, no DOM real de cada aba:");

  const porTema = [];
  let falhas = 0;

  for (const tema of TEMAS) {
    definirTemaNoDoc("admin", tema);
    let pior = null;
    let nos = 0;
    const gradientes = [];

    for (const aba of ABAS) {
      await page.goto(`${BASE}${aba.url}`, { waitUntil: "domcontentloaded" });
      await assentar(page);
      await exigirLogado(page, `legibilidade/${tema}/${aba.id}`);
      await exigirTema(page, tema, `legibilidade/${tema}/${aba.id}`);

      const achado = await page.evaluate(() => {
        const lin = (c) => {
          const s = c / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
        const rgba = (v) => {
          const m = v.match(/[\d.]+/g);
          return m ? m.slice(0, 4).map(Number) : null;
        };
        const razao = (a, b) => {
          const la = lum(a);
          const lb = lum(b);
          return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        };

        /** Sobe até achar o primeiro fundo OPACO — é o que pinta atrás do texto. */
        function fundoEfetivo(el) {
          let atual = el;
          const gradientesNaCadeia = [];
          while (atual) {
            const cs = getComputedStyle(atual);
            if (cs.backgroundImage && cs.backgroundImage !== "none") {
              // `background-image` do PRÓPRIO elemento (pseudo-elemento não
              // entra: ::after pinta por cima, não por baixo).
              if (/gradient\(/.test(cs.backgroundImage)) {
                gradientesNaCadeia.push(
                  `${atual.tagName.toLowerCase()}.${String(atual.className).slice(0, 60)}`,
                );
              }
            }
            const cor = rgba(cs.backgroundColor);
            if (cor && (cor[3] === undefined || cor[3] >= 0.95)) {
              return { cor: cor.slice(0, 3), gradientesNaCadeia };
            }
            atual = atual.parentElement;
          }
          return { cor: [0, 0, 0], gradientesNaCadeia };
        }

        const resultado = { nos: 0, pior: null, gradientes: [] };
        for (const el of document.querySelectorAll("body *")) {
          // Só quem tem texto PRÓPRIO (nó de texto direto), com tamanho real.
          const texto = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent.trim())
            .join("");
          if (texto.length < 2) continue;
          const caixa = el.getBoundingClientRect();
          if (caixa.width < 2 || caixa.height < 2) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || Number(cs.opacity) < 0.3) continue;
          const cor = rgba(cs.color);
          if (!cor) continue;

          const { cor: fundo, gradientesNaCadeia } = fundoEfetivo(el);
          resultado.nos++;
          for (const g of gradientesNaCadeia) {
            if (!resultado.gradientes.includes(g)) resultado.gradientes.push(g);
          }
          const r = razao(cor.slice(0, 3), fundo);
          if (!resultado.pior || r < resultado.pior.razao) {
            resultado.pior = {
              razao: r,
              texto: texto.slice(0, 40),
              tamanho: cs.fontSize,
            };
          }
        }
        return resultado;
      });

      nos += achado.nos;
      for (const g of achado.gradientes) if (!gradientes.includes(g)) gradientes.push(g);
      if (achado.pior && (!pior || achado.pior.razao < pior.razao)) {
        pior = { ...achado.pior, aba: aba.id };
      }
    }

    // O piso é 4.5:1 (texto normal). Texto grande passaria com 3:1, mas não
    // vale relaxar: se o pior caso do app inteiro já cumpre o piso duro, não
    // há motivo pra abrir exceção por tamanho de fonte.
    const ok = pior && pior.razao >= 4.5 && gradientes.length === 0;
    if (!ok) falhas++;
    console.log(
      `    ${tema.padEnd(7)} ${nos} nós de texto  |  pior contraste ` +
        `${pior ? pior.razao.toFixed(2) : "?"}:1 em "${pior?.texto ?? ""}" (${pior?.aba}, ${pior?.tamanho})` +
        `  |  gradiente sob texto: ${gradientes.length === 0 ? "NENHUM" : gradientes.join(", ")}` +
        `  ${ok ? "ok" : "XX"}`,
    );
    porTema.push({ tema, nos, pior, gradientes });
  }

  await ctx.close();
  const destino = path.join(SAIDA, `_legibilidade${marca}.md`);
  await fs.writeFile(
    destino,
    [
      "# Legibilidade no DOM real — texto × fundo efetivo",
      "",
      "Varredura de TODO elemento com texto próprio, nas 7 abas, em cada tema.",
      "Para cada um: sobe a árvore até o primeiro fundo opaco (o que de fato",
      "pinta atrás do texto), registra se havia gradiente na cadeia e mede o",
      "contraste entre a `color` computada e esse fundo.",
      "",
      "| tema | nós de texto | pior contraste | onde | gradiente sob texto |",
      "|---|---|---|---|---|",
      ...porTema.map(
        (t) =>
          `| \`${t.tema}\` | ${t.nos} | **${t.pior?.razao.toFixed(2)}:1** | ` +
          `"${t.pior?.texto}" (${t.pior?.aba}) | ` +
          `${t.gradientes.length === 0 ? "nenhum" : t.gradientes.join(", ")} |`,
      ),
    ].join("\n"),
  );
  console.log(
    `\n  [legibilidade] ${falhas === 0 ? "todos os temas passam" : `${falhas} tema(s) REPROVADO(s)`}`,
  );
  return [destino];
}

/* ── Item: theme-color acompanha o tema do usuário ──────────────────── */

/** Espelha TEMAS_META[...].barra de src/lib/tema.ts (a --surface de cada tema). */
const BARRA_ESPERADA = {
  escuro: "#121b24",
  claro: "#ffffff",
  acido: "#111710",
  vapor: "#0b151d",
  prisma: "#140f22",
};

/**
 * Duas coisas, e as duas importam:
 *   1. o `<meta name="theme-color">` já sai CERTO no HTML do servidor — se
 *      só o cliente o ajustasse, a barra do navegador piscaria na cor
 *      errada em toda carga, que é o problema que o cookie-espelho resolve;
 *   2. trocar de tema pelo seletor muda o `content` na hora, SEM recarregar,
 *      e continua existindo UMA só tag (criar uma segunda faria o navegador
 *      considerar a primeira e a barra não mudaria).
 */
async function medirBarra(browser, secret) {
  const ctx = await contextoLogado(browser, { viewport: VIEWPORT_DESKTOP, secret });
  const page = await ctx.newPage();
  console.log("\n  [barra] <meta name=\"theme-color\"> por tema:");

  const linhas = [];
  let falhas = 0;
  for (const tema of TEMAS) {
    definirTemaNoDoc("admin", tema);
    // Carga de AQUECIMENTO: o servidor lê o cookie-espelho, e o cookie só é
    // escrito quando uma rota o escreve — no app real isso acontece no login.
    // Sem este passo, a medição do HTML do servidor sai atrasada em um tema
    // (foi o que a primeira rodada mostrou: servidor=#121b24 no "claro"), e o
    // atraso seria do laço, não do produto. Aqui o próprio GET /api/tema do
    // TemaSeletor põe o navegador no estado de regime.
    await page.goto(`${BASE}/hoje`, { waitUntil: "domcontentloaded" });
    await assentar(page);

    const resposta = await page.goto(`${BASE}/hoje`, { waitUntil: "domcontentloaded" });
    const html = await resposta.text();
    const noServidor = /<meta name="theme-color" content="([^"]+)"/.exec(html)?.[1];
    await assentar(page);
    await exigirTema(page, tema, `barra/${tema}`);
    const { conteudo, tags } = await page.evaluate(() => {
      const todas = document.querySelectorAll('meta[name="theme-color"]');
      return { conteudo: todas[0]?.getAttribute("content") ?? null, tags: todas.length };
    });

    const esperado = BARRA_ESPERADA[tema];
    const ok = noServidor?.toLowerCase() === esperado && conteudo?.toLowerCase() === esperado && tags === 1;
    if (!ok) falhas++;
    console.log(
      `    ${tema.padEnd(7)} servidor=${noServidor}  DOM=${conteudo}  tags=${tags}` +
        `  esperado=${esperado}  ${ok ? "ok" : "XX"}`,
    );
    linhas.push({ tema, noServidor, conteudo, tags, esperado, ok });
  }

  // A troca pelo seletor, sem recarregar: é o "muda quando ele troca de tema".
  definirTemaNoDoc("admin", TEMAS[0]);
  await page.goto(`${BASE}/hoje`, { waitUntil: "domcontentloaded" });
  await assentar(page);
  const leMeta = () =>
    page.evaluate(() =>
      document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
    );
  const antes = await leMeta();
  const alvo = TEMAS[TEMAS.length - 1];
  await page.getByRole("button", { name: /Trocar de tema/ }).click();
  await page.getByRole("menuitemradio", { name: new RegExp(`^${alvo}`, "i") }).click();
  await page.waitForTimeout(500);
  const depois = await leMeta();
  const semRecarregar = depois?.toLowerCase() === BARRA_ESPERADA[alvo] && antes !== depois;
  if (!semRecarregar) falhas++;
  console.log(
    `    troca ${TEMAS[0]} → ${alvo} sem recarregar: ${antes} → ${depois}` +
      `  ${semRecarregar ? "ok" : "XX"}`,
  );

  await ctx.close();
  const destino = path.join(SAIDA, `_barra${marca}.md`);
  await fs.writeFile(
    destino,
    [
      "# `<meta name=\"theme-color\">` por tema",
      "",
      "A cor da barra do navegador é a `--surface` do tema ativo do usuário — a",
      "mesma cor do header, para a barra ficar contínua com ele. Sai pronta no",
      "HTML do SERVIDOR (`generateViewport` lê o cookie-espelho), e o seletor",
      "reescreve o `content` na troca, sem recarregar.",
      "",
      "| tema | no HTML do servidor | no DOM | tags | esperado |",
      "|---|---|---|---|---|",
      ...linhas.map(
        (l) =>
          `| \`${l.tema}\` | \`${l.noServidor}\` | \`${l.conteudo}\` | ${l.tags} | ` +
          `\`${l.esperado}\` ${l.ok ? "✓" : "✗"} |`,
      ),
      "",
      `Troca pelo seletor, sem recarregar: \`${antes}\` → \`${depois}\`.`,
    ].join("\n"),
  );
  console.log(`\n  [barra] ${falhas === 0 ? "todos os temas passam" : `${falhas} FALHA(S)`}`);
  return [destino];
}

/* ── Item: custo — animações vivas no DOM em repouso ────────────────── */

/**
 * Conta o que está ANIMANDO em cada aba, com a página parada, e separa o que
 * é cromo do que é conteúdo. É a medição direta da regra "nenhuma animação
 * contínua no cromo da interface" — o fps mede a consequência, isto mede a
 * causa, e a causa é o que se conserta.
 *
 * `getAnimations()` devolve as animações VIVAS: uma transição que já
 * terminou não aparece, e uma animação `infinite` aparece para sempre. Por
 * isso a leitura é feita depois de a página assentar.
 */
async function medirCusto(browser, secret) {
  const ctx = await contextoLogado(browser, { viewport: VIEWPORT_DESKTOP, secret });
  const page = await ctx.newPage();
  console.log("\n  [custo] animações VIVAS com a página em repouso (cromo × conteúdo):");

  const linhas = [];
  let falhas = 0;
  for (const tema of TEMAS) {
    definirTemaNoDoc("admin", tema);
    const doTema = { cromo: [], conteudo: [] };
    for (const aba of ABAS) {
      await page.goto(`${BASE}${aba.url}`, { waitUntil: "domcontentloaded" });
      await assentar(page);
      await exigirLogado(page, `custo/${tema}/${aba.id}`);
      await exigirTema(page, tema, `custo/${tema}/${aba.id}`);
      // Mais um beat: a entrada de página (.page-transition, 0.28s finita)
      // ainda estaria viva e contaria como animação sem ser contínua.
      await page.waitForTimeout(800);

      const achado = await page.evaluate(() => {
        const cromo = [];
        const conteudo = [];
        for (const anim of document.getAnimations()) {
          const alvo = anim.effect?.target;
          if (!alvo || anim.playState !== "running") continue;
          const t = anim.effect.getComputedTiming();
          // Só o que é CONTÍNUO: iterações infinitas.
          if (t.iterations !== Infinity) continue;
          const nome = String(anim.animationName ?? anim.constructor.name);
          const emCromo = Boolean(
            alvo.closest?.("header, nav, [data-cromo]") ||
              alvo.closest?.(".cromo-linha, .cromo-aba-ativa, .cromo-realce"),
          );
          const registro = `${nome}@${alvo.tagName?.toLowerCase() ?? "?"}`;
          (emCromo ? cromo : conteudo).push(registro);
        }
        return { cromo, conteudo };
      });
      for (const c of achado.cromo) if (!doTema.cromo.includes(c)) doTema.cromo.push(c);
      for (const c of achado.conteudo) if (!doTema.conteudo.includes(c)) doTema.conteudo.push(c);
    }

    const ok = doTema.cromo.length === 0;
    if (!ok) falhas++;
    console.log(
      `    ${tema.padEnd(7)} cromo: ${doTema.cromo.length === 0 ? "NENHUMA" : doTema.cromo.join(", ")}` +
        `  |  conteúdo: ${doTema.conteudo.length === 0 ? "nenhuma" : doTema.conteudo.join(", ")}` +
        `  ${ok ? "ok" : "XX animação contínua no cromo"}`,
    );
    linhas.push({ tema, ...doTema });
  }

  await ctx.close();
  const destino = path.join(SAIDA, `_custo${marca}.md`);
  await fs.writeFile(
    destino,
    [
      "# Animações contínuas com a página em repouso",
      "",
      "`document.getAnimations()` filtrado por `playState === \"running\"` e",
      "`iterations === Infinity`, nas 7 abas de cada tema, depois de a página",
      "assentar (a entrada de página é finita e já terminou). Alvo dentro de",
      "`header`/`nav`/`.cromo-*` conta como CROMO.",
      "",
      "| tema | no cromo | no conteúdo |",
      "|---|---|---|",
      ...linhas.map(
        (l) =>
          `| \`${l.tema}\` | **${l.cromo.length === 0 ? "nenhuma" : l.cromo.join(", ")}** | ` +
          `${l.conteudo.length === 0 ? "nenhuma" : l.conteudo.join(", ")} |`,
      ),
    ].join("\n"),
  );
  console.log(
    `\n  [custo] ${falhas === 0 ? "cromo sem animação contínua em nenhum tema" : `${falhas} tema(s) REPROVADO(s)`}`,
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
    definirTemaNoDoc("admin", tema);
    const medidas = [];
    for (let carga = 0; carga < FPS_CARGAS; carga++) {
      const ctx = await contextoLogado(browser, { viewport: FPS_VIEWPORT, secret, tema });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: FPS_CPU_THROTTLE });

      await page.goto(`${BASE}/hoje`, { waitUntil: "domcontentloaded" });
      await assentar(page);
      await exigirLogado(page, `fps/${tema}`);
      await exigirTema(page, tema, `fps/${tema}`);

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
    if (querido("listas")) gerados.push(...(await medirListas(browser, secret)));
    if (querido("usuario")) gerados.push(...(await provarPorUsuario(browser)));
    if (querido("contraste")) gerados.push(...(await medirContraste(browser, secret)));
    if (querido("iris")) gerados.push(...(await medirIris(browser, secret)));
    if (querido("legibilidade")) gerados.push(...(await medirLegibilidade(browser, secret)));
    if (querido("custo")) gerados.push(...(await medirCusto(browser, secret)));
    if (querido("barra")) gerados.push(...(await medirBarra(browser, secret)));
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
