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
 *   node scripts/qa-plataforma.mjs --so=pendencias # lista de print pendente em /config, cheia e VAZIA
 *   node scripts/qa-plataforma.mjs --so=fila      # a VISÃO da fila em /config: funil, próximos,
 *                                                 # bloqueados, RETIDOS (com e sem)
 *   node scripts/qa-plataforma.mjs --so=respostas # respostas pendentes em /config: cheia e VAZIA, celular e desktop
 *   node scripts/qa-plataforma.mjs --so=paineis   # PORTÃO dos blocos colapsáveis de /config: tudo fechado,
 *                                                 # um aberto e o estado PERSISTIDO entre recargas
 *   node scripts/qa-plataforma.mjs --so=teste     # o DISPARO DE TESTE em /config: pendente, repetições
 *                                                 # (zerado/andamento/cancelado), barrado, confirmado,
 *                                                 # desligado, e os 5 estados da CAPTURA do lead fixo
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

import { PAINEIS_CONFIG, PAINEIS_CONFIG_TOPO } from "./paineis-config.mjs";
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
  // Família fixada na URL: ver a semeadura de `janelasContato` em semear().
  { id: "mundo", url: "/mundo?familia=imobiliaria", rotulo: "Mundo" },
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
/**
 * Chave do DIA OPERACIONAL (mesma regra de `lib/fila/contadores.ts`): antes
 * de `inicioHora`, o instante ainda conta como o dia anterior.
 */
function chaveDiaOperacional(inicioHora, d = AGORA) {
  const hoje = chaveDia(d);
  if (inicioHora <= 0) return hoje;
  const hora = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hourCycle: "h23",
      hour: "2-digit",
    }).format(d),
  );
  if (hora >= inicioHora) return hoje;
  const ontem = new Date(d.getTime() - 86400000);
  return chaveDia(ontem);
}

/** Faixa cobrindo o dia inteiro, nos 7 dias — ver `janelasContato` abaixo. */
function diaInteiro(nivel) {
  return Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map((dia) => [
      dia,
      [{ inicio: { hora: 0, minuto: 0 }, fim: { hora: 23, minuto: 59 }, nivel }],
    ]),
  );
}

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
    // A tela /mundo depende do RELÓGIO: só lista país cujo minuto local cai
    // numa faixa `bom` da família escolhida. Com a tabela padrão, a mesma
    // rodada sairia cheia às 5h e vazia às 2h — e captura cujo CONTEÚDO
    // muda com a hora não prova nada. A aba abre em `/mundo?familia=
    // imobiliaria` e esta família ganha aqui uma faixa larga (5h–23h nos 7
    // dias), então há sempre país na lista, em qualquer horário de rodada.
    // As outras famílias ficam com o padrão — em especial `barbearia`, que
    // é a das FICHAS capturadas (a barra do dia delas continua mostrando a
    // escada de níveis de verdade).
    // Mesmo motivo para as duas famílias abaixo: a VISÃO da fila (--so=fila)
    // depende do relógio — quem é elegível agora muda a cada hora. Com faixa
    // de dia inteiro em todos os dias, `petshop` é SEMPRE bom (elegível) e
    // `multimarcas` é SEMPRE ruim (bloqueado por nível, e sem faixa aceita
    // em 7 dias), em qualquer horário de rodada. Os leads de fixture da fila
    // são dessas duas famílias, e só eles.
    janelasContato: {
      imobiliaria: {
        dias: Object.fromEntries(
          [0, 1, 2, 3, 4, 5, 6].map((dia) => [
            dia,
            [{ inicio: { hora: 5, minuto: 0 }, fim: { hora: 23, minuto: 0 }, nivel: "bom" }],
          ]),
        ),
      },
      petshop: { dias: diaInteiro("bom") },
      multimarcas: { dias: diaInteiro("ruim") },
    },
      atualizadoEm: iso(2),
    },
    // Fila de envio (painel em /config): pausada + tetos custom, pra
    // capturar o estado "Pausada" (o default já nasce ativo, e o botão de
    // pausa só prova que é óbvio se as duas cores aparecem em algum lugar).
    "config/fila": {
      ativo: false,
      metaDiaria: 20,
      tetoPorHora: 5,
      exigirJanelaBoa: true,
      // Os nichos dos fixtures da visão da fila (--so=fila). Um candidato de
      // "dentista" fica no pool de propósito, para a linha "fora dos nichos
      // permitidos" do funil não ser sempre zero.
      nichosPermitidos: ["petshop", "multimarcas"],
      intervaloMinimoSegundos: 240,
      // Retenção por claim não confirmada (--so=fila). Fixa aqui, e não no
      // default do código, para a captura não mudar se o padrão mudar.
      retencaoEnvioHoras: 12,
      inicioDiaOperacionalHora: 6,
      // Destino do disparo de teste (--so=teste). Fixo aqui para a captura
      // não depender do default do código mudar.
      numeroTeste: "5544984570105",
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
      // `seloContato` (clique no WhatsApp) é campo DIFERENTE de `contato`
      // (mudança de status) — sem semear este aqui, a faixa amarela de
      // "já contatou" (densidades 2-4) nunca aparece em nenhuma captura.
      seloContato: { userId: "membro-1", em: iso(7) },
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
      seloContato: { userId: "admin", em: iso(9) },
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
    // Lead ESTRANGEIRO (Zurique, Suíça) — o único fixture com `horarios` de
    // verdade (as demais tiram a barra da estimativa por país). É ele que
    // prova a HORA DUPLA na ficha: fuso do lead (CEST, +120) × fuso de quem
    // está logado divergem, então a linha abaixo da barra, o marcador de
    // agora e o anel do WhatsApp mostram as duas horas lado a lado (ver
    // "Barra do dia por família" no ARCHITECTURE.md). Faixas cobrindo o dia
    // inteiro em todos os dias da semana — a captura só quer mostrar a hora
    // dupla, não testar recorte de expediente (isso já é `--so=barra`... não,
    // é o teste unitário de `barraDoDia.ts`).
    {
      placeId: "lead-suico",
      nome: "Kaffeehaus Zürich",
      endereco: "Bahnhofstrasse 1, 8001 Zürich, Suíça",
      status: "novo",
      busca: { nicho: "barbearia", regiao: "Zürich, Suíça", em: iso(3) },
      temTelefone: true,
      telefone: "+41 44 000 00 00",
      telefoneIntl: "41440000000",
      temSite: false,
      siteProprio: false,
      criadoEm: iso(3),
      atualizadoEm: iso(1),
      enriquecido: true,
      horarios: {
        faixas: Array.from({ length: 7 }, (_, dia) => ({
          diaAbre: dia,
          horaAbre: 0,
          minAbre: 0,
          diaFecha: dia,
          horaFecha: 23,
          minFecha: 59,
        })),
        utcOffsetMinutes: 120, // CEST (horário de verão europeu)
        obtidoEm: iso(1),
      },
    },
    // Lead NACIONAL, expediente CURTO (9h-19h, mesma âncora de
    // barraDoDia.test.ts) — ao lado do suíço (24h) prova a régua nos dois
    // extremos de duração: marca regular de 2 em 2h (10h, 14h, 18h) MAIS a
    // hora exata de cada troca de faixa da barbearia (11h30 bom→razoável,
    // 16h30 razoável→ruim), sem repetir os extremos já rotulados (9h/19h)
    // — ver ARCHITECTURE.md, "Barra do dia por família", item 14.
    {
      placeId: "lead-nacional",
      nome: "Barbearia Cidade Baixa",
      endereco: "Av. Brasil, 100 — Porto Alegre, RS",
      status: "novo",
      busca: { nicho: "barbearia", regiao: "Porto Alegre RS", em: iso(3) },
      temTelefone: true,
      telefone: "(51) 98888-0000",
      telefoneIntl: "5551988880000",
      temSite: false,
      siteProprio: false,
      criadoEm: iso(3),
      atualizadoEm: iso(1),
      enriquecido: true,
      horarios: {
        faixas: Array.from({ length: 7 }, (_, dia) => ({
          diaAbre: dia,
          horaAbre: 9,
          minAbre: 0,
          diaFecha: dia,
          horaFecha: 19,
          minFecha: 0,
        })),
        utcOffsetMinutes: -180, // Brasília
        obtidoEm: iso(1),
      },
    },
    // Lead que a FILA DE ENVIO parou: número marcado como sem WhatsApp E
    // tentativas esgotadas. Existe para as duas tarjas da ficha que nascem
    // com a fila do celular (ver "Fila de envio ao WhatsApp — as rotas")
    // terem onde aparecer: um lead que some da fila sem explicação é um
    // estado que mente, e isso não se julga por teste unitário.
    {
      placeId: "lead-fila-parada",
      nome: "Tabacaria do Mercado",
      endereco: "Av. Brasil, 300 — Porto Alegre, RS",
      status: "novo",
      busca: { nicho: "barbearia", regiao: "Porto Alegre RS", em: iso(3) },
      temTelefone: true,
      telefone: "(51) 97777-0000",
      telefoneIntl: "5551977770000",
      temSite: false,
      siteProprio: false,
      telefoneInvalido: true,
      criadoEm: iso(3),
      atualizadoEm: iso(1),
      enriquecido: true,
      horarios: {
        faixas: Array.from({ length: 7 }, (_, dia) => ({
          diaAbre: dia,
          horaAbre: 9,
          minAbre: 0,
          diaFecha: dia,
          horaFecha: 19,
          minFecha: 0,
        })),
        utcOffsetMinutes: -180,
        obtidoEm: iso(1),
      },
    },
  ];
  for (const l of leads) mapa[`leads/${l.placeId}`] = l;

  // A claim correspondente, com as tentativas esgotadas (TENTATIVAS_MAX = 3).
  mapa["filaEnvios/lead-fila-parada"] = {
    leadId: "lead-fila-parada",
    estado: "falhou",
    claimId: "claim-qa",
    reservadoEm: iso(1),
    expiraEm: iso(1),
    dispositivo: "android",
    tentativas: 3,
    ultimoErro: "WhatsApp não abriu a conversa",
    enviadoEm: null,
  };

  // PENDÊNCIA DE PRINT (painel "Fila de envio" em /config): o texto saiu e o
  // anexo falhou, então a macro reportou "enviado" com `detalhe` — ver
  // ARCHITECTURE.md, "`detalheEnvio` — o texto saiu, o print não". Pendura
  // os docs de fila em leads que JÁ existem na semeadura, para não mexer no
  // tamanho de /leads (que o --so=listas mede). Três estados de propósito:
  // recente, detalhe LONGO (o pior caso de layout — o campo é cortado em
  // 300 no servidor) e um já resolvido, que só aparece em "ver resolvidas".
  const pendencias = [
    ["lead-2", "print não anexou: galeria vazia", iso(0), false],
    [
      "lead-6",
      "o whatsapp abriu a conversa e o texto saiu, mas a galeria não carregou a imagem a " +
        "tempo e o anexo foi cancelado pelo sistema; a macro seguiu para o próximo lead sem " +
        "repetir o passo do print, para não correr o risco de mandar a mensagem duas vezes",
      iso(2),
      false,
    ],
    ["lead-4", "print saiu cortado, refiz à mão", iso(5), true],
  ];
  for (const [leadId, detalhe, enviadoEm, resolvido] of pendencias) {
    mapa[`filaEnvios/${leadId}`] = {
      leadId,
      estado: "enviado",
      claimId: `claim-qa-${leadId}`,
      reservadoEm: enviadoEm,
      expiraEm: enviadoEm,
      dispositivo: "android",
      tentativas: 0,
      ultimoErro: null,
      enviadoEm,
      detalheEnvio: detalhe,
      ...(resolvido && { detalheEnvioResolvido: true }),
    };
  }

  // ── VISÃO DA FILA (painel "Fila de envio" em /config, --so=fila) ────
  //
  // Leads PRÓPRIOS, e não os de cima, porque a visão só mostra quem passa
  // na peneira estrutural inteira (status novo + telefone + demo + captura
  // PRONTA com print de celular + fuso). Família `petshop` = sempre bom
  // (elegível); `multimarcas` = sempre ruim (bloqueado), em qualquer hora
  // de rodada — ver `janelasContato` acima.
  const capturaPronta = {
    estado: "pronto",
    execucaoId: "exec-qa",
    pedidoEm: iso(2),
    imagens: [
      { ancora: "hero", tela: "celular", ordem: 1, url: "/qa.png", largura: 390, altura: 844 },
    ],
  };
  const leadDaFila = (placeId, nome, nicho) => ({
    placeId,
    nome,
    endereco: "Av. Brasil, 500 — Porto Alegre, RS",
    status: "novo",
    busca: { nicho, regiao: "Porto Alegre RS", em: iso(6) },
    temTelefone: true,
    telefone: "(51) 96666-0000",
    telefoneIntl: "5551966660000",
    temSite: false,
    siteProprio: false,
    demo: { skinId: "barbearia-editorial", themeId: "norte", dados: {}, criadoEm: iso(5) },
    capturas: capturaPronta,
    criadoEm: iso(6),
    atualizadoEm: iso(1),
    enriquecido: true,
    horarios: {
      faixas: Array.from({ length: 7 }, (_, dia) => ({
        diaAbre: dia,
        horaAbre: 0,
        minAbre: 0,
        diaFecha: dia,
        horaFecha: 23,
        minFecha: 59,
      })),
      utcOffsetMinutes: -180,
      obtidoEm: iso(1),
    },
  });

  // Seis elegíveis: um a mais que PAINEL_LINHAS (5), para a linha "e mais 1
  // na fila, nesta ordem" aparecer — é ela que diz que a lista é uma JANELA
  // sobre a fila, não a fila inteira.
  const elegiveis = [
    ["fila-1", "Pet Center Ipiranga"],
    ["fila-2", "Banho & Tosa Menino Deus"],
    ["fila-3", "Mundo Animal Petrópolis"],
    ["fila-4", "Pet Shop Bom Fim"],
    ["fila-5", "Clínica Veterinária Tristeza"],
    ["fila-6", "Agropet Cavalhada"],
  ];
  const bloqueados = [
    ["fila-b1", "Multimarcas Farrapos"],
    ["fila-b2", "Loja Multimarcas Azenha"],
  ];
  for (const [id, nome] of elegiveis) mapa[`leads/${id}`] = leadDaFila(id, nome, "petshop");
  for (const [id, nome] of bloqueados) mapa[`leads/${id}`] = leadDaFila(id, nome, "multimarcas");

  // O POOL: o cache que a visão lê (ela NUNCA reconstrói — ver
  // `lerPoolBruto`). `geradoEm` uns minutos atrás de propósito: é o retrato
  // que a tela data ao lado das sete contagens estruturais.
  const candidatoPool = (id, nicho, diasAtras) => ({
    id,
    nicho,
    offset: -180,
    faixas: Array.from({ length: 7 }, (_, dia) => ({
      diaAbre: dia,
      horaAbre: 0,
      minAbre: 0,
      diaFecha: dia,
      horaFecha: 23,
      minFecha: 59,
    })),
    criadoEm: iso(diasAtras),
  });
  mapa["filaCandidatos/pool"] = {
    geradoEm: new Date(AGORA.getTime() - 7 * 60000).toISOString(),
    candidatos: [
      ...elegiveis.map(([id], i) => candidatoPool(id, "petshop", 20 - i)),
      ...bloqueados.map(([id], i) => candidatoPool(id, "multimarcas", 12 - i)),
      // Barrado pelo NICHO: a etapa 3 do funil não pode ser sempre zero.
      candidatoPool("lead-5", "dentista", 9),
    ],
    lidos: 312,
    truncado: false,
    estrutural: {
      status: 180,
      descartado: 4,
      telefoneInvalido: 9,
      semTelefone: 21,
      semDemo: 60,
      capturaNaoPronta: 30,
      semFuso: 2,
    },
  };

  // ── RETIDOS POR ENVIO NÃO CONFIRMADO (--so=fila) ───────────────────
  //
  // Claims que MORRERAM EM SILÊNCIO: `estado: "reservado"`, prazo vencido, e
  // `expiraEm = reservadoEm + 5min` — é essa relação que a retenção lê para
  // distinguir silêncio de claim devolvida de propósito (ver
  // `claimExpiradaSemConfirmacao`). Minutos atrás, não dias: a janela padrão
  // é de 12h, e uma reserva de ontem já teria vencido.
  //
  // Leads PRÓPRIOS, fora do pool: o retido é justamente quem não é candidato.
  // Três estados de propósito — um recém retido (vence em quase 12h), um no
  // fim da janela (vence em minutos, o caso em que o "volta à fila" mais
  // importa) e um cujo LEAD foi excluído, que mostra o id sem nome.
  const retidos = [
    ["fila-r1", "Ótica Mercúrio", 40],
    ["fila-r2", "Serralheria Navegantes", 11 * 60 + 50],
    ["fila-r3", null, 200],
  ];
  for (const [id, nome, minutosAtras] of retidos) {
    if (nome) {
      mapa[`leads/${id}`] = {
        ...leadDaFila(id, nome, "petshop"),
        // Fora do pool de propósito: candidato ele apareceria nas outras
        // listas, e retido é exatamente quem NÃO é candidato.
      };
    }
    const reservadoEm = new Date(AGORA.getTime() - minutosAtras * 60000).toISOString();
    mapa[`filaEnvios/${id}`] = {
      leadId: id,
      estado: "reservado",
      claimId: `claim-qa-${id}`,
      reservadoEm,
      // +5min: exatamente o que `reservarLead` grava (RESERVA_DURACAO_MS).
      expiraEm: new Date(new Date(reservadoEm).getTime() + 5 * 60000).toISOString(),
      dispositivo: "android",
      tentativas: 0,
      ultimoErro: null,
      enviadoEm: null,
    };
  }

  // ── RESPOSTAS PENDENTES (painel próprio em /config, --so=respostas) ─
  //
  // Pendura nos leads da VISÃO da fila, que já existem e já têm nicho —
  // assim o painel não muda o tamanho de /leads (que o --so=listas mede).
  // Três estados de propósito: um grupo de VÁRIAS mensagens (o caso que o
  // agrupamento existe para produzir), uma mensagem só com rascunho LONGO e
  // quebras de linha (o pior caso de layout, e o texto que precisa
  // sobreviver à codificação da URL), e uma já usada — que NÃO pode
  // aparecer, é o que faz a lista esvaziar.
  const respostas = [
    {
      id: "resp-1",
      leadId: "fila-1",
      estado: "pendente",
      geradoEm: new Date(AGORA.getTime() - 4 * 60000).toISOString(),
      mensagens: [
        { texto: "Oi! Vi o site que vocês fizeram", recebidoEm: new Date(AGORA.getTime() - 9 * 60000).toISOString() },
        { texto: "ficou muito bom mesmo", recebidoEm: new Date(AGORA.getTime() - 8 * 60000).toISOString() },
        { texto: "quanto fica pra gente? e tem mensalidade?", recebidoEm: new Date(AGORA.getTime() - 7 * 60000).toISOString() },
      ],
      rascunho:
        "Que bom que gostou! Fica em R$ 2.000, sem mensalidade nenhuma — o domínio e a " +
        "hospedagem do primeiro ano já vão junto. Posso te mandar o link pra você mexer?",
    },
    {
      id: "resp-2",
      leadId: "fila-3",
      estado: "pendente",
      geradoEm: new Date(AGORA.getTime() - 26 * 60000).toISOString(),
      mensagens: [
        {
          texto: "bom dia, quem fala? recebi um link aqui de um site com o nome da minha loja",
          recebidoEm: new Date(AGORA.getTime() - 31 * 60000).toISOString(),
        },
      ],
      // Rascunho LONGO e com quebras de linha: é o pior caso de layout da
      // caixa editável, e é exatamente o texto que precisa atravessar a URI
      // de intent inteiro (ver `linkWhatsAppBusinessAndroid`).
      rascunho:
        "Bom dia! Aqui é o Willian.\n\nEu montei uma demonstração do site do Mundo Animal " +
        "Petrópolis pra te mostrar como ficaria — o link que você recebeu é ela, funcionando " +
        "de verdade, com os serviços e os horários de vocês.\n\nSe fizer sentido, fica em " +
        "R$ 2.000 (50% de sinal; 50% na entrega). Posso te explicar melhor?",
    },
    {
      // JÁ USADA: não entra na lista. É o que prova que a pendência SAI.
      id: "resp-3",
      leadId: "fila-2",
      estado: "usada",
      geradoEm: new Date(AGORA.getTime() - 90 * 60000).toISOString(),
      mensagens: [{ texto: "pode mandar", recebidoEm: new Date(AGORA.getTime() - 95 * 60000).toISOString() }],
      rascunho: "Mando agora!",
      textoUsado: "Mando agora mesmo!",
      resolvidoEm: new Date(AGORA.getTime() - 89 * 60000).toISOString(),
    },
  ];
  for (const resposta of respostas) mapa[`filaRespostas/${resposta.id}`] = resposta;

  // ── O LEAD FIXO DE TESTE (--so=teste) ───────────────────────────────
  //
  // Semeado PRONTO (demo + captura com print de celular) porque o passo do
  // disparo de teste precisa do alvo padrão servindo. Ele carrega
  // `leadDeTeste: true`, então nenhuma outra captura pode mostrá-lo: nem
  // /leads, nem /demos, nem /hoje, nem o funil da visão da fila.
  mapa["leads/radar-lead-teste"] = {
    placeId: "radar-lead-teste",
    nome: "Barbearia Dom Aurélio",
    endereco: "Rua Néo Alves Martins, 2820 — Zona 01, Maringá — PR, 87013-060",
    status: "novo",
    leadDeTeste: true,
    busca: { nicho: "barbearia", regiao: "Maringá PR", em: iso(40) },
    temSite: false,
    siteProprio: false,
    temTelefone: true,
    telefone: "(44) 3555-0142",
    telefoneIntl: "+55 44 3555-0142",
    enriquecido: false,
    horarios: {
      faixas: [2, 3, 4, 5, 6].map((dia) => ({
        diaAbre: dia,
        horaAbre: 9,
        minAbre: 0,
        diaFecha: dia,
        horaFecha: 19,
        minFecha: 0,
      })),
      utcOffsetMinutes: -180,
      obtidoEm: iso(40),
    },
    demo: { skinId: "barbearia-editorial", themeId: "norte", dados: {}, criadoEm: iso(40), atualizadoEm: iso(40) },
    capturas: capturaPronta,
    criadoEm: iso(40),
    atualizadoEm: iso(40),
  };

  // O CONTADOR do dia operacional (corte às 6h, como a config acima). Os
  // dois envios ficam a 30 e 50 min: dentro da hora corrida (para o "2/5 na
  // última hora" aparecer) e FORA do intervalo mínimo de 240s, para o ritmo
  // poder ficar liberado quando a captura despausar a fila.
  mapa[`filaContadores/${chaveDiaOperacional(6)}`] = {
    enviados: 4,
    envios: [
      new Date(AGORA.getTime() - 50 * 60000).toISOString(),
      new Date(AGORA.getTime() - 30 * 60000).toISOString(),
    ],
    ultimoEventoEm: new Date(AGORA.getTime() - 30 * 60000).toISOString(),
  };

  // Leads ESTRANGEIROS de imobiliária, não contatados: são eles que fazem a
  // linha do país abrir com "o que já está pago" na tela /mundo, em vez de
  // mandar direto pra busca. Dois países diferentes, de propósito — a tela
  // ordena por idioma e depois por índice.
  const paisesMundo = [
    ["mundo-pt", "Imobiliária Tejo", "Av. da Liberdade, 200, 1250-096 Lisboa, Portugal", "Lisboa, Portugal"],
    ["mundo-es", "Inmobiliaria Sol", "Calle Mayor, 3, 28013 Madrid, Espanha", "Madrid, Espanha"],
    ["mundo-es-2", "Casas del Centro", "Gran Via 8, 28013 Madrid, Espanha", "Madrid, Espanha"],
    ["mundo-mx", "Bienes Raíces Roma", "Av. Álvaro Obregón 100, 06700 Ciudad de México, México", "Cidade do México, México"],
  ];
  for (const [placeId, nome, endereco, regiao] of paisesMundo) {
    mapa[`leads/${placeId}`] = {
      placeId,
      nome,
      endereco,
      status: "novo",
      busca: { nicho: "imobiliaria", regiao, em: iso(4) },
      temSite: false,
      siteProprio: false,
      temTelefone: true,
      telefoneIntl: "351000000000",
      enriquecido: false,
      criadoEm: iso(4),
      atualizadoEm: iso(4),
    };
  }


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

/**
 * Abre (ou fecha) painéis da /config NO DOC do usuário — o mesmo campo que
 * o `PUT /api/preferencias/paineis` grava, e a mesma técnica de
 * `definirTemaNoDoc`, pelo mesmo motivo: o estado que a página resolve no
 * SERVIDOR não muda por cunhar cookie nenhum.
 *
 * É o que os passos que inspecionam um painel (`--so=pendencias`, `fila`,
 * `respostas`, `teste`) chamam antes de navegar: a /config nasce com TUDO
 * FECHADO, e um laço que mede a altura de um painel fechado mede zero. As
 * asserções deles continuam iguais; o que mudou é que agora precisam DIZER
 * qual painel estão olhando.
 */
function definirPaineisAbertosNoDoc(userId, ids) {
  const mapa = JSON.parse(fsSync.readFileSync(BANCO, "utf8"));
  mapa[`usuarios/${userId}`] = { ...mapa[`usuarios/${userId}`], paineisConfigAbertos: ids };
  fsSync.writeFileSync(BANCO, JSON.stringify(mapa));
}

/**
 * Tira (e devolve) as pendências de print do banco falso, para capturar o
 * ESTADO VAZIO da lista sem derrubar o servidor — o banco é um ARQUIVO,
 * mesmo motivo de `definirTemaNoDoc` poder trocar o tema no meio da rodada.
 */
let pendenciasGuardadas = null;
function esvaziarPendencias() {
  const mapa = JSON.parse(fsSync.readFileSync(BANCO, "utf8"));
  pendenciasGuardadas = {};
  for (const chave of Object.keys(mapa)) {
    if (chave.startsWith("filaEnvios/") && mapa[chave].detalheEnvio) {
      pendenciasGuardadas[chave] = mapa[chave];
      delete mapa[chave];
    }
  }
  fsSync.writeFileSync(BANCO, JSON.stringify(mapa));
}

function restaurarPendencias() {
  if (!pendenciasGuardadas) return;
  const mapa = JSON.parse(fsSync.readFileSync(BANCO, "utf8"));
  Object.assign(mapa, pendenciasGuardadas);
  fsSync.writeFileSync(BANCO, JSON.stringify(mapa));
  pendenciasGuardadas = null;
}

function lerTemaDoDoc(userId) {
  const mapa = JSON.parse(fsSync.readFileSync(BANCO, "utf8"));
  return mapa[`usuarios/${userId}`]?.tema;
}

/* ── Captura ─────────────────────────────────────────────────────────── */

async function contextoLogado(
  browser,
  { viewport, userId = "admin", papel = "admin", secret, tema, userAgent },
) {
  const ctx = await browser.newContext({
    viewport,
    ...(viewport === VIEWPORT_CELULAR && { deviceScaleFactor: 2, isMobile: true, hasTouch: true }),
    // O agente importa em UM lugar só: o painel de respostas pendentes
    // mostra o botão do Business apenas no ANDROID (ver `podeAbrirBusiness`
    // em lib/wa.ts). O Chromium do laço se apresenta como desktop, então
    // sem isto a captura do celular mostraria o caminho de copiar — o
    // contrário do que ela existe para provar.
    ...(userAgent && { userAgent }),
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
 * componente sabe renderizar denso; o que precisa ser verificado é o
 * caminho inteiro: tocar no controle → gravar no doc → recarregar e
 * continuar na densidade escolhida.
 *
 * Junto das capturas, o PORTÃO deste item, em quatro cobranças:
 *
 *   1. **nenhum slot renderiza com altura OU largura zero** — e "slot" aqui
 *      não é só a linha da lista: é cada folha com conteúdo dentro dela
 *      (ponto de cor, selo de status, chip de score, nome). É o análogo,
 *      para as listas, do `--so=colapso` das skins: um selo que "some" por
 *      colapsar a caixa não aparece como erro em captura nenhuma — a tela
 *      só fica um pouco mais vazia —, mas leva embora o estado do lead. A
 *      largura entrou junto da altura porque é ela que colapsa nas
 *      densidades altas, onde a coluna tem ~85px;
 *   2. **a grade tem mesmo N colunas** — contando quantos cards dividem a
 *      primeira linha. Sem isso, `grid-cols-N` montado em runtime (que o
 *      Tailwind não gera) passaria despercebido: a tela continuaria certa,
 *      só que sempre em 1 coluna;
 *   3. **densidade maior encurta a lista** — senão não houve densificação
 *      nenhuma;
 *   4. nada vaza horizontalmente da viewport do celular.
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
          topo: Math.round(r.top),
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

  /**
   * As FOLHAS com conteúdo dentro de cada card. É onde a densidade
   * machuca: o card continua com altura, e o que colapsa é o selo, o ponto
   * ou o chip lá dentro.
   *
   * Folha sem texto E sem fundo é pulada de propósito — o card completo
   * tem um `<span />` vazio de espaçamento, que é legitimamente 0×0. O que
   * sobra é exatamente o que se vê: quem tem texto, e quem é pintado (os
   * pontos de cor e de status, que são spans vazios COM fundo).
   */
  const conferirSlots = async (onde, seletor) => {
    const slots = await page.$$eval(seletor, (nos) =>
      nos.flatMap((no) =>
        [...no.querySelectorAll("*")]
          .filter((el) => {
            if (el.children.length > 0) return false;
            if (el.closest("svg")) return false;
            const estilo = getComputedStyle(el);
            if (estilo.display === "none") return false;
            const pintado =
              estilo.backgroundImage !== "none" ||
              !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(estilo.backgroundColor);
            return (el.textContent ?? "").trim().length > 0 || pintado;
          })
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              altura: Math.round(r.height),
              largura: Math.round(r.width),
              tag: el.tagName.toLowerCase(),
              texto: (el.textContent ?? "").trim().slice(0, 24),
            };
          }),
      ),
    );
    for (const slot of slots) {
      if (slot.altura <= 0 || slot.largura <= 0) {
        problemas.push(
          `${onde}: slot <${slot.tag}> com caixa zerada (${slot.largura}×${slot.altura}) — "${slot.texto}"`,
        );
      }
    }
    return slots.length;
  };

  /**
   * Quantos cards dividem a PRIMEIRA linha da grade — é a única maneira de
   * provar que a grade saiu do lugar. Comparar por `top` e não por `left`
   * porque cards da mesma linha podem ter alturas diferentes.
   */
  const colunasNaPrimeiraLinha = (linhas) => {
    if (linhas.length === 0) return 0;
    const topo = Math.min(...linhas.map((l) => l.topo));
    return linhas.filter((l) => Math.abs(l.topo - topo) <= 2).length;
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
    const slots = await conferirSlots(onde, seletor);
    if (slots === 0) problemas.push(`${onde}: nenhum slot com conteúdo dentro dos cards`);
    await conferirPontos(onde);
    return linhas;
  };

  /** Toca no botão de N cards por linha e espera a gravação otimista. */
  const escolherDensidade = async (n) => {
    await page.getByRole("button", { name: `${n} card${n > 1 ? "s" : ""} por linha` }).click();
    await page.waitForTimeout(350);
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

  // ── /leads: as quatro densidades, uma a uma ───────────────────────
  await page.goto(`${BASE}/leads`, { waitUntil: "domcontentloaded" });
  await assentar(page);
  await exigirLogado(page, "listas/leads");

  const alturaPorDensidade = {};
  for (const n of [1, 2, 3, 4]) {
    await escolherDensidade(n);
    const linhas = await conferir(`leads densidade ${n}`, "section ul > li");
    alturaPorDensidade[n] = alturaMedia(linhas);
    const colunas = colunasNaPrimeiraLinha(linhas);
    // `Math.min` porque o último grupo da tela pode ter menos cards do que
    // colunas — o que se cobra é que a grade não fique ABAIXO do escolhido.
    if (colunas !== Math.min(n, linhas.length)) {
      problemas.push(
        `leads densidade ${n}: ${colunas} card(s) na primeira linha (esperado ${Math.min(n, linhas.length)}) — a grade não aplicou`,
      );
    }
    await capturar(`leads · ${n} por linha`, `leads-d${n}`);
  }

  for (const [menor, maior] of [
    [1, 2],
    [2, 3],
    [3, 4],
  ]) {
    if (alturaPorDensidade[maior] >= alturaPorDensidade[menor]) {
      problemas.push(
        `leads: densidade ${maior} não encurtou o card (média ${alturaPorDensidade[maior].toFixed(
          0,
        )}px vs ${alturaPorDensidade[menor].toFixed(0)}px da ${menor})`,
      );
    }
  }

  // Recarrega: a escolha tem que ter ido pro DOC, não pro estado local.
  await page.reload({ waitUntil: "domcontentloaded" });
  await assentar(page);
  const persistidas = await conferir("leads densidade 4 (recarregado)", "section ul > li");
  if (colunasNaPrimeiraLinha(persistidas) !== Math.min(4, persistidas.length)) {
    problemas.push("densidade não sobreviveu à recarga (preferência não foi pro doc)");
  }
  await capturar("leads · 4 por linha após recarga", "leads-d4-recarga");

  // Densidade 1 mantém o recolher local: tocar no ▴ recolhe SÓ aquele card.
  await escolherDensidade(1);
  const antesDoRecolher = await medirLinhas("section ul > li");
  await page.getByRole("button", { name: /^Recolher / }).first().click();
  await page.waitForTimeout(300);
  const recolhidas = await conferir("leads com um recolhido", "section ul > li");
  const menores = recolhidas.filter((l) => l.altura < alturaMedia(antesDoRecolher) * 0.6);
  if (menores.length !== 1) {
    problemas.push(`tocar no ▴ recolheu ${menores.length} cards (esperado exatamente 1)`);
  }
  await capturar("leads · um card recolhido", "leads-recolhido");

  // Grupo dobrado: o cabeçalho tem que se bastar sozinho na tela.
  await page.locator('section > div > button[aria-expanded="true"]').first().click();
  await page.waitForTimeout(400);
  await conferir("leads grupo dobrado", "section > div");
  await capturar("leads · grupo dobrado", "leads-grupo-dobrado");

  // Regressão (ver "Correção de rolagem" no ARCHITECTURE.md): entrar em
  // /leads pela NAV INFERIOR — não voltando de uma ficha — tem que abrir no
  // TOPO, mesmo que a lista já tenha sido rolada nesta sessão. A causa era
  // a restauração de rolagem não distinguir "voltando da ficha" de
  // QUALQUER OUTRA chegada em /leads: uma vez a lista rolada, até o toque
  // no próprio ícone "Leads" da nav reabria no meio da fila.
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(250);
  await page.getByRole("link", { name: "Hoje" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Leads" }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  const scrollNaChegada = await page.evaluate(() => window.scrollY);
  if (scrollNaChegada !== 0) {
    problemas.push(
      `leads: entrada pela nav inferior abriu com scrollY=${scrollNaChegada} (esperado 0) — ` +
        `a restauração de rolagem só devia valer voltando de uma ficha de lead`,
    );
  }
  await capturar("leads · entrada pela nav inferior (topo)", "leads-nav-topo");

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

  // A grade vale para as faixas FECHADAS — e é por isso que ela só é
  // medida agora, com tudo dobrado.
  const alturaBuscaPorDensidade = {};
  for (const n of [1, 2, 3, 4]) {
    await escolherDensidade(n);
    const linhas = await conferir(`buscas densidade ${n}`, "section ul > li");
    alturaBuscaPorDensidade[n] = alturaMedia(linhas);
    const colunas = colunasNaPrimeiraLinha(linhas);
    if (colunas !== Math.min(n, linhas.length)) {
      problemas.push(
        `buscas densidade ${n}: ${colunas} faixa(s) na primeira linha (esperado ${Math.min(n, linhas.length)}) — a grade não aplicou`,
      );
    }
    await capturar(`buscas · ${n} por linha`, `buscas-d${n}`);
  }
  if (alturaBuscaPorDensidade[4] >= alturaBuscaPorDensidade[1]) {
    problemas.push("buscas: densidade 4 não encurtou a faixa fechada");
  }

  // Busca ABERTA volta a ocupar a linha inteira, mesmo na grade de 4.
  await page.locator('li button[aria-expanded="false"]').first().click();
  await page.waitForTimeout(350);
  const comUmaAberta = await conferir("buscas com uma aberta", "section ul > li");
  const abertaLarga = comUmaAberta.some((l) => l.largura > VIEWPORT_CELULAR.width * 0.8);
  if (!abertaLarga) {
    problemas.push("busca aberta não ocupou a linha inteira (col-span-full não aplicou)");
  }
  await capturar("buscas · uma aberta na grade de 4", "buscas-d4-aberta");
  await escolherDensidade(1);
  await page.waitForTimeout(200);

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

  // ── Ficha do lead ESTRANGEIRO: a hora dupla (ver ARCHITECTURE.md, "Barra
  // do dia por família", item 13) — fuso do lead × fuso de quem está
  // logado, na linha abaixo da barra, no marcador de agora e no anel do
  // WhatsApp.
  await page.goto(`${BASE}/leads/lead-suico`, { waitUntil: "domcontentloaded" });
  await assentar(page);
  await exigirLogado(page, "listas/ficha-estrangeiro");
  await page.waitForSelector('[role="img"][aria-label^="Barra do dia"]');
  await conferir("ficha lead estrangeiro", '[role="img"][aria-label^="Barra do dia"]');
  const linhaHoraDupla = await page
    .locator('[role="img"][aria-label^="Barra do dia"] ~ p')
    .textContent();
  if (!linhaHoraDupla || !/^\d.*em .+ · \d.* aqui/.test(linhaHoraDupla.trim())) {
    problemas.push(
      `ficha lead estrangeiro: linha da barra não mostrou a hora dupla ("${linhaHoraDupla?.trim()}")`,
    );
  } else {
    console.log(`  [listas] hora dupla na ficha do lead estrangeiro: "${linhaHoraDupla.trim()}"`);
  }
  await capturar("ficha · lead estrangeiro (hora dupla)", "ficha-estrangeiro");

  // ── Ficha do lead NACIONAL: expediente CURTO (9h-19h) — a régua ganha
  // marca regular de 2 em 2h mais a hora exata de cada troca de faixa (ver
  // fixture acima e ARCHITECTURE.md, "Barra do dia por família", item 14).
  await page.goto(`${BASE}/leads/lead-nacional`, { waitUntil: "domcontentloaded" });
  await assentar(page);
  await exigirLogado(page, "listas/ficha-nacional");
  await page.waitForSelector('[role="img"][aria-label^="Barra do dia"]');
  await conferir("ficha lead nacional", '[role="img"][aria-label^="Barra do dia"]');
  await capturar("ficha · lead nacional (expediente curto, régua com marcas)", "ficha-nacional");

  // ── Ficha do lead PARADO NA FILA: as duas tarjas que a fila de envio do
  // celular acrescentou (número sem WhatsApp, e parado por tentativas
  // esgotadas) mais o alternador que desfaz a marcação. Sem isto, um lead
  // que sai da fila sozinho não teria onde dizer por quê.
  await page.goto(`${BASE}/leads/lead-fila-parada`, { waitUntil: "domcontentloaded" });
  await assentar(page);
  await exigirLogado(page, "listas/ficha-fila-parada");
  for (const [alvo, oque] of [
    [/Número sem WhatsApp — fora da fila/, "tarja de número sem WhatsApp"],
    [/Parado na fila de envio após 3 tentativas/, "tarja de lead parado"],
    [/WhatsApp não abriu a conversa/, "último erro da fila"],
  ]) {
    if ((await page.getByText(alvo).count()) === 0) {
      problemas.push(`ficha lead parado: ${oque} não apareceu`);
    }
  }
  // O alternador tem que estar no estado MARCADO — é ele que desfaz.
  const desmarcar = page.getByRole("button", { name: "Número tem WhatsApp" });
  if ((await desmarcar.count()) === 0) {
    problemas.push("ficha lead parado: alternador não ofereceu desmarcar o telefone");
  }
  await conferir("ficha lead parado", "section");
  await capturar("ficha · lead parado na fila (tarjas + desmarcar)", "ficha-fila-parada");

  gerados.push(
    await folhaDeContato(page, "Densidade de /leads e /buscas (celular)", "listas", [
      { rotulo: "leads · densidades", itens: itens.slice(0, 4) },
      { rotulo: "leads · persistência, dobras e rolagem", itens: itens.slice(4, 8) },
      { rotulo: "buscas · dobra", itens: itens.slice(8, 10) },
      { rotulo: "buscas · densidades", itens: itens.slice(10, 15) },
      { rotulo: "buscas · agrupado", itens: itens.slice(15, 17) },
      { rotulo: "ficha · lead estrangeiro", itens: itens.slice(17, 18) },
      { rotulo: "ficha · lead nacional", itens: itens.slice(18, 19) },
      { rotulo: "ficha · lead parado na fila", itens: itens.slice(19) },
    ]),
  );
  await ctx.close();

  console.log(`[listas] ${itens.length} estados capturados no celular.`);
  if (problemas.length > 0) {
    throw new Error(`[listas] ${problemas.length} problema(s):\n  ${problemas.join("\n  ")}`);
  }
  console.log(
    "[listas] ok — nenhum slot com caixa zerada, nada vazando, grade e escada de densidade medidas.",
  );
  return gerados;
}

/* ── Item: print pendente em /config (`--so=pendencias`) ─────────────── */

/**
 * A lista de pendência de print, no painel "Fila de envio" — os leads que
 * receberam o TEXTO mas não a peça que vende (ver ARCHITECTURE.md,
 * "`detalheEnvio` — o texto saiu, o print não").
 *
 * Existe como passo próprio por causa do ESTADO VAZIO. Cheia, a lista já
 * aparece nas capturas de /config de todo tema; vazia, ela não apareceria
 * em lugar nenhum — e é justamente aí que um bloco subordinado costuma
 * deixar caixa quebrada ou espaço morto no painel. Como o banco falso é um
 * ARQUIVO, dá para esvaziar a lista entre uma captura e outra sem derrubar
 * o servidor: é o mesmo truque de `definirTemaNoDoc`.
 *
 * As cobranças, nos dois estados: nada vaza da viewport do celular (o
 * detalhe é texto livre de até 300 caracteres), nenhum slot com caixa
 * zerada, e o painel continua um só — a lista é subordinada a ele, não uma
 * seção competindo.
 */
/** Caixa do painel "Fila de envio" — altura e borda direita, em px. */
const caixaDoPainelFila = (page) =>
  page.evaluate(() => {
    // Por `data-painel`, e não pelo texto do <h2>: o cabeçalho agora carrega
    // também a linha de resumo do bloco fechado.
    const secao = document.querySelector('[data-painel="fila-envio"]');
    if (!secao) return null;
    const r = secao.getBoundingClientRect();
    return { altura: Math.round(r.height), direita: Math.round(r.right) };
  });

/**
 * As duas cobranças que valem para QUALQUER estado do painel: ele não vaza
 * da viewport, e nenhuma folha com conteúdo dentro dele renderiza com caixa
 * zerada — um slot que "some" por colapsar não aparece como erro em captura
 * nenhuma, a tela só fica um pouco mais vazia. Compartilhado por
 * `--so=pendencias` e `--so=fila`, que olham o mesmo painel.
 */
async function conferirPainelFila(page, onde, largura, problemas) {
  const caixa = await caixaDoPainelFila(page);
  if (!caixa) {
    problemas.push(`${onde}: painel "Fila de envio" não foi encontrado`);
    return null;
  }
  if (caixa.direita > largura + 1) {
    problemas.push(`${onde}: painel vaza da viewport (direita=${caixa.direita}, tela=${largura})`);
  }
  const zeradas = await page.evaluate(() => {
    // Por `data-painel`, e não pelo texto do <h2>: o cabeçalho agora carrega
    // também a linha de resumo do bloco fechado.
    const secao = document.querySelector('[data-painel="fila-envio"]');
    if (!secao) return [];
    return [...secao.querySelectorAll("*")]
      // `<option>` não tem caixa própria (quem desenha a lista é o SO), e o
      // texto dele aparece do mesmo jeito. Medi-lo aqui acusaria de "slot
      // zerado" um seletor que funciona — o aferidor procura conteúdo
      // INVISÍVEL, não conteúdo fora do fluxo do documento.
      .filter((el) => el.tagName !== "OPTION")
      // Pelo MESMO motivo: o corpo de um bloco colapsado está escondido
      // porque alguém o fechou, não porque colapsou sozinho.
      .filter((el) => !el.closest('[data-corpo="fechado"]'))
      .filter((el) => el.children.length === 0 && (el.textContent ?? "").trim().length > 0)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          altura: Math.round(r.height),
          largura: Math.round(r.width),
          texto: (el.textContent ?? "").trim().slice(0, 30),
        };
      })
      .filter((s) => s.altura <= 0 || s.largura <= 0);
  });
  for (const s of zeradas) {
    problemas.push(`${onde}: slot com caixa zerada ("${s.texto}") ${s.largura}×${s.altura}`);
  }
  return caixa;
}

/**
 * A /config nasce com tudo FECHADO: sem abrir estes dois, a lista que o
 * passo existe para medir não está na tela. Reaplicado a cada iteração
 * porque `semear()` reescreve `usuarios/admin` inteiro — mesma armadilha
 * (e mesmo remédio) do `definirTemaNoDoc`.
 */
const PAINEIS_PENDENCIAS = ["fila-envio", "fila-print-pendente"];

async function medirPendencias(browser, secret) {
  const gerados = [];
  const problemas = [];
  const itens = [];

  const conferirPainel = (page, onde, largura) =>
    conferirPainelFila(page, onde, largura, problemas);

  // O tema CLARO entra na leva porque é onde os tokens apagados deste bloco
  // (ink-muted, surface-2, a borda do alternador) têm menos contraste de
  // sobra — no escuro eles perdoam. As capturas de aba não cobrem isto: o
  // painel fica muito abaixo da dobra de /config.
  for (const [viewport, sufixo, tema] of [
    [VIEWPORT_CELULAR, "celular", "escuro"],
    [VIEWPORT_DESKTOP, "desktop", "escuro"],
    [VIEWPORT_CELULAR, "celular-claro", "claro"],
    [VIEWPORT_DESKTOP, "desktop-claro", "claro"],
  ]) {
    definirTemaNoDoc("admin", tema);
    definirPaineisAbertosNoDoc("admin", PAINEIS_PENDENCIAS);
    const ctx = await contextoLogado(browser, { viewport, secret, tema });
    const page = await ctx.newPage();

    const abrirPainel = async (onde) => {
      await page.goto(`${BASE}/config`, { waitUntil: "domcontentloaded" });
      await assentar(page);
      await exigirLogado(page, `pendencias/${onde}`);
      await page.getByRole("heading", { name: "Fila de envio" }).scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    };

    const capturarPainel = async (rotulo, arquivo) => {
      const alvo = page.locator("section", { has: page.getByRole("heading", { name: "Fila de envio" }) });
      const png = path.join(SAIDA, `pendencias-${arquivo}-${sufixo}${marca}.png`);
      // A nav é `fixed` no rodapé: numa captura de ELEMENTO mais alto que a
      // viewport ela fica pintada por cima da última faixa do painel — e é
      // justamente ali que mora a linha de detalhe longo que se quer olhar.
      // Some com ela só durante o disparo; quem julga o cromo no lugar é o
      // `exigirCromoNoLugar` das capturas de aba.
      const semNav = await page.addStyleTag({ content: "nav { display: none !important }" });
      await alvo.first().screenshot({ path: png });
      await semNav.evaluate((no) => no.remove());
      itens.push({ rotulo: `${rotulo} · ${sufixo}`, png });
    };

    // ── CHEIA: duas abertas (uma com detalhe longo), a resolvida escondida.
    await abrirPainel(`cheia/${sufixo}`);
    const cheia = await conferirPainel(page, `cheia/${sufixo}`, viewport.width);
    for (const [alvo, oque] of [
      [/Print pendente/, "título do bloco"],
      [/print não anexou: galeria vazia/, "detalhe da pendência recente"],
      [/a galeria não carregou a imagem a tempo/, "detalhe longo"],
    ]) {
      if ((await page.getByText(alvo).count()) === 0) {
        problemas.push(`cheia/${sufixo}: ${oque} não apareceu`);
      }
    }
    // A resolvida NÃO entra na visão padrão — é o que faz a lista esvaziar.
    if ((await page.getByText(/print saiu cortado/).count()) > 0) {
      problemas.push(`cheia/${sufixo}: pendência resolvida apareceu na lista padrão`);
    }
    const alternadores = await page.getByRole("button", { name: "resolvido" }).count();
    if (alternadores !== 2) {
      problemas.push(`cheia/${sufixo}: esperava 2 alternadores "resolvido", achei ${alternadores}`);
    }
    await capturarPainel("lista cheia (2 abertas, detalhe longo)", "cheia");

    // ── RESOLVIDAS: o alternador marcado, para desfazer o clique errado.
    await page.getByRole("button", { name: "ver resolvidas" }).click();
    await page.waitForTimeout(600);
    if ((await page.getByText(/print saiu cortado/).count()) === 0) {
      problemas.push(`resolvidas/${sufixo}: a pendência já fechada não apareceu`);
    }
    await conferirPainel(page, `resolvidas/${sufixo}`, viewport.width);
    await capturarPainel("ver resolvidas (alternador marcado)", "resolvidas");

    // ── VAZIA: nenhum lead pendente. O painel não pode ficar com bloco
    // quebrado nem espaço morto — some a lista, fica a linha de estado.
    esvaziarPendencias();
    await abrirPainel(`vazia/${sufixo}`);
    const vazia = await conferirPainel(page, `vazia/${sufixo}`, viewport.width);
    if ((await page.getByText("Nenhuma pendência.").count()) === 0) {
      problemas.push(`vazia/${sufixo}: o estado vazio não disse nada`);
    }
    // Escopado à lista de pendências: o funil da visão da fila, no mesmo
    // painel, também é feito de <li> — e ele não é linha de pendência.
    if ((await page.locator('[data-lista="pendencias"] li').count()) > 0) {
      problemas.push(`vazia/${sufixo}: sobrou linha de lista com a lista vazia`);
    }
    // Espaço morto: o painel vazio tem que ser MENOR que o cheio, e a
    // diferença tem que ser a lista inteira, não uma caixa vazia no lugar.
    if (cheia && vazia) {
      const encolheu = cheia.altura - vazia.altura;
      console.log(
        `  [pendencias] ${sufixo}: painel ${cheia.altura}px cheio → ${vazia.altura}px vazio (−${encolheu}px)`,
      );
      if (encolheu <= 0) {
        problemas.push(
          `vazia/${sufixo}: painel não encolheu sem pendências (${cheia.altura} → ${vazia.altura})`,
        );
      }
    }
    await capturarPainel("lista vazia (sem pendência)", "vazia");

    restaurarPendencias();
    await ctx.close();
  }

  const folha = await browser.newPage();
  gerados.push(
    await folhaDeContato(folha, 'Print pendente — painel "Fila de envio" (/config)', "pendencias", [
      { rotulo: "celular · escuro", itens: itens.filter((i) => i.rotulo.endsWith("· celular")) },
      { rotulo: "desktop · escuro", itens: itens.filter((i) => i.rotulo.endsWith("· desktop")) },
      { rotulo: "celular · claro", itens: itens.filter((i) => i.rotulo.endsWith("celular-claro")) },
      { rotulo: "desktop · claro", itens: itens.filter((i) => i.rotulo.endsWith("desktop-claro")) },
    ]),
  );
  await folha.close();

  if (problemas.length > 0) {
    throw new Error(`[pendencias] ${problemas.length} problema(s):\n  ${problemas.join("\n  ")}`);
  }
  console.log("[pendencias] ok — lista cheia, resolvidas e VAZIA, sem vazamento nem caixa zerada.");
  return gerados;
}

/* ── Item: a visão da fila em /config (`--so=fila`) ──────────────────── */

/**
 * Mexe no banco falso (um ARQUIVO, mesmo truque de `definirTemaNoDoc`) sem
 * derrubar o servidor. É assim que os estados VAZIOS são capturados: sem
 * pool, sem contador, sem elegível.
 */
function editarBanco(fn) {
  const mapa = JSON.parse(fsSync.readFileSync(BANCO, "utf8"));
  fn(mapa);
  fsSync.writeFileSync(BANCO, JSON.stringify(mapa));
}

/**
 * A VISÃO da fila — o bloco "O que vai acontecer" do painel "Fila de envio".
 *
 * Existe como passo próprio pelos ESTADOS VAZIOS. Cheio, o bloco já aparece
 * nas capturas de /config de todo tema; vazio — fila sem elegíveis, sem
 * bloqueados e contador zerado — ele não apareceria em lugar nenhum, e é
 * exatamente aí que um bloco subordinado deixa caixa quebrada ou espaço
 * morto. O terceiro estado é o pool NUNCA CONSTRUÍDO, que tem texto próprio
 * (as sete contagens estruturais ficam zeradas até a primeira chamada do
 * celular) e não pode virar um funil de zeros sem explicação.
 *
 * Os RETIDOS por envio não confirmado entram com DOIS estados, e não um: com
 * retidos (a lista, o "volta à fila" e o botão de liberar por linha) e SEM
 * retidos com a fila cheia em volta — este último porque é o caso em que uma
 * lista vazia no meio de um painel cheio deixa caixa quebrada, e o estado
 * "vazia" (onde tudo está vazio junto) não o revelaria. O passo também
 * confronta o NÚMERO do funil com a quantidade de linhas da lista: eles saem
 * da mesma varredura, e se divergirem é aqui que a divergência aparece.
 *
 * O tema claro entra pelo mesmo motivo do `--so=pendencias`: é onde os
 * tokens apagados deste bloco têm menos contraste de sobra, e as capturas
 * de aba não o cobrem — o painel fica muito abaixo da dobra de /config.
 */
/** Ver `PAINEIS_PENDENCIAS`: o painel e o bloco que este passo mede. */
const PAINEIS_FILA = ["fila-envio", "fila-visao"];

async function medirFila(browser, secret) {
  const gerados = [];
  const problemas = [];
  const itens = [];

  for (const [viewport, sufixo, tema] of [
    [VIEWPORT_CELULAR, "celular", "escuro"],
    [VIEWPORT_DESKTOP, "desktop", "escuro"],
    [VIEWPORT_CELULAR, "celular-claro", "claro"],
    [VIEWPORT_DESKTOP, "desktop-claro", "claro"],
  ]) {
    definirTemaNoDoc("admin", tema);
    definirPaineisAbertosNoDoc("admin", PAINEIS_FILA);
    const ctx = await contextoLogado(browser, { viewport, secret, tema });
    const page = await ctx.newPage();

    const abrirPainel = async (onde) => {
      await page.goto(`${BASE}/config`, { waitUntil: "domcontentloaded" });
      await assentar(page);
      await exigirLogado(page, `fila/${onde}`);
      await page.getByRole("heading", { name: "O que vai acontecer" }).scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    };

    const capturarPainel = async (rotulo, arquivo) => {
      const alvo = page.locator("section", {
        has: page.getByRole("heading", { name: "Fila de envio" }),
      });
      const png = path.join(SAIDA, `fila-${arquivo}-${sufixo}${marca}.png`);
      // A nav é `fixed` no rodapé e pinta por cima da última faixa numa
      // captura de elemento mais alto que a viewport — mesmo motivo do
      // `--so=pendencias`.
      const semNav = await page.addStyleTag({ content: "nav { display: none !important }" });
      await alvo.first().screenshot({ path: png });
      await semNav.evaluate((no) => no.remove());
      itens.push({ rotulo: `${rotulo} · ${sufixo}`, png });
    };

    const exigirTextos = async (onde, alvos) => {
      for (const [alvo, oque] of alvos) {
        if ((await page.getByText(alvo).count()) === 0) {
          problemas.push(`${onde}: ${oque} não apareceu`);
        }
      }
    };

    // ── CHEIA: fila ativa, ritmo liberado, 6 elegíveis (5 na tela + "e mais
    //    1"), 2 bloqueados, contador andando, pool de minutos atrás.
    editarBanco((mapa) => {
      mapa["config/fila"] = { ...mapa["config/fila"], ativo: true };
    });
    await abrirPainel(`cheia/${sufixo}`);
    const cheia = await conferirPainelFila(page, `cheia/${sufixo}`, viewport.width, problemas);
    await exigirTextos(`cheia/${sufixo}`, [
      [/de 20 hoje/, "contador do dia"],
      [/O dia operacional vira às 6h/, "instante da virada do dia"],
      [/Ritmo liberado/, "linha de ritmo liberado"],
      [/Retrato do pool/, "data do retrato do pool, ao lado das contagens estruturais"],
      [/print da demo não pronto/, "linha estrutural do funil"],
      [/fora dos nichos permitidos/, "etapa de nicho"],
      [/elegíveis agora/, "total de elegíveis"],
      [/Pet Center Ipiranga/, "primeiro lead elegível"],
      [/e mais 1 na fila/, "aviso de que a lista é uma janela sobre a fila"],
      [/Multimarcas Farrapos/, "lead bloqueado por janela"],
      [/sem faixa aceita nos próximos 7 dias/, "próxima faixa aceita do bloqueado"],
    ]);
    const proximos = await page.locator('[data-lista="proximos"] li').count();
    if (proximos !== 5) {
      problemas.push(`cheia/${sufixo}: esperava 5 próximos na tela, achei ${proximos}`);
    }
    const tirar = await page.getByRole("button", { name: "tirar da fila" }).count();
    if (tirar !== 7) {
      problemas.push(`cheia/${sufixo}: esperava 7 botões "tirar da fila", achei ${tirar}`);
    }
    // Os RETIDOS por envio não confirmado: a contagem no funil e a lista
    // logo abaixo saem da MESMA varredura, então as duas têm de aparecer
    // juntas — é a checagem de que o número do funil bate com a lista.
    await exigirTextos(`cheia/${sufixo}`, [
      [/retidos por envio recente não confirmado/, "etiqueta da retenção no funil"],
      [/Janela de 12h a partir da reserva/, "regra da janela ao lado do número"],
      [/Ótica Mercúrio/, "lead retido recém reservado"],
      [/Serralheria Navegantes/, "lead retido no fim da janela"],
      [/volta à fila/, "quando a retenção vence"],
      [/reservado/, "quando foi a reserva"],
    ]);
    const linhasRetidos = await page.locator('[data-lista="retidos"] li').count();
    if (linhasRetidos !== 3) {
      problemas.push(`cheia/${sufixo}: esperava 3 retidos na lista, achei ${linhasRetidos}`);
    }
    const liberar = await page.getByRole("button", { name: "liberar" }).count();
    if (liberar !== 3) {
      problemas.push(`cheia/${sufixo}: esperava 3 botões "liberar", achei ${liberar}`);
    }
    // A contagem do funil é lida da TELA e confrontada com a lista: se as
    // duas divergirem, este passo reprova em vez de a divergência passar.
    const totalNoFunil = await page.evaluate(() => {
      const rotulo = [...document.querySelectorAll("p")].find((el) =>
        el.textContent?.includes("retidos por envio recente não confirmado"),
      );
      return Number(rotulo?.querySelector("span:last-child")?.textContent?.trim());
    });
    if (totalNoFunil !== linhasRetidos) {
      problemas.push(
        `cheia/${sufixo}: funil diz ${totalNoFunil} retidos, a lista tem ${linhasRetidos}`,
      );
    }
    await capturarPainel("cheia (5 próximos + 2 bloqueados + 3 retidos)", "cheia");

    // ── SEM RETIDOS: a fila continua CHEIA e só a retenção esvazia. É o
    //    estado em que um bloco subordinado costuma deixar caixa quebrada
    //    ou espaço morto no meio de um painel que está cheio em volta —
    //    invisível no estado "vazia", onde tudo está vazio junto.
    editarBanco((mapa) => {
      for (const chave of Object.keys(mapa)) {
        if (chave.startsWith("filaEnvios/fila-r")) delete mapa[chave];
      }
    });
    await abrirPainel(`sem-retidos/${sufixo}`);
    const semRetidos = await conferirPainelFila(
      page,
      `sem-retidos/${sufixo}`,
      viewport.width,
      problemas,
    );
    await exigirTextos(`sem-retidos/${sufixo}`, [
      [/Nenhum lead retido/, "estado vazio dos retidos"],
      [/Pet Center Ipiranga/, "a fila em volta continua cheia"],
    ]);
    const sobrouRetido = await page.locator('[data-lista="retidos"] li').count();
    if (sobrouRetido > 0) {
      problemas.push(`sem-retidos/${sufixo}: sobrou linha de retido com a lista vazia`);
    }
    if (cheia && semRetidos) {
      const encolheu = cheia.altura - semRetidos.altura;
      console.log(
        `  [fila] ${sufixo}: painel ${cheia.altura}px com retidos → ${semRetidos.altura}px sem (−${encolheu}px)`,
      );
      if (encolheu <= 0) {
        problemas.push(
          `sem-retidos/${sufixo}: painel não encolheu sem retidos (${cheia.altura} → ${semRetidos.altura})`,
        );
      }
    }
    await capturarPainel("sem retidos (fila cheia em volta)", "sem-retidos");

    // ── VAZIA: fila ATIVA, pool sem candidato nenhum e contador zerado — os
    //    três estados vazios de uma vez.
    editarBanco((mapa) => {
      mapa["filaCandidatos/pool"] = { ...mapa["filaCandidatos/pool"], candidatos: [] };
      for (const chave of Object.keys(mapa)) {
        if (chave.startsWith("filaContadores/")) delete mapa[chave];
      }
    });
    await abrirPainel(`vazia/${sufixo}`);
    const vazia = await conferirPainelFila(page, `vazia/${sufixo}`, viewport.width, problemas);
    await exigirTextos(`vazia/${sufixo}`, [
      [/0 de 20 hoje/, "contador zerado"],
      [/Nenhum lead elegível agora/, "estado vazio dos próximos"],
      [/Ninguém parado na janela/, "estado vazio dos bloqueados"],
      // Os retidos saíram no passo acima e continuam fora: aqui as TRÊS
      // listas estão vazias ao mesmo tempo, que é o piso do painel.
      [/Nenhum lead retido/, "estado vazio dos retidos"],
    ]);
    const sobrou = await page.locator('[data-lista="proximos"] li, [data-lista="bloqueados"] li').count();
    if (sobrou > 0) {
      problemas.push(`vazia/${sufixo}: sobrou linha de lead com as listas vazias`);
    }
    if (cheia && vazia) {
      const encolheu = cheia.altura - vazia.altura;
      console.log(
        `  [fila] ${sufixo}: painel ${cheia.altura}px cheio → ${vazia.altura}px vazio (−${encolheu}px)`,
      );
      if (encolheu <= 0) {
        problemas.push(
          `vazia/${sufixo}: painel não encolheu sem leads (${cheia.altura} → ${vazia.altura})`,
        );
      }
    }
    await capturarPainel("vazia (sem elegível, sem bloqueado, contador zerado)", "vazia");

    // ── SEM POOL: o celular nunca pediu tarefa. Texto próprio, não um funil
    //    de zeros sem explicação — e a fila pausada, para a tarja de ritmo.
    editarBanco((mapa) => {
      delete mapa["filaCandidatos/pool"];
      mapa["config/fila"] = { ...mapa["config/fila"], ativo: false };
    });
    await abrirPainel(`sem-pool/${sufixo}`);
    await conferirPainelFila(page, `sem-pool/${sufixo}`, viewport.width, problemas);
    await exigirTextos(`sem-pool/${sufixo}`, [
      [/O pool ainda não foi construído/, "aviso de pool inexistente"],
      [/a fila está pausada/, "tarja de ritmo pausado"],
    ]);
    await capturarPainel("sem pool + fila pausada", "sem-pool");

    // Devolve o banco ao estado semeado para a próxima leva de viewport.
    semear();
    await ctx.close();
  }

  const folha = await browser.newPage();
  gerados.push(
    await folhaDeContato(folha, 'Visão da fila — painel "Fila de envio" (/config)', "fila", [
      { rotulo: "celular · escuro", itens: itens.filter((i) => i.rotulo.endsWith("· celular")) },
      { rotulo: "desktop · escuro", itens: itens.filter((i) => i.rotulo.endsWith("· desktop")) },
      { rotulo: "celular · claro", itens: itens.filter((i) => i.rotulo.endsWith("celular-claro")) },
      { rotulo: "desktop · claro", itens: itens.filter((i) => i.rotulo.endsWith("desktop-claro")) },
    ]),
  );
  await folha.close();

  if (problemas.length > 0) {
    throw new Error(`[fila] ${problemas.length} problema(s):\n  ${problemas.join("\n  ")}`);
  }
  console.log(
    "[fila] ok — cheia, SEM RETIDOS, vazia e sem pool, sem vazamento nem caixa zerada.",
  );
  return gerados;
}

/* ── Item: respostas pendentes em /config (`--so=respostas`) ─────────── */

/** Caixa do painel "Respostas pendentes" — altura e borda direita, em px. */
const caixaDoPainelRespostas = (page) =>
  page.evaluate(() => {
    const secao = document.querySelector('[data-painel="respostas-pendentes"]');
    if (!secao) return null;
    const r = secao.getBoundingClientRect();
    return { altura: Math.round(r.height), direita: Math.round(r.right) };
  });

/**
 * As mesmas duas cobranças de `conferirPainelFila`, sobre o painel próprio
 * de respostas: não vaza da viewport e nenhuma folha com conteúdo renderiza
 * com caixa zerada. Separado, e não um parâmetro daquele, porque o seletor
 * do painel é outro — e porque aqui a lista tem `<textarea>`, que TEM caixa
 * própria mas não tem `textContent` visível, e por isso o aferidor de slot
 * zerado precisa ignorá-lo junto com `<option>`.
 */
async function conferirPainelRespostas(page, onde, largura, problemas) {
  const caixa = await caixaDoPainelRespostas(page);
  if (!caixa) {
    problemas.push(`${onde}: painel "Respostas pendentes" não foi encontrado`);
    return null;
  }
  if (caixa.direita > largura + 1) {
    problemas.push(`${onde}: painel vaza da viewport (direita=${caixa.direita}, tela=${largura})`);
  }
  const zeradas = await page.evaluate(() => {
    const secao = document.querySelector('[data-painel="respostas-pendentes"]');
    if (!secao) return [];
    return [...secao.querySelectorAll("*")]
      .filter((el) => el.tagName !== "OPTION" && el.tagName !== "TEXTAREA")
      .filter((el) => el.children.length === 0 && (el.textContent ?? "").trim().length > 0)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          altura: Math.round(r.height),
          largura: Math.round(r.width),
          texto: (el.textContent ?? "").trim().slice(0, 30),
        };
      })
      .filter((s) => s.altura <= 0 || s.largura <= 0);
  });
  for (const s of zeradas) {
    problemas.push(`${onde}: slot com caixa zerada ("${s.texto}") ${s.largura}×${s.altura}`);
  }

  // A CAIXA DO RASCUNHO MOSTRA O RASCUNHO INTEIRO. Com altura fixa ela
  // cortava o texto no meio de uma linha — meia fileira de letras fatiada,
  // que lê como quebrado mesmo rolando, e não dá para editar o que não se
  // vê. O aferidor: nada escondido, a menos que a caixa tenha batido no
  // teto (aí rolar é a resposta certa, e a captura não reprova).
  const cortadas = await page.evaluate(() => {
    const secao = document.querySelector('[data-painel="respostas-pendentes"]');
    if (!secao) return [];
    return [...secao.querySelectorAll("textarea")]
      .map((el) => ({
        escondido: el.scrollHeight - el.clientHeight,
        altura: el.clientHeight,
        teto: parseFloat(getComputedStyle(el).maxHeight) || Infinity,
        inicio: el.value.slice(0, 30),
      }))
      .filter((t) => t.escondido > 2 && t.altura < t.teto - 2);
  });
  for (const t of cortadas) {
    problemas.push(
      `${onde}: caixa do rascunho corta ${t.escondido}px de texto ("${t.inicio}…")`,
    );
  }
  return caixa;
}

/** Tira (e devolve) as respostas pendentes, para capturar o estado VAZIO. */
let respostasGuardadas = null;
function esvaziarRespostas() {
  const mapa = JSON.parse(fsSync.readFileSync(BANCO, "utf8"));
  respostasGuardadas = {};
  for (const chave of Object.keys(mapa)) {
    if (chave.startsWith("filaRespostas/") && mapa[chave].estado === "pendente") {
      respostasGuardadas[chave] = mapa[chave];
      delete mapa[chave];
    }
  }
  fsSync.writeFileSync(BANCO, JSON.stringify(mapa));
}

function restaurarRespostas() {
  if (!respostasGuardadas) return;
  const mapa = JSON.parse(fsSync.readFileSync(BANCO, "utf8"));
  Object.assign(mapa, respostasGuardadas);
  fsSync.writeFileSync(BANCO, JSON.stringify(mapa));
  respostasGuardadas = null;
}

/**
 * Agente de um Android real. Existe porque o painel troca de AÇÃO conforme
 * o aparelho: no Android o botão é a âncora que abre o WhatsApp Business
 * por URI de intent; fora dele não há Business para abrir, e a mesma ação
 * copia o texto. Sem forçar o agente, a captura do "celular" mostraria o
 * caminho do desktop — provando o contrário do que ela existe para provar.
 */
const UA_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/131.0.0.0 Mobile Safari/537.36";

/**
 * O painel "Respostas pendentes" — o lead respondeu, a IA rascunhou, e
 * alguém precisa decidir (ver ARCHITECTURE.md).
 *
 * Existe como passo próprio por DOIS motivos, e o segundo é o que nenhum
 * outro passo alcança:
 *
 *  1. o ESTADO VAZIO, mesma razão do `--so=pendencias`: cheio, o painel
 *     aparece nas capturas de /config de todo tema; vazio, não apareceria
 *     em lugar nenhum — e é aí que um painel deixa caixa quebrada ou
 *     espaço morto. O passo cobra que ele ENCOLHA sem pendências, em vez
 *     de trocar a lista por um vão;
 *  2. a AÇÃO que muda com o aparelho. No Android o botão é uma âncora
 *     `intent://` que abre o WhatsApp Business; no desktop não há Business
 *     para abrir, e o mesmo botão copia o texto, com a tela dizendo por
 *     quê. São duas telas diferentes no mesmo código, e só forçando o
 *     agente uma captura consegue mostrar as duas.
 *
 * O tema claro entra pelo mesmo motivo do `--so=fila` e do
 * `--so=pendencias`: é onde os tokens apagados têm menos contraste de
 * sobra, e as capturas de aba não cobrem o painel — ele fica muito abaixo
 * da dobra de /config.
 */
/** Ver `PAINEIS_PENDENCIAS`: o painel que este passo mede. */
const PAINEIS_RESPOSTAS = ["respostas-pendentes"];

async function medirRespostas(browser, secret) {
  const gerados = [];
  const problemas = [];
  const itens = [];

  for (const [viewport, sufixo, tema, userAgent] of [
    [VIEWPORT_CELULAR, "celular", "escuro", UA_ANDROID],
    [VIEWPORT_DESKTOP, "desktop", "escuro", undefined],
    [VIEWPORT_CELULAR, "celular-claro", "claro", UA_ANDROID],
    [VIEWPORT_DESKTOP, "desktop-claro", "claro", undefined],
  ]) {
    const ehAndroid = userAgent !== undefined;
    definirTemaNoDoc("admin", tema);
    definirPaineisAbertosNoDoc("admin", PAINEIS_RESPOSTAS);
    const ctx = await contextoLogado(browser, { viewport, secret, tema, userAgent });
    const page = await ctx.newPage();

    const abrirPainel = async (onde) => {
      await page.goto(`${BASE}/config`, { waitUntil: "domcontentloaded" });
      await assentar(page);
      await exigirLogado(page, `respostas/${onde}`);
      await page.getByRole("heading", { name: "Respostas pendentes" }).scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    };

    const capturarPainel = async (rotulo, arquivo) => {
      const alvo = page.locator("section", {
        has: page.getByRole("heading", { name: "Respostas pendentes" }),
      });
      const png = path.join(SAIDA, `respostas-${arquivo}-${sufixo}${marca}.png`);
      // A nav é `fixed` no rodapé e pinta por cima da última faixa numa
      // captura de elemento mais alto que a viewport — mesmo motivo do
      // `--so=pendencias`.
      const semNav = await page.addStyleTag({ content: "nav { display: none !important }" });
      await alvo.first().screenshot({ path: png });
      await semNav.evaluate((no) => no.remove());
      itens.push({ rotulo: `${rotulo} · ${sufixo}`, png });
    };

    // ── CHEIA: duas pendentes, uma com três mensagens, outra com rascunho
    //    longo e quebras de linha. A já usada NÃO pode aparecer.
    await abrirPainel(`cheia/${sufixo}`);
    const cheia = await conferirPainelRespostas(page, `cheia/${sufixo}`, viewport.width, problemas);

    for (const [alvo, oque] of [
      [/quanto fica pra gente\? e tem mensalidade\?/, "última mensagem do grupo de três"],
      [/recebi um link aqui de um site com o nome da minha loja/, "mensagem do segundo lead"],
      [/Pet Center Ipiranga/, "nome do lead"],
      [/petshop/, "nicho do lead"],
    ]) {
      if ((await page.getByText(alvo).count()) === 0) {
        problemas.push(`cheia/${sufixo}: ${oque} não apareceu`);
      }
    }
    // A já usada não volta para a lista — é o que faz a pendência SAIR.
    if ((await page.getByText(/Mando agora mesmo!/).count()) > 0) {
      problemas.push(`cheia/${sufixo}: resposta já usada apareceu na lista`);
    }

    const linhas = await page.locator('[data-lista="respostas"] > li').count();
    if (linhas !== 2) {
      problemas.push(`cheia/${sufixo}: esperava 2 respostas pendentes, achei ${linhas}`);
    }
    // TODAS as mensagens do grupo, não só a última: três na primeira linha.
    const noPrimeiro = await page
      .locator('[data-lista="respostas"] > li')
      .first()
      .locator('[data-bloco="mensagens"] > li')
      .count();
    if (noPrimeiro !== 3) {
      problemas.push(`cheia/${sufixo}: esperava 3 mensagens no primeiro grupo, achei ${noPrimeiro}`);
    }

    // O rascunho é campo EDITÁVEL, não texto estático — e é o que decide se
    // a edição do operador é o que vai para o WhatsApp.
    const caixas = page.locator('[data-lista="respostas"] textarea');
    if ((await caixas.count()) !== 2) {
      problemas.push(`cheia/${sufixo}: o rascunho não é campo editável`);
    } else if (!(await caixas.first().inputValue()).includes("sem mensalidade nenhuma")) {
      problemas.push(`cheia/${sufixo}: a caixa não nasceu com o rascunho dentro`);
    }

    // ── A AÇÃO MUDA COM O APARELHO. Aqui a captura para de ser ilustração:
    //    no Android tem que haver âncora `intent://` mirando o pacote do
    //    BUSINESS; no desktop não pode haver âncora nenhuma, e a tela tem
    //    que dizer por que o botão copia.
    const ancora = page.locator('[data-lista="respostas"] a[href^="intent://"]');
    const aviso = page.locator('[data-aviso="sem-business"]');
    if (ehAndroid) {
      if ((await ancora.count()) !== 2) {
        problemas.push(
          `cheia/${sufixo}: no Android esperava 2 âncoras de intent, achei ${await ancora.count()}`,
        );
      } else {
        const href = await ancora.first().getAttribute("href");
        for (const [trecho, oque] of [
          ["package=com.whatsapp.w4b", "o pacote do Business"],
          ["scheme=https", "o esquema do dado"],
          ["api.whatsapp.com/send?phone=5551966660000", "o telefone do lead"],
          ["S.browser_fallback_url=", "a reserva para quem não tem o Business"],
          [";end", "o fim do intent"],
        ]) {
          if (!href.includes(trecho)) {
            problemas.push(`cheia/${sufixo}: ${oque} não está no href (${trecho})`);
          }
        }
        // O pacote do WhatsApp COMUM não pode estar mirado em lugar nenhum:
        // é o aparelho com os dois instalados que motiva tudo isto.
        if (/package=com\.whatsapp[;&]/.test(href)) {
          problemas.push(`cheia/${sufixo}: o href mira o WhatsApp comum`);
        }
        if ((await aviso.count()) > 0) {
          problemas.push(`cheia/${sufixo}: o aviso de "sem Business" apareceu no celular`);
        }
      }
    } else {
      if ((await ancora.count()) > 0) {
        problemas.push(`cheia/${sufixo}: âncora de intent no desktop — ali ela não faz nada`);
      }
      // Botão que não faz nada em metade dos casos é pior que botão
      // ausente: aqui ele troca de mecanismo, e a tela diz qual.
      if ((await aviso.count()) === 0) {
        problemas.push(`cheia/${sufixo}: o desktop não explicou por que não abre o Business`);
      }
      if ((await page.getByRole("button", { name: /usar \(copiar texto\)/ }).count()) !== 2) {
        problemas.push(`cheia/${sufixo}: o desktop não ofereceu copiar o texto`);
      }
    }

    // A QUEBRA DE LINHA do rascunho longo sobrevive à codificação da URL.
    // É o teste que só a tela real faz: o unitário prova a função, este
    // prova que o que chegou na caixa é o que entrou no href.
    if (ehAndroid && (await ancora.count()) === 2) {
      const href = await ancora.nth(1).getAttribute("href");
      if (!href.includes("%0A")) {
        problemas.push(`cheia/${sufixo}: a quebra de linha do rascunho não virou %0A no href`);
      }
      const texto = new URL(`https://${href.slice("intent://".length, href.indexOf("#Intent;"))}`)
        .searchParams.get("text");
      if (texto !== (await caixas.nth(1).inputValue())) {
        problemas.push(`cheia/${sufixo}: o texto do href não bate com a caixa editável`);
      }
    }

    await capturarPainel("lista cheia (3 mensagens, rascunho longo)", "cheia");

    // ── EDITADA: a edição do operador é o que vai para o WhatsApp, não o
    //    original. No Android isso tem que aparecer no href, na hora.
    await caixas.first().fill("Texto que o operador escreveu #1; do jeito dele.\nCom duas linhas.");
    await page.waitForTimeout(250);
    if (ehAndroid) {
      const href = await ancora.first().getAttribute("href");
      const texto = new URL(`https://${href.slice("intent://".length, href.indexOf("#Intent;"))}`)
        .searchParams.get("text");
      if (texto !== "Texto que o operador escreveu #1; do jeito dele.\nCom duas linhas.") {
        problemas.push(`editada/${sufixo}: o href não acompanhou a edição (${texto})`);
      }
      // O `#` e o `;` do texto editado não podem ter cortado o intent.
      if (href.split("#Intent;").length !== 2 || !href.endsWith(";end")) {
        problemas.push(`editada/${sufixo}: o texto editado partiu o URI de intent`);
      }
    }
    if ((await page.getByText("editado").count()) === 0) {
      problemas.push(`editada/${sufixo}: a tela não avisou que o rascunho foi editado`);
    }
    await conferirPainelRespostas(page, `editada/${sufixo}`, viewport.width, problemas);
    await capturarPainel("rascunho editado pelo operador", "editada");

    // ── VAZIA: nenhuma resposta esperando. O painel não pode ficar com
    //    caixa quebrada nem espaço morto — some a lista, fica a linha.
    esvaziarRespostas();
    await abrirPainel(`vazia/${sufixo}`);
    const vazia = await conferirPainelRespostas(page, `vazia/${sufixo}`, viewport.width, problemas);
    if ((await page.getByText("Nenhuma resposta esperando.").count()) === 0) {
      problemas.push(`vazia/${sufixo}: o estado vazio não disse nada`);
    }
    if ((await page.locator('[data-lista="respostas"] > li').count()) > 0) {
      problemas.push(`vazia/${sufixo}: sobrou linha de lista com a lista vazia`);
    }
    // A explicação do mecanismo some junto: sem pendência, dizer como o
    // botão abre o Business é instruir uma tarefa que não existe (mesma
    // regra da lista de print).
    for (const [texto, onde2] of [
      ["abre a conversa no WhatsApp Business", "a instrução do Business"],
      ["copia o texto para a área de transferência", "a instrução de copiar"],
    ]) {
      if ((await page.getByText(texto).count()) > 0) {
        problemas.push(`vazia/${sufixo}: ${onde2} ficou na tela sem pendência nenhuma`);
      }
    }
    if (cheia && vazia) {
      const encolheu = cheia.altura - vazia.altura;
      console.log(
        `  [respostas] ${sufixo}: painel ${cheia.altura}px cheio → ${vazia.altura}px vazio (−${encolheu}px)`,
      );
      if (encolheu <= 0) {
        problemas.push(
          `vazia/${sufixo}: painel não encolheu sem respostas (${cheia.altura} → ${vazia.altura})`,
        );
      }
    }
    await capturarPainel("lista vazia (nenhuma resposta)", "vazia");

    restaurarRespostas();
    await ctx.close();
  }

  const folha = await browser.newPage();
  gerados.push(
    await folhaDeContato(folha, "Respostas pendentes (/config)", "respostas", [
      { rotulo: "celular · escuro", itens: itens.filter((i) => i.rotulo.endsWith("· celular")) },
      { rotulo: "desktop · escuro", itens: itens.filter((i) => i.rotulo.endsWith("· desktop")) },
      { rotulo: "celular · claro", itens: itens.filter((i) => i.rotulo.endsWith("celular-claro")) },
      { rotulo: "desktop · claro", itens: itens.filter((i) => i.rotulo.endsWith("desktop-claro")) },
    ]),
  );
  await folha.close();

  if (problemas.length > 0) {
    throw new Error(`[respostas] ${problemas.length} problema(s):\n  ${problemas.join("\n  ")}`);
  }
  console.log(
    "[respostas] ok — cheia, editada e VAZIA; intent do Business no celular, copiar no desktop.",
  );
  return gerados;
}

/* ── Item: o disparo de teste em /config (`--so=teste`) ──────────────── */

/**
 * O DISPARO DE TESTE — o bloco que faz o aparelho acordar a tela e mandar
 * mensagem, subordinado ao painel "Fila de envio".
 *
 * Existe como passo próprio pelos estados que nenhuma outra captura alcança:
 * a tarefa PENDENTE com o tempo restante (é ela que diz ao operador para não
 * clicar de novo), o resultado de um disparo BARRADO — com a etapa nominal,
 * que é o produto principal dos interruptores — e o CONFIRMADO. O quarto é o
 * destino vazio, em que o bloco tem que dizer "não configurado" em vez de
 * oferecer um botão que só falharia.
 *
 * O tema claro entra pelo mesmo motivo do `--so=fila` e do `--so=pendencias`:
 * é onde os tokens apagados deste bloco têm menos contraste de sobra, e as
 * capturas de aba não o cobrem — o painel fica muito abaixo da dobra.
 *
 * **Também os CINCO estados da captura do lead fixo** (item "captura no
 * próprio painel de teste"): pronta, enfileirada, gerando, falhou e
 * inexistente — sub-bloco próprio (`data-bloco="captura-teste"`), folha de
 * contato separada da do disparo (perguntas diferentes: uma é "o aparelho
 * vai mandar?", a outra é "por que o teste não injeta?"). Enfileirada e
 * gerando também conferem que "Disparar teste" fica DESABILITADO — a tarefa
 * não sai sem print pronto, e o operador não devia nem tentar.
 */
/** Ver `PAINEIS_PENDENCIAS`: o painel e o bloco que este passo mede. */
const PAINEIS_TESTE = ["fila-envio", "fila-disparo-teste"];

async function medirDisparoTeste(browser, secret) {
  const gerados = [];
  const problemas = [];
  const itens = [];
  // Os cinco estados de CAPTURA (item 3) ganham folha própria — mistura-los
  // com os quatro estados do DISPARO na mesma folha deixaria nove linhas
  // por coluna, e as duas coisas respondem perguntas diferentes.
  const itensCaptura = [];

  /** A tarefa de teste tal como o doc `filaTestes/atual` a guarda. */
  const tarefa = (extra = {}) => ({
    claimId: "teste-qaQaQaQaQaQ",
    estado: "pendente",
    leadId: "radar-lead-teste",
    nome: "Barbearia Dom Aurélio",
    numero: "5544984570105",
    texto: "Oi, Barbearia Dom Aurélio! Fiz um site de exemplo pra vocês.",
    printUrl: "/qa.png",
    // Relativo ao instante da EDIÇÃO, não ao início do script: a rodada
    // percorre quatro viewports e leva minutos, e o contador da tela é
    // relativo ao carregamento — sem isto a última captura diria outro
    // número (e o aferidor do tempo restante falharia sozinho).
    criadoEm: new Date(Date.now() - 4 * 60000).toISOString(),
    expiraEm: new Date(Date.now() + 11 * 60000).toISOString(),
    criadoPor: "admin",
    pulou: [],
    entregueEm: null,
    confirmadoEm: null,
    resultado: null,
    detalhe: "",
    repeticoesTotal: 1,
    repeticoesRestantes: 0,
    repeticoesCanceladasEm: null,
    ...extra,
  });

  for (const [viewport, sufixo, tema] of [
    [VIEWPORT_CELULAR, "celular", "escuro"],
    [VIEWPORT_DESKTOP, "desktop", "escuro"],
    [VIEWPORT_CELULAR, "celular-claro", "claro"],
    [VIEWPORT_DESKTOP, "desktop-claro", "claro"],
  ]) {
    definirTemaNoDoc("admin", tema);
    definirPaineisAbertosNoDoc("admin", PAINEIS_TESTE);
    const ctx = await contextoLogado(browser, { viewport, secret, tema });
    const page = await ctx.newPage();

    const abrirPainel = async (onde) => {
      await page.goto(`${BASE}/config`, { waitUntil: "domcontentloaded" });
      await assentar(page);
      await exigirLogado(page, `teste/${onde}`);
      await page.getByRole("heading", { name: "Disparo de teste" }).scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    };

    // Captura o BLOCO, não a seção inteira: o painel "Fila de envio" passa
    // de 2000px de altura (config + visão + pendências) e já é capturado
    // por inteiro em `--so=fila` e `--so=pendencias`. Aqui o que precisa
    // ser julgado a olho é este bloco — numa folha de contato de seção
    // inteira ele sairia com 30px de altura.
    const capturarPainel = async (rotulo, arquivo) => {
      const alvo = page.locator('[data-bloco="disparo-teste"]');
      const png = path.join(SAIDA, `teste-${arquivo}-${sufixo}${marca}.png`);
      // A nav é `fixed` no rodapé e pinta por cima da última faixa numa
      // captura de elemento mais alto que a viewport — mesmo motivo do
      // `--so=fila`.
      const semNav = await page.addStyleTag({ content: "nav { display: none !important }" });
      await alvo.first().screenshot({ path: png });
      await semNav.evaluate((no) => no.remove());
      itens.push({ rotulo: `${rotulo} · ${sufixo}`, png });
    };

    const exigirTextos = async (onde, alvos) => {
      for (const [alvo, oque] of alvos) {
        if ((await page.getByText(alvo).count()) === 0) {
          problemas.push(`${onde}: ${oque} não apareceu`);
        }
      }
    };

    // Sub-bloco da captura — menor que o painel inteiro, e é o que muda nos
    // cinco estados (`--so=teste` cobre pendente/barrado/confirmado/
    // desligado; este é o zoom no que o item 3 acrescentou).
    const capturarBlocoCaptura = async (rotulo, arquivo) => {
      const alvo = page.locator('[data-bloco="captura-teste"]');
      const png = path.join(SAIDA, `teste-captura-${arquivo}-${sufixo}${marca}.png`);
      await alvo.first().screenshot({ path: png });
      itensCaptura.push({ rotulo: `${rotulo} · ${sufixo}`, png });
    };

    // O estado da captura vem de uma SEGUNDA chamada (`useEstadoCapturas`,
    // encadeada depois de `GET /api/fila/teste` resolver) — `assentar` já
    // espera `networkidle`, mas o placeholder "carregando…" é o sinal
    // direto de que essa segunda resposta ainda não chegou.
    const aguardarCaptura = () =>
      page
        .getByText("carregando…")
        .first()
        .waitFor({ state: "hidden", timeout: 5000 })
        .catch(() => {});

    // ── PENDENTE: a tarefa está na fila e o aparelho ainda não puxou. É o
    //    estado em que o operador olha para decidir se clica de novo — e a
    //    resposta é não: o tempo restante e a nota dos ~3 minutos.
    editarBanco((mapa) => {
      mapa["filaTestes/atual"] = tarefa();
    });
    await abrirPainel(`pendente/${sufixo}`);
    const pendente = await conferirPainelFila(page, `pendente/${sufixo}`, viewport.width, problemas);
    await exigirTextos(`pendente/${sufixo}`, [
      [/5544984570105/, "número de destino"],
      [/nunca o telefone do lead/, "aviso de que o destino não é o do lead"],
      [/pergunta a cada ~3 minutos/, "nota do intervalo da macro"],
      [/Aguardando o aparelho puxar/, "estado da tarefa pendente"],
      [/expira em \d+min/, "tempo restante da tarefa"],
      [/Barbearia Dom Aurélio/, "nome do lead alvo"],
    ]);
    const interruptores = await page.getByRole("button", { name: /^(ritmo|estruturais|nicho|janela)$/ }).count();
    if (interruptores !== 4) {
      problemas.push(`pendente/${sufixo}: esperava 4 interruptores, achei ${interruptores}`);
    }
    await capturarPainel("pendente (aguardando o aparelho)", "pendente");

    // ── REPETIÇÕES EM ANDAMENTO: pedidas 5, faltam 2 — o campo mostra
    //    quantas faltam e o botão de cancelar aparece. Este é o estado que
    //    prova que "clicou uma vez, o aparelho reporta e o servidor rearma
    //    sozinho" é visível na tela, não só no banco.
    editarBanco((mapa) => {
      mapa["filaTestes/atual"] = tarefa({ repeticoesTotal: 5, repeticoesRestantes: 2 });
    });
    await abrirPainel(`repeticoes-andamento/${sufixo}`);
    await exigirTextos(`repeticoes-andamento/${sufixo}`, [
      [/Faltam 2 de 5 repetições/, "contagem de repetições restantes"],
      [/Cancelar repetições restantes/, "botão de cancelar"],
    ]);
    await capturarPainel("repetições em andamento (faltam 2 de 5)", "repeticoes-andamento");

    // ── REPETIÇÕES CANCELADAS: o operador interrompeu com uma tarefa AINDA
    //    em voo (`entregue`, sem confirmação) — ela segue o curso normal
    //    (mostrado pela linha de estado "aguardando o confirmar"), só não
    //    rearma mais. Distinto de "zerou sozinho" — que não mostra nada.
    editarBanco((mapa) => {
      mapa["filaTestes/atual"] = tarefa({
        estado: "entregue",
        repeticoesTotal: 5,
        repeticoesRestantes: 0,
        repeticoesCanceladasEm: new Date(Date.now() - 30000).toISOString(),
        entregueEm: new Date(Date.now() - 60000).toISOString(),
      });
    });
    await abrirPainel(`repeticoes-cancelado/${sufixo}`);
    await exigirTextos(`repeticoes-cancelado/${sufixo}`, [
      [/Repetições canceladas pelo operador/, "aviso de cancelamento"],
      [/aguardando o confirmar/, "a tarefa em voo segue o curso normal"],
    ]);
    if ((await page.getByRole("button", { name: "Cancelar repetições restantes" }).count()) !== 0) {
      problemas.push(
        `repeticoes-cancelado/${sufixo}: o botão de cancelar não deveria aparecer depois de já cancelado`,
      );
    }
    await capturarPainel("repetições canceladas (tarefa em voo segue)", "repeticoes-cancelado");

    // ── BARRADO: o clique de verdade, com a fila pausada. O produto aqui é
    //    a ETAPA nominal — "parou em ritmo: a fila está pausada" —, não um
    //    "não deu" que devolveria a caixa preta que os interruptores abrem.
    editarBanco((mapa) => {
      delete mapa["filaTestes/atual"];
      mapa["config/fila"] = { ...mapa["config/fila"], ativo: false };
    });
    await abrirPainel(`barrado/${sufixo}`);
    await page.getByRole("button", { name: "Disparar teste" }).click();
    await page.waitForTimeout(700);
    await exigirTextos(`barrado/${sufixo}`, [
      [/parou em/, "aviso de que o disparo não saiu"],
      [/a fila está pausada/, "motivo nominal da etapa de ritmo"],
    ]);
    await conferirPainelFila(page, `barrado/${sufixo}`, viewport.width, problemas);
    await capturarPainel("barrado (parou no ritmo)", "barrado");

    // ── CONFIRMADO: o aparelho puxou, mandou e reportou. Fecha o ciclo na
    //    tela, para o operador não precisar abrir log de aparelho nenhum.
    editarBanco((mapa) => {
      mapa["config/fila"] = { ...mapa["config/fila"], ativo: true };
      mapa["filaTestes/atual"] = tarefa({
        estado: "confirmado",
        pulou: ["ritmo", "janela"],
        entregueEm: new Date(Date.now() - 3 * 60000).toISOString(),
        confirmadoEm: new Date(Date.now() - 2 * 60000).toISOString(),
        resultado: "enviado",
        detalhe: "o texto saiu, o print não anexou",
      });
    });
    await abrirPainel(`confirmado/${sufixo}`);
    const confirmado = await conferirPainelFila(
      page,
      `confirmado/${sufixo}`,
      viewport.width,
      problemas,
    );
    await exigirTextos(`confirmado/${sufixo}`, [
      [/Confirmado/, "estado confirmado"],
      [/o texto saiu, o print não anexou/, "detalhe reportado pelo aparelho"],
      [/pulou ritmo, janela/, "rastro das etapas puladas"],
    ]);
    await capturarPainel("confirmado (com detalhe do aparelho)", "confirmado");

    // ── DESLIGADO: sem `numeroTeste` não há destino. O bloco tem que DIZER
    //    isso, em vez de oferecer um botão que só falharia — e é o estado
    //    mais curto, onde um bloco subordinado costuma deixar espaço morto.
    editarBanco((mapa) => {
      delete mapa["filaTestes/atual"];
      mapa["config/fila"] = { ...mapa["config/fila"], numeroTeste: "" };
    });
    await abrirPainel(`desligado/${sufixo}`);
    const desligado = await conferirPainelFila(
      page,
      `desligado/${sufixo}`,
      viewport.width,
      problemas,
    );
    await exigirTextos(`desligado/${sufixo}`, [
      [/não configurado/, "aviso de destino ausente"],
      [/Nenhum teste disparado ainda/, "estado vazio da tarefa"],
    ]);
    await capturarPainel("desligado (sem número de destino)", "desligado");

    // O bloco ENCOLHE sem tarefa: é aqui que um subordinado costuma deixar
    // caixa quebrada ou um vão no lugar do conteúdo.
    if (confirmado && desligado) {
      const encolheu = confirmado.altura - desligado.altura;
      console.log(
        `  [teste] ${sufixo}: painel ${confirmado.altura}px com tarefa → ${desligado.altura}px sem (−${encolheu}px)`,
      );
      if (encolheu <= 0) {
        problemas.push(
          `desligado/${sufixo}: painel não encolheu sem tarefa (${confirmado.altura} → ${desligado.altura})`,
        );
      }
    }
    if (pendente && pendente.altura <= 0) {
      problemas.push(`pendente/${sufixo}: painel com altura zerada`);
    }

    // ── CAPTURA DO LEAD FIXO (item 3): os CINCO estados que o sub-bloco
    //    novo cobre — pronta, enfileirada, gerando, falhou e inexistente.
    //    O produto é o operador ver POR QUE o teste não injeta sem clicar
    //    em nada, e ter como regenerar sem sair do painel para a ficha.
    //
    //    Reseta ANTES (não só depois): a volta ao estado semeado é também
    //    a linha de base "pronta" — mesmo `capturaPronta` de sempre, e
    //    `numeroTeste` de volta (a rodada anterior, DESLIGADO, zerou-o).
    //    `semear()` reescreve `usuarios/admin` inteiro — o TEMA que
    //    `definirTemaNoDoc` gravou no topo da iteração some junto, então
    //    ele volta a ser gravado logo depois (mesmo truque de
    //    `esvaziarPendencias`/`repovoarPendencias`).
    semear();
    definirTemaNoDoc("admin", tema);
    definirPaineisAbertosNoDoc("admin", PAINEIS_TESTE);
    await abrirPainel(`captura-pronta/${sufixo}`);
    await aguardarCaptura();
    await exigirTextos(`captura-pronta/${sufixo}`, [
      [/1 captura/, "rótulo da captura pronta"],
      [/Refazer/, "botão de regenerar"],
      [/substitui as imagens atuais/, "aviso de que regenerar substitui"],
    ]);
    await capturarBlocoCaptura("pronta (com aviso de substituição)", "pronta");

    editarBanco((mapa) => {
      mapa["leads/radar-lead-teste"] = {
        ...mapa["leads/radar-lead-teste"],
        capturas: {
          estado: "enfileirado",
          execucaoId: "qa-enfileirado",
          pedidoEm: new Date(Date.now() - 30000).toISOString(),
        },
      };
    });
    await abrirPainel(`captura-enfileirada/${sufixo}`);
    await aguardarCaptura();
    await exigirTextos(`captura-enfileirada/${sufixo}`, [
      [/Enfileirado/, "rótulo enfileirado"],
      [/aguardando o runner/, "detalhe do enfileirado"],
      [/Gerar de novo/, "botão continua re-disparável"],
      [/a tarefa não sai sem print pronto/, "motivo do injetar desabilitado"],
    ]);
    if (!(await page.getByRole("button", { name: "Disparar teste" }).isDisabled())) {
      problemas.push(
        `captura-enfileirada/${sufixo}: "Disparar teste" deveria estar desabilitado com a captura em andamento`,
      );
    }
    await capturarBlocoCaptura("enfileirada (injetar desabilitado)", "enfileirada");
    // Painel INTEIRO aqui também: é a prova visual (não só a asserção) de
    // que "Disparar teste" aparece cinza com o motivo, não só desabilitado
    // no DOM sem ninguém ver.
    await capturarPainel("captura enfileirada — injetar cinza com o motivo", "captura-enfileirada-painel");

    editarBanco((mapa) => {
      mapa["leads/radar-lead-teste"] = {
        ...mapa["leads/radar-lead-teste"],
        capturas: {
          estado: "rodando",
          execucaoId: "qa-rodando",
          pedidoEm: new Date(Date.now() - 120000).toISOString(),
          iniciadoEm: new Date(Date.now() - 60000).toISOString(),
        },
      };
    });
    await abrirPainel(`captura-gerando/${sufixo}`);
    await aguardarCaptura();
    await exigirTextos(`captura-gerando/${sufixo}`, [
      [/Gerando…/, "rótulo gerando"],
      [/leva alguns minutos/, "detalhe do gerando"],
    ]);
    if (!(await page.getByRole("button", { name: "Disparar teste" }).isDisabled())) {
      problemas.push(
        `captura-gerando/${sufixo}: "Disparar teste" deveria estar desabilitado com a captura em andamento`,
      );
    }
    await capturarBlocoCaptura("gerando (injetar desabilitado)", "gerando");

    editarBanco((mapa) => {
      mapa["leads/radar-lead-teste"] = {
        ...mapa["leads/radar-lead-teste"],
        capturas: {
          estado: "falhou",
          execucaoId: "qa-falhou",
          pedidoEm: new Date(Date.now() - 600000).toISOString(),
          erro: "O GitHub recusou o token de capturas (401): ele venceu ou foi revogado.",
        },
      };
    });
    await abrirPainel(`captura-falhou/${sufixo}`);
    await aguardarCaptura();
    await exigirTextos(`captura-falhou/${sufixo}`, [
      [/Falhou/, "rótulo falhou"],
      [/venceu ou foi revogado/, "mensagem de erro"],
    ]);
    // Falhou não é "em andamento" — não deveria prender o disparo de teste.
    if (await page.getByRole("button", { name: "Disparar teste" }).isDisabled()) {
      problemas.push(
        `captura-falhou/${sufixo}: "Disparar teste" não deveria ficar preso por uma captura que falhou`,
      );
    }
    await capturarBlocoCaptura("falhou (com o erro)", "falhou");

    editarBanco((mapa) => {
      const lead = { ...mapa["leads/radar-lead-teste"] };
      delete lead.capturas;
      mapa["leads/radar-lead-teste"] = lead;
    });
    await abrirPainel(`captura-inexistente/${sufixo}`);
    await aguardarCaptura();
    await exigirTextos(`captura-inexistente/${sufixo}`, [
      [/Sem capturas/, "rótulo sem capturas"],
      [/Gerar captura/, "botão de gerar pela primeira vez"],
    ]);
    await capturarBlocoCaptura("inexistente (nunca gerada)", "inexistente");

    // Devolve o banco ao estado semeado para a próxima leva de viewport.
    semear();
    await ctx.close();
  }

  const folha = await browser.newPage();
  gerados.push(
    await folhaDeContato(folha, 'Disparo de teste — painel "Fila de envio" (/config)', "teste", [
      { rotulo: "celular · escuro", itens: itens.filter((i) => i.rotulo.endsWith("· celular")) },
      { rotulo: "desktop · escuro", itens: itens.filter((i) => i.rotulo.endsWith("· desktop")) },
      { rotulo: "celular · claro", itens: itens.filter((i) => i.rotulo.endsWith("celular-claro")) },
      { rotulo: "desktop · claro", itens: itens.filter((i) => i.rotulo.endsWith("desktop-claro")) },
    ]),
  );
  await folha.close();

  const folhaCaptura = await browser.newPage();
  gerados.push(
    await folhaDeContato(
      folhaCaptura,
      "Captura do lead de teste — os cinco estados (/config)",
      "teste-captura",
      [
        {
          rotulo: "celular · escuro",
          itens: itensCaptura.filter((i) => i.rotulo.endsWith("· celular")),
        },
        {
          rotulo: "desktop · escuro",
          itens: itensCaptura.filter((i) => i.rotulo.endsWith("· desktop")),
        },
        {
          rotulo: "celular · claro",
          itens: itensCaptura.filter((i) => i.rotulo.endsWith("celular-claro")),
        },
        {
          rotulo: "desktop · claro",
          itens: itensCaptura.filter((i) => i.rotulo.endsWith("desktop-claro")),
        },
      ],
    ),
  );
  await folhaCaptura.close();

  if (problemas.length > 0) {
    throw new Error(`[teste] ${problemas.length} problema(s):\n  ${problemas.join("\n  ")}`);
  }
  console.log(
    "[teste] ok — pendente, repetições (zerado/andamento/cancelado), barrado, confirmado e desligado, sem vazamento nem caixa zerada.",
  );
  return gerados;
}

/* ── Item: os blocos colapsáveis de /config (`--so=paineis`) ─────────── */

/**
 * O PORTÃO dos painéis colapsáveis da /config.
 *
 * A página acumulou catorze painéis de origens diferentes e virou uma
 * parede única de conteúdo. Cada um virou bloco que abre e fecha, e o
 * ganho só existe se três coisas valerem ao mesmo tempo — nenhuma delas se
 * julga por teste unitário:
 *
 * 1. **Tudo fechado por padrão**, e a página CABENDO: se sobrar corpo de
 *    painel aberto, a parede continua lá.
 * 2. **O cabeçalho fechado diz o ESTADO**, não só o título. É o ponto do
 *    item: sem a linha de resumo o operador abre tudo para saber o que
 *    está acontecendo, e a poluição só trocou de forma. O aferidor cobra
 *    que os painéis com dado no banco falso mostrem algo ALÉM do título.
 * 3. **O aberto/fechado sobrevive à recarga**, por usuário — é o que
 *    separa esta preferência do estado de navegador que a querystring de
 *    /leads era antes (ver "Compactação de /leads e /buscas").
 *
 * Celular e desktop, escuro e claro: o claro entra pela mesma razão do
 * `--so=pendencias` — é onde os tokens apagados do cabeçalho (ink-muted no
 * título, ink-secondary no resumo) têm menos contraste de sobra.
 */

/** Estado de cada bloco na tela: aberto? corpo visível? o que o cabeçalho diz? */
const lerPaineis = (page) =>
  page.evaluate(() => {
    const visivel = (el) => {
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.width > 0;
    };
    return [...document.querySelectorAll("[data-painel]")].map((secao) => {
      const botao = secao.querySelector("button[aria-expanded]");
      const corpo = botao?.getAttribute("aria-controls")
        ? document.getElementById(botao.getAttribute("aria-controls"))
        : null;
      const titulo = botao?.querySelector("span")?.textContent?.trim() ?? "";
      const cabecalho = botao?.textContent?.trim() ?? "";
      return {
        id: secao.dataset.painel,
        aberto: botao?.getAttribute("aria-expanded") === "true",
        corpoVisivel: Boolean(corpo && visivel(corpo)),
        titulo,
        // O resumo é o que o cabeçalho diz ALÉM do título (a seta ▸/▾ é
        // `aria-hidden`, mas entra no textContent — some daqui).
        resumo: cabecalho.replace(titulo, "").replace(/[▸▾]/g, "").trim(),
      };
    });
  });

async function medirPaineisConfig(browser, secret) {
  const gerados = [];
  const problemas = [];
  const itens = [];

  // O estado que este passo mede é o PADRÃO: usuário que nunca mexeu.
  definirPaineisAbertosNoDoc("admin", []);

  for (const [viewport, sufixo, tema] of [
    [VIEWPORT_CELULAR, "celular", "escuro"],
    [VIEWPORT_DESKTOP, "desktop", "escuro"],
    [VIEWPORT_CELULAR, "celular-claro", "claro"],
    [VIEWPORT_DESKTOP, "desktop-claro", "claro"],
  ]) {
    definirTemaNoDoc("admin", tema);
    const ctx = await contextoLogado(browser, { viewport, secret, tema });
    const page = await ctx.newPage();

    const abrirConfig = async (onde) => {
      await page.goto(`${BASE}/config`, { waitUntil: "domcontentloaded" });
      await assentar(page);
      await exigirLogado(page, `paineis/${onde}`);
      await exigirTema(page, tema, `paineis/${onde}`);
    };

    const alturaDaPagina = () =>
      page.evaluate(() => Math.round(document.body.getBoundingClientRect().height));

    /* ── 1. TUDO FECHADO ──────────────────────────────────────────────── */
    await abrirConfig("fechados");
    const fechados = await lerPaineis(page);

    // Todo painel do registro está na tela — um portão que não visita o
    // painel novo passa sempre (a lista tem teste de contrato).
    const naTela = new Set(fechados.map((p) => p.id));
    for (const { id } of PAINEIS_CONFIG_TOPO) {
      if (!naTela.has(id)) problemas.push(`fechados/${sufixo}: painel "${id}" não está na tela`);
    }
    for (const painel of fechados) {
      if (painel.aberto || painel.corpoVisivel) {
        problemas.push(
          `fechados/${sufixo}: "${painel.id}" nasceu ABERTO (aria-expanded=${painel.aberto})`,
        );
      }
      if (!painel.titulo) problemas.push(`fechados/${sufixo}: "${painel.id}" sem título no cabeçalho`);
    }

    // O ponto do item: cabeçalho fechado que diz o estado. O banco falso
    // dá dado a estes quatro, então nenhum deles pode mostrar só o título.
    for (const id of ["fila-envio", "respostas-pendentes", "usuarios", "busca"]) {
      const painel = fechados.find((p) => p.id === id);
      if (painel && !painel.resumo) {
        problemas.push(`fechados/${sufixo}: "${id}" fechado mostra só o título, sem resumo`);
      }
    }

    const alturaFechada = await alturaDaPagina();
    const pngFechado = path.join(SAIDA, `paineis-fechados-${sufixo}${marca}.png`);
    await page.screenshot({ path: pngFechado, fullPage: true });
    gerados.push(pngFechado);
    itens.push({ rotulo: `fechados · ${sufixo}`, png: pngFechado });

    /* ── 2. UM ABERTO ─────────────────────────────────────────────────── */
    await page
      .locator('[data-painel="fila-envio"] button[aria-expanded]')
      .first()
      .click();
    await assentar(page);
    const abertoUm = await lerPaineis(page);
    const fila = abertoUm.find((p) => p.id === "fila-envio");
    if (!fila?.aberto || !fila.corpoVisivel) {
      problemas.push(`aberto/${sufixo}: "fila-envio" não abriu ao clicar no cabeçalho`);
    }
    // Os quatro blocos da fila aparecem AO ABRIR o painel dela — cada um com
    // cabeçalho e resumo próprios, e cada um ainda fechado. Um que sumisse na
    // extração não apareceria como erro em captura nenhuma: a tela só ficaria
    // um pouco mais curta.
    for (const { id } of PAINEIS_CONFIG.filter((p) => p.nivel === 3)) {
      const bloco = abertoUm.find((p) => p.id === id);
      if (!bloco) problemas.push(`aberto/${sufixo}: bloco "${id}" não está dentro de "Fila de envio"`);
      else if (bloco.corpoVisivel) problemas.push(`aberto/${sufixo}: "${id}" nasceu aberto`);
      else if (!bloco.titulo) problemas.push(`aberto/${sufixo}: "${id}" sem título no cabeçalho`);
    }
    const outrosAbertos = abertoUm.filter((p) => p.id !== "fila-envio" && p.corpoVisivel);
    if (outrosAbertos.length > 0) {
      problemas.push(
        `aberto/${sufixo}: abrir um painel abriu outros (${outrosAbertos.map((p) => p.id).join(", ")})`,
      );
    }

    const alturaAberta = await alturaDaPagina();
    if (alturaAberta <= alturaFechada) {
      problemas.push(
        `aberto/${sufixo}: a página não cresceu ao abrir (${alturaFechada} → ${alturaAberta})`,
      );
    } else {
      console.log(
        `  [paineis] ${sufixo}: ${alturaFechada}px com tudo fechado → ${alturaAberta}px com "Fila de envio" aberto (+${alturaAberta - alturaFechada}px)`,
      );
    }

    const pngAberto = path.join(SAIDA, `paineis-um-aberto-${sufixo}${marca}.png`);
    await page.screenshot({ path: pngAberto, fullPage: true });
    gerados.push(pngAberto);
    itens.push({ rotulo: `um aberto · ${sufixo}`, png: pngAberto });

    /* ── 3. PERSISTIDO ENTRE RECARGAS ─────────────────────────────────── */
    // Recarga de verdade, não `history.back()`: o que se prova aqui é que o
    // PUT gravou no doc do usuário E que o servidor devolve o painel já
    // aberto no PRIMEIRO desenho (é ele quem resolve, não o cliente).
    await abrirConfig("recarga");
    const depois = await lerPaineis(page);
    const filaDepois = depois.find((p) => p.id === "fila-envio");
    if (!filaDepois?.aberto || !filaDepois.corpoVisivel) {
      problemas.push(`recarga/${sufixo}: "fila-envio" voltou fechado — a escolha não sobreviveu`);
    }
    const vazaram = depois.filter((p) => p.id !== "fila-envio" && p.corpoVisivel);
    if (vazaram.length > 0) {
      problemas.push(
        `recarga/${sufixo}: painel que estava fechado voltou aberto (${vazaram.map((p) => p.id).join(", ")})`,
      );
    }

    const pngRecarga = path.join(SAIDA, `paineis-recarga-${sufixo}${marca}.png`);
    await page.screenshot({ path: pngRecarga, fullPage: true });
    gerados.push(pngRecarga);
    itens.push({ rotulo: `após recarga · ${sufixo}`, png: pngRecarga });

    // Fecha de volta: o próximo tema começa do padrão, como o usuário novo.
    definirPaineisAbertosNoDoc("admin", []);
    await ctx.close();
  }

  const folha = await browser.newPage();
  gerados.push(
    await folhaDeContato(folha, "Painéis colapsáveis (/config)", "paineis", [
      { rotulo: "celular · escuro", itens: itens.filter((i) => i.rotulo.endsWith("· celular")) },
      { rotulo: "desktop · escuro", itens: itens.filter((i) => i.rotulo.endsWith("· desktop")) },
      { rotulo: "celular · claro", itens: itens.filter((i) => i.rotulo.endsWith("celular-claro")) },
      { rotulo: "desktop · claro", itens: itens.filter((i) => i.rotulo.endsWith("desktop-claro")) },
    ]),
  );
  await folha.close();

  if (problemas.length > 0) {
    throw new Error(`[paineis] ${problemas.length} problema(s):\n  ${problemas.join("\n  ")}`);
  }
  console.log(
    `  [paineis] ok — ${PAINEIS_CONFIG.length} blocos, todos fechados por padrão, resumo no cabeçalho e a escolha sobrevivendo à recarga.`,
  );
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
    if (querido("pendencias")) gerados.push(...(await medirPendencias(browser, secret)));
    if (querido("fila")) gerados.push(...(await medirFila(browser, secret)));
    if (querido("respostas")) gerados.push(...(await medirRespostas(browser, secret)));
    if (querido("teste")) gerados.push(...(await medirDisparoTeste(browser, secret)));
    if (querido("paineis")) gerados.push(...(await medirPaineisConfig(browser, secret)));
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
