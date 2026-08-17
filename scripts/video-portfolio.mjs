/**
 * GRAVAÇÃO DE VÍDEO das demos — material de portfólio pra TikTok, Reels e
 * Kwai. Abre a demo, desce do topo ao rodapé numa panorâmica suave e
 * entrega um .mp4 vertical pronto pra subir.
 *
 * LOCAL, SEMPRE. Não roda em CI nem na Vercel — e isso aqui é uma GUARDA
 * de verdade (ver `exigirLocal`), não um pedido no comentário: gravar
 * vídeo é trabalho de portfólio, feito à mão, com o resultado olhado antes
 * de virar post. Um workflow disparando isto sozinho só gastaria minuto de
 * runner produzindo arquivo que ninguém ia ver.
 *
 * O AVESSO DO MOTOR DE CAPTURAS. `scripts/capturas.mjs` congela o relógio
 * das animações (`congelarAnimacoes`), prende o LED numa fase fixa
 * (`assentarLed`) e some com o cromo (`neutralizarCromo`) — tudo pra que a
 * FOTO não saia no meio do voo. Aqui é o contrário: efeito de fundo, LED e
 * revelação de seção precisam estar RODANDO durante a gravação, senão não
 * há o que filmar. Nenhuma dessas três funções é chamada. De
 * `lib/demos/capturas/dom.mjs` vem só o helper de ESPERA
 * (`esperarTextoEstavel`) — o resto do módulo existe pra congelar, e
 * congelar é justamente o que este script não pode fazer.
 *
 * Uso:
 *   node scripts/video-portfolio.mjs --skin=barbearia-editorial
 *   node scripts/video-portfolio.mjs --skin=petshop-focinho-feliz --duracao=6000
 *   node scripts/video-portfolio.mjs --lead=<placeId>
 *
 * Opções:
 *   --skin=<skinId>    skin do harness /interno/demo-qa
 *   --lead=<placeId>   demo REAL do lead (rota pública), em vez da de exemplo
 *   --duracao=<ms>     duração da descida (default: 3500)
 *   --saida=<dir>      pasta de saída (default: ./saida-video, no .gitignore)
 *   --sem-build        pula o `next build` (reaproveita o .next da rodada anterior)
 *
 * Exige `ffmpeg` COMPLETO no PATH (ver `exigirFfmpeg`). O empacotado pelo
 * Playwright não serve.
 *
 * ────────────────────────────────────────────────────────────────────────
 * O QUE O `recordVideo` DO PLAYWRIGHT FAZ E NÃO FAZ — medido por sonda
 * neste repo, não deduzido da documentação. As três descobertas abaixo são
 * a razão de os números deste arquivo serem os que são:
 *
 *   1. `recordVideo.size` NÃO ESCALA. O pipeline interno é `pad`+`crop`,
 *      não `scale`: pedir 1080×1920 com viewport de 540×960 entrega um
 *      quadro de 1080×1920 com o site num retângulo de 540×960 no canto
 *      superior esquerdo e CINZA no resto. Por isso `size` aqui é sempre
 *      IGUAL ao viewport, e o 1080×1920 sai do ffmpeg (`converterParaMp4`).
 *
 *   2. `deviceScaleFactor` NÃO CHEGA AO VÍDEO. O quadro sai em pixel CSS:
 *      dpr 1, 2 e 3 deram exatamente o mesmo tamanho de vídeo. O dpr não é
 *      inútil — `window.devicePixelRatio` na página É 2, então o
 *      `next/image` das skins escolhe o asset 2× e o que entra no quadro é
 *      a versão boa da foto —, mas ele não acrescenta um pixel ao arquivo.
 *
 *   3. O FPS É FIXO EM 25. Playwright não expõe controle nenhum sobre
 *      isso. O mp4 sai nos mesmos 25 (TikTok/Reels/Kwai aceitam sem
 *      reclamar); converter pra 30 seria DUPLICAR quadro, e numa
 *      panorâmica linear como esta a duplicação aparece como tremidinha.
 * ────────────────────────────────────────────────────────────────────────
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { chromium } from "playwright-core";

import { esperarTextoEstavel } from "../src/lib/demos/capturas/dom.mjs";
import { CHROMIUM, RAIZ, subirServidor } from "./qa-servidor.mjs";

const exec = promisify(execFile);

/**
 * A TELA DE CELULAR — e a escolha de 540×960 tem duas razões, as duas
 * medidas:
 *
 * PROPORÇÃO. O quadro de TikTok/Reels/Kwai é 9:16 (1080×1920 = 0,5625).
 * Um iPhone 12/13/14 é 390×844, que é 19,5:9 (0,462) — não é a mesma
 * coisa. Levar 390×844 pra 1080×1920 obrigaria a escolher entre distorcer
 * 11% na horizontal, cortar 18% da altura ou pôr barra dos dois lados.
 * 540×960 É 9:16 exato: a conversão vira uma multiplicação por 2, sem
 * barra, sem corte, sem distorção.
 *
 * LARGURA. Como o vídeo sai em pixel CSS (descoberta 2 no topo), a largura
 * do viewport é literalmente a resolução real do material — 540 px de
 * conteúdo verdadeiro ampliados 2×, contra 390 px ampliados 2,77×. E 540
 * continua ABAIXO do breakpoint `sm:` do Tailwind (640px), então o layout
 * é o MESMO layout de celular que um aparelho de 390 mostraria: nenhuma
 * classe responsiva troca de faixa entre 390 e 540.
 */
const CELULAR = {
  id: "mobile",
  largura: 540,
  altura: 960,
  dpr: 2,
  saida: { largura: 1080, altura: 1920 },
};

/** Respiro no topo antes de a descida começar. */
const PAUSA_TOPO_MS = 800;
/** Respiro no rodapé antes de cortar. */
const PAUSA_FIM_MS = 500;
/** Duração default da descida. */
const DURACAO_PADRAO_MS = 3500;

/**
 * Colchão do corte de cabeça (ver `gravar`). O relógio do .webm começa no
 * PRIMEIRO QUADRO que o Chromium emite, que não é exatamente o instante em
 * que a página foi criada — então o deslocamento calculado por relógio de
 * parede erra por alguns décimos. Errar pra MENOS é inofensivo (sobra um
 * pedaço do assentamento, que é visualmente idêntico à pausa do topo);
 * errar pra mais comeria o respiro de abertura. Daí o viés.
 */
const COLCHAO_CORTE_MS = 300;

/**
 * ────────────────────────────────────────────────────────────────────────
 * NÃO CONTAMINAR O RASTREIO — o mesmo caminho de exclusão do motor de
 * capturas, conferido no código e não suposto. São DUAS coisas, e nenhuma
 * delas é header de segredo ou user-agent de pré-visualização (não existe
 * nada disso neste repo):
 *
 *   1. CONTEXTO SEM COOKIE NENHUM na rota pública
 *      (`capturas.mjs:663` e `:862` — o `addCookies` é condicionado a
 *      `/interno/`). Sem `radar_session` e sem `radar_device`,
 *      `classificarVisitaInterna` (lib/device.ts) dá `false`, e o selo
 *      "Vendo como membro" não é renderizado (demo/[leadId]/page.tsx).
 *
 *   2. URL SEM `?t=` (`capturas.mjs:179`). `DemoPage` só chama
 *      `registrarVisitaDemo` quando há token — sem token não nasce entrada
 *      em `lead.demoVisitas` — e só monta `<VisitaTracker>` quando existe
 *      `visitaId`, então o beacon do unload nem chega a ser instalado.
 *
 * As guardas abaixo transformam as duas em MEDIDA. Uma gravação que
 * estampasse o selo ou registrasse visita é artefato contaminado, então
 * elas REPROVAM a rodada em vez de avisar: não sai mp4.
 * ────────────────────────────────────────────────────────────────────────
 */

/**
 * O parâmetro de token de envio da demo. Fonte da verdade:
 * `TOKEN_QUERY_PARAM` em `src/lib/demos/envio.ts` — TypeScript, que este
 * script não compila (mesma limitação que `capturas.mjs` documenta).
 */
const TOKEN_PARAM = "t";

/** Texto do selo. Fonte: `src/app/demo/SeloVisitaInterna.tsx`. */
const TEXTO_SELO = "Vendo como membro";

/** Rota do beacon de visita. Fonte: `src/app/demo/VisitaTracker.tsx`. */
const ROTA_BEACON = "/api/demo-visita";

/**
 * Espião de `navigator.sendBeacon`, instalado ANTES de qualquer script da
 * página (`addInitScript`).
 *
 * Ele NÃO repassa a chamada adiante, de propósito. Um espião que só
 * observasse deixaria a regressão escrever no Firestore e depois contaria
 * o ocorrido; este BARRA e registra. Se um dia a rota pública passar a
 * montar o rastreador sem token, a rodada reprova com o beacon na mão e
 * nada foi gravado no lead.
 */
const ESPIAO_BEACON = () => {
  window.__radarVideoBeacons = [];
  navigator.sendBeacon = (url) => {
    window.__radarVideoBeacons.push(String(url));
    return true;
  };
};

/**
 * `--nome=valor` e `--nome valor` — as duas formas. Os outros laços deste
 * repo só aceitam a primeira porque são chamados por workflow; este é
 * digitado à mão toda vez.
 */
function opcao(nome) {
  const i = process.argv.indexOf(`--${nome}`);
  if (i !== -1) {
    const proximo = process.argv[i + 1];
    if (proximo && !proximo.startsWith("--")) return proximo;
  }
  const arg = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return arg?.split("=").slice(1).join("=");
}
const temFlag = (nome) => process.argv.some((a) => a === `--${nome}` || a.startsWith(`--${nome}=`));

/**
 * A guarda de "local, sempre". Falha ANTES de subir servidor ou navegador:
 * o erro tem que ser a primeira coisa no log de quem tentou automatizar
 * isto, não uma surpresa vinte minutos depois.
 */
function exigirLocal() {
  const marcas = ["CI", "GITHUB_ACTIONS", "VERCEL", "VERCEL_ENV"].filter((v) => process.env[v]);
  if (marcas.length === 0) return;
  throw new Error(
    `scripts/video-portfolio.mjs é um script LOCAL e não roda em ambiente automatizado ` +
      `(${marcas.join(", ")} no ambiente). É material de portfólio: alguém precisa olhar o vídeo ` +
      `antes de ele virar post. Se este for um ambiente local com essas variáveis por engano, ` +
      `limpe-as antes de rodar.`,
  );
}

/**
 * ffmpeg COMPLETO no PATH — e a checagem vai até o encoder porque o erro
 * mais provável não é "não tem ffmpeg", é "tem o ffmpeg errado".
 *
 * Quem já roda Playwright neste repo tem um ffmpeg no disco: o empacotado
 * junto com o Chromium (`$PLAYWRIGHT_BROWSERS_PATH/ffmpeg-*`). Ele é
 * compilado com `--disable-everything` e só sabe mjpeg→vp8/webm — é
 * exatamente o que grava o .webm que este script recebe, e não tem
 * libx264 nem muxer mp4. Apontar pra ele falharia lá na frente, com uma
 * mensagem de codec que não diz nada. A checagem é aqui.
 */
async function exigirFfmpeg() {
  let encoders;
  try {
    encoders = (await exec("ffmpeg", ["-hide_banner", "-encoders"])).stdout;
  } catch {
    throw new Error(
      "ffmpeg não encontrado no PATH.\n" +
        "  Este script converte o .webm do Playwright em .mp4 (h264 + yuv420p) e precisa de um ffmpeg completo.\n" +
        "  O empacotado pelo Playwright ($PLAYWRIGHT_BROWSERS_PATH/ffmpeg-*) NÃO serve: é compilado com\n" +
        "  --disable-everything (só mjpeg→vp8/webm), sem libx264 e sem muxer mp4.\n" +
        "  Instale o do sistema: `sudo apt install ffmpeg` (Debian/Ubuntu) ou `brew install ffmpeg` (macOS).",
    );
  }
  if (!encoders.includes("libx264")) {
    throw new Error(
      "o ffmpeg do PATH não tem o encoder libx264 — provavelmente é o build enxuto do Playwright.\n" +
        "  Instale um ffmpeg completo (`sudo apt install ffmpeg` / `brew install ffmpeg`) e rode de novo.",
    );
  }
}

/**
 * Elementos que carregam o texto do selo "Vendo como membro". Vazio é o
 * único resultado aceitável numa gravação.
 *
 * A busca é por TEXTO porque o selo não expõe marcador nenhum no DOM (ver
 * SeloVisitaInterna.tsx: markup e estilo inline, sem classe nem
 * `data-*`) — e pôr um marcador lá seria mexer no produto por causa de um
 * script de portfólio. Só folhas entram na conta: sem isso `<body>` e cada
 * ancestral contariam de novo pelo mesmo texto.
 *
 * `script` fica de fora porque o payload RSC que o Next embute no HTML
 * repete o markup inteiro do selo como texto — medido no controle negativo
 * desta feature, que abriu a demo COM sessão de propósito: a detecção
 * acertava, mas a mensagem de erro vinha com o bundle inteiro colado nela.
 * O que importa é o selo PINTADO, e isso mora no DOM renderizado.
 *
 * Autossuficiente (vai pro `page.evaluate`).
 */
function selosNoDom(texto, win = window) {
  const achados = [];
  for (const node of Array.from(win.document.body.querySelectorAll("*"))) {
    if (node.children.length > 0) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "noscript" || tag === "template") continue;
    if ((node.textContent ?? "").includes(texto)) {
      achados.push(`${tag}: ${node.textContent.trim().slice(0, 60)}`);
    }
  }
  return achados;
}

/**
 * FORÇA o caminho de descarga da página — o que transforma "o beacon não
 * disparou" de esperança em medida.
 *
 * O `VisitaTracker` manda o beacon em `visibilitychange` (indo pra
 * "hidden") e em `pagehide`. Os dois só acontecem de verdade quando a
 * página fecha, e aí já não dá pra perguntar nada a ela. Aqui os dois são
 * disparados À MÃO, com a página ainda viva: se o rastreador estivesse
 * montado, ele mandaria o beacon NESTE ponto, e o espião registraria.
 * Roda depois da última pausa, então não entra no que o vídeo mostra.
 *
 * Autossuficiente (vai pro `page.evaluate`).
 */
async function forcarDescarga(win = window) {
  const doc = win.document;
  Object.defineProperty(doc, "visibilityState", { configurable: true, get: () => "hidden" });
  doc.dispatchEvent(new Event("visibilitychange"));
  win.dispatchEvent(new Event("pagehide"));
  delete doc.visibilityState;
  await new Promise((r) => setTimeout(r, 150));
  return win.__radarVideoBeacons ?? [];
}

/**
 * Prepara a página SEM ROLAR — e é aí que ela se separa da
 * `prepararPagina` do motor de capturas, que varre o documento inteiro
 * antes de qualquer medida.
 *
 * A varredura de lá existe pra disparar o lazy-load E as revelações de
 * entrada na viewport. Só que `whileInView` das skins é `once: true`: uma
 * vez disparada, a revelação não volta. Numa FOTO isso é exatamente o que
 * se quer — nada entra no enquadramento ainda transparente. Num VÍDEO é a
 * ruína: a página chegaria na gravação com todas as seções já reveladas, e
 * a descida não mostraria animação nenhuma — que é o único motivo de este
 * script existir.
 *
 * Então o lazy-load é forçado pelo OUTRO caminho, o que não mexe no
 * observador: `loading="eager"` em toda imagem (as skins usam
 * `next/image`, que emite `loading="lazy"` nativo) e uma varredura
 * HORIZONTAL dos trilhos roláveis — galeria, carrossel, cardápio —, que
 * rolagem vertical nenhuma alcançaria. Cada seção continua ARMADA pra
 * revelar quando a gravação passar por ela.
 *
 * `rolagem` volta no resultado como PROVA de que nada rolou: se um dia
 * alguma coisa aqui dentro mexer no scroll, o número denuncia.
 *
 * Autossuficiente, como toda função que vai pro `page.evaluate` (a regra
 * de ouro de capturas/dom.mjs vale igual aqui: o corpo é serializado e
 * avaliado noutro realm, onde nada do escopo deste módulo existe).
 *
 * @param {{ limiteImagemMs?: number }} [opcoes]
 * @param {Window} [win]
 */
async function prepararSemRolar({ limiteImagemMs = 8000 } = {}, win = window) {
  const doc = win.document;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const img of Array.from(doc.images)) {
    if (img.loading === "lazy") img.loading = "eager";
    img.removeAttribute("decoding");
  }

  let trilhos = 0;
  for (const node of Array.from(doc.querySelectorAll("*"))) {
    if (node === doc.body || node === doc.documentElement) continue;
    if (node.scrollWidth <= node.clientWidth + 1) continue;
    trilhos += 1;
    const volta = node.scrollLeft;
    const passo = Math.max(120, Math.round(node.clientWidth * 0.8));
    for (let x = 0; x < node.scrollWidth; x += passo) node.scrollLeft = x;
    node.scrollLeft = volta;
  }

  await doc.fonts.ready;

  // Imagem sem `complete` viraria buraco no meio da panorâmica; `decode()`
  // garante que ela também já foi rasterizada, não só baixada — a
  // rasterização no meio de um quadro é engasgo visível.
  await Promise.all(
    Array.from(doc.images).map((img) =>
      img.complete && img.naturalWidth > 0
        ? (img.decode?.().catch(() => undefined) ?? Promise.resolve())
        : new Promise((r) => {
            img.addEventListener("load", r, { once: true });
            img.addEventListener("error", r, { once: true });
            setTimeout(r, limiteImagemMs);
          }),
    ),
  );
  await espera(250);

  const imgs = Array.from(doc.images);
  return {
    altura: doc.documentElement.scrollHeight,
    imagens: imgs.length,
    imagensProntas: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
    trilhos,
    rolagem: Math.round(win.scrollY),
  };
}

/**
 * A DESCIDA GRAVADA: do topo ao rodapé em `duracao` ms, por
 * `requestAnimationFrame`, com easing ease-in-out cúbico (parte parada,
 * ganha velocidade no miolo, encosta no rodapé sem batida).
 *
 * `behavior: "instant"` em CADA passo, pelo mesmo motivo que
 * `rolarAteSecao` documenta em capturas/dom.mjs: `imobiliaria` e
 * `multimarcas` declaram `html { scroll-behavior: smooth }` por causa da
 * nav de âncora, e sem `instant` cada quadro começaria uma rolagem ANIMADA
 * por cima da anterior — a descida mal sairia do topo.
 *
 * O FUNDO É RECALCULADO A CADA QUADRO, e não fixado no primeiro: revelação
 * de seção e imagem que ainda chega mudam a altura do documento DURANTE a
 * descida. Com o alvo congelado no valor inicial o vídeo pararia antes do
 * rodapé em toda skin com galeria.
 *
 * Autossuficiente (vai pro `page.evaluate`).
 *
 * @param {{ duracao?: number }} [opcoes]
 * @param {Window} [win]
 */
async function rolarDoTopoAoRodape({ duracao = 3500 } = {}, win = window) {
  const doc = win.document;
  const facil = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  return new Promise((resolve) => {
    const inicio = win.performance.now();
    let quadros = 0;
    let fundo = 0;

    function passo(agora) {
      quadros += 1;
      const t = Math.min(1, (agora - inicio) / duracao);
      fundo = Math.max(0, doc.documentElement.scrollHeight - win.innerHeight);
      win.scrollTo({ top: facil(t) * fundo, behavior: "instant" });
      if (t < 1) {
        win.requestAnimationFrame(passo);
        return;
      }
      resolve({
        quadros,
        fundo: Math.round(fundo),
        final: Math.round(win.scrollY),
        gastoMs: Math.round(agora - inicio),
      });
    }

    win.requestAnimationFrame(passo);
  });
}

/**
 * .webm do Playwright → .mp4 de rede social.
 *
 * `-ss` DEPOIS do `-i` de propósito: antes do `-i` o corte salta pro
 * keyframe mais próximo, e o vp8 que o Playwright escreve
 * (`-deadline realtime -speed 8`) não garante keyframe onde precisamos.
 * Depois do `-i` o ffmpeg decodifica desde o começo e descarta quadro a
 * quadro — mais lento, exato, e o vídeo é de segundos.
 *
 * `yuv420p` não é preferência: é o que qualquer player de rede social
 * exige. Sem ele o arquivo abre no VLC e não abre no telefone de ninguém.
 */
async function converterParaMp4({ bruto, destino, tela, cortarSegundos }) {
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", bruto];
  if (cortarSegundos > 0) args.push("-ss", cortarSegundos.toFixed(3));
  args.push(
    "-an", // sem áudio: não há o que gravar, e faixa muda só engorda o arquivo
    "-vf",
    `scale=${tela.saida.largura}:${tela.saida.altura}:flags=lanczos`,
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    destino,
  );
  await exec("ffmpeg", args);
}

/** Duração em segundos de um arquivo de vídeo, pelo ffprobe. */
async function duracaoDe(arquivo) {
  const { stdout } = await exec("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    arquivo,
  ]);
  return Number(stdout.trim());
}

/**
 * Uma gravação, do `newPage` ao .mp4 no disco.
 *
 * O CORTE DE CABEÇA existe porque o Playwright começa a gravar no instante
 * em que a página é criada — não há pausar/retomar. Então o .webm sempre
 * traz, antes do vídeo de verdade, a navegação e a preparação (fonte
 * trocando, imagem entrando). O deslocamento é medido por relógio de
 * parede entre `newPage` e o fim do assentamento, com o colchão de
 * `COLCHAO_CORTE_MS` (ver a constante).
 */
async function gravar({ browser, alvo, tela, duracao, saida, cookie }) {
  const dirBruto = path.join(saida, ".bruto");
  await fs.mkdir(dirBruto, { recursive: true });

  // A rota /interno/* é harness protegido por sessão; tudo o mais é a demo
  // PÚBLICA, e é ela que tem rastreio pra não contaminar.
  const publica = !alvo.url.includes("/interno/");
  if (publica) {
    const token = new URL(alvo.url).searchParams.get(TOKEN_PARAM);
    if (token) {
      throw new Error(
        `a URL da gravação carrega ?${TOKEN_PARAM}=… — token de envio é do LEAD, e abrir a demo com ` +
          `ele registraria a gravação na timeline de visitas dele. Grave sem token.`,
      );
    }
  }

  const ctx = await browser.newContext({
    viewport: { width: tela.largura, height: tela.altura },
    deviceScaleFactor: tela.dpr,
    // PINADO, e o valor é o oposto do que um laço de captura quereria:
    // este é hoje o default do Playwright (medido: a página lê
    // `prefers-reduced-motion: reduce` como false), mas default é coisa
    // que muda de versão — e o dia em que mudasse, as skins pulariam
    // TypewriterText, SectionReveal, Parallax e a intro por completo (elas
    // consultam a media query direto) e o vídeo sairia com a página
    // parada, sem nada denunciando o porquê.
    reducedMotion: "no-preference",
    // `size` IGUAL ao viewport: `recordVideo.size` padda com cinza em vez
    // de escalar (ver o cabeçalho). O 1080×1920 sai do ffmpeg.
    recordVideo: { dir: dirBruto, size: { width: tela.largura, height: tela.altura } },
  });
  // A rota /interno/* exige sessão; a demo pública não leva cookie nenhum
  // — mesma regra do motor de capturas, pelos mesmos dois motivos (selo
  // "Vendo como membro" e rastreio de visita).
  if (!publica) await ctx.addCookies([cookie]);

  // Segunda barreira, na rede: mesmo que o rastreador escapasse do espião
  // (um caminho de fetch/XHR em vez de sendBeacon), a chamada morre aqui.
  const beaconsNaRede = [];
  await ctx.route(`**${ROTA_BEACON}*`, (rota) => {
    beaconsNaRede.push(rota.request().url());
    return rota.abort();
  });
  await ctx.addInitScript(ESPIAO_BEACON);

  // Terceira: o contexto da demo pública tem que estar LIMPO. É a
  // condição de que dependem tanto a ausência do selo quanto a
  // classificação `interna: false` (ver lib/device.ts).
  const cookiesDoContexto = await ctx.cookies();
  if (publica && cookiesDoContexto.length > 0) {
    await ctx.close();
    throw new Error(
      `o contexto da demo pública recebeu ${cookiesDoContexto.length} cookie(s) ` +
        `(${cookiesDoContexto.map((c) => c.name).join(", ")}) — com sessão ou marcador de dispositivo ` +
        `a demo estampa o selo "${TEXTO_SELO}" e a visita é classificada como interna.`,
    );
  }

  const page = await ctx.newPage();
  const nasceu = Date.now();
  const bruto = path.join(dirBruto, `${alvo.nome}-${tela.id}.webm`);

  let preparo;
  let descida;
  let cortarSegundos = 0;
  let beaconsNaPagina = [];
  try {
    await page.goto(alvo.url, { waitUntil: "networkidle" });

    // O selo é checado AQUI, antes de qualquer trabalho de gravação: se
    // ele está na tela, o vídeo inteiro já nasceu contaminado e não há o
    // que aproveitar da rodada.
    const selos = await page.evaluate(selosNoDom, TEXTO_SELO);
    if (selos.length > 0) {
      throw new Error(
        `a página está exibindo o selo "${TEXTO_SELO}" (${selos.join(" · ")}) — ele entraria no vídeo. ` +
          `Quer dizer que a visita foi classificada como interna: confira se algum cookie vazou pro contexto.`,
      );
    }

    preparo = await page.evaluate(prepararSemRolar, {});
    const texto = await page.evaluate(esperarTextoEstavel, {});
    preparo.textoEstavel = texto.estavel;

    // Assentamento: a página já está visualmente final aqui, e é neste
    // trecho que o colchão do corte cai (ver COLCHAO_CORTE_MS).
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(400);
    cortarSegundos = Math.max(0, (Date.now() - nasceu - COLCHAO_CORTE_MS) / 1000);

    await page.waitForTimeout(PAUSA_TOPO_MS);
    descida = await page.evaluate(rolarDoTopoAoRodape, { duracao });
    await page.waitForTimeout(PAUSA_FIM_MS);

    beaconsNaPagina = await page.evaluate(forcarDescarga);
  } catch (erro) {
    // Guarda reprovada (ou falha de gravação): o .webm que já estiver no
    // disco vai embora junto. Deixar mídia de uma rodada reprovada por aí
    // é como o arquivo contaminado acabaria virando post.
    const video = page.video();
    await page.close().catch(() => undefined);
    await ctx.close().catch(() => undefined);
    await video?.delete().catch(() => undefined);
    await fs.rm(dirBruto, { recursive: true, force: true }).catch(() => undefined);
    throw erro;
  }

  // O vídeo só é escrito no disco quando a PÁGINA fecha, e só fica
  // acessível depois que o contexto fecha — nesta ordem, sempre.
  const video = page.video();
  await page.close();
  await ctx.close();
  await video?.saveAs(bruto);
  await video?.delete().catch(() => undefined);

  // Última guarda, e só agora dá pra fechá-la: o beacon do unload real
  // acontece no `page.close()` acima. Os dois canais são conferidos — o
  // espião de `sendBeacon` dentro da página e a rota barrada na rede.
  const beacons = [...beaconsNaPagina, ...beaconsNaRede];
  if (beacons.length > 0) {
    await fs.rm(dirBruto, { recursive: true, force: true }).catch(() => undefined);
    throw new Error(
      `a gravação disparou ${beacons.length} beacon(s) de visita (${beacons.join(", ")}) — ` +
        `nenhum chegou ao servidor porque as guardas barram, mas a gravação não pode nem tentar. ` +
        `Confira se a URL ganhou um ?${TOKEN_PARAM}=.`,
    );
  }

  const destino = path.join(saida, `${alvo.nome}-${tela.id}.mp4`);
  const brutoSegundos = await duracaoDe(bruto);
  await converterParaMp4({ bruto, destino, tela, cortarSegundos });
  const finalSegundos = await duracaoDe(destino);

  await fs.rm(bruto, { force: true });
  await fs.rm(dirBruto, { recursive: true, force: true }).catch(() => undefined);

  return {
    destino,
    preparo,
    descida,
    brutoSegundos,
    finalSegundos,
    cortarSegundos,
    guardas: { publica, cookies: cookiesDoContexto.length, beacons: beacons.length, selos: 0 },
  };
}

async function main() {
  exigirLocal();
  await exigirFfmpeg();

  const skinId = opcao("skin");
  const leadId = opcao("lead");
  if (!skinId && !leadId) {
    throw new Error("informe --skin=<skinId> (demo de exemplo) ou --lead=<placeId> (demo real do lead)");
  }
  if (skinId && leadId) throw new Error("--skin e --lead são alternativas; escolha uma");

  const duracao = Number(opcao("duracao") ?? DURACAO_PADRAO_MS);
  if (!Number.isFinite(duracao) || duracao <= 0) {
    throw new Error(`--duracao inválida: ${opcao("duracao")}`);
  }
  const saida = path.resolve(RAIZ, opcao("saida") ?? "saida-video");
  await fs.mkdir(saida, { recursive: true });

  const { base, cookie, encerrar } = await subirServidor({ build: !temFlag("sem-build") });
  const browser = await chromium.launch({ executablePath: CHROMIUM });

  try {
    const alvo = leadId
      ? {
          nome: leadId,
          // SEM `?t=`: token é do envio ao lead, e uma gravação de
          // portfólio não pode entrar na timeline de visitas da demo dele
          // (ver o bloco "NÃO CONTAMINAR O RASTREIO" no topo).
          url: `${base}/demo/${encodeURIComponent(leadId)}`,
        }
      : {
          nome: skinId,
          // `intro=0` pelo mesmo motivo das capturas: a splash de abertura
          // cobriria os primeiros segundos, e o que o vídeo tem pra mostrar
          // é o site, não a cortina.
          url: `${base}/interno/demo-qa?skin=${encodeURIComponent(skinId)}&intro=0`,
        };

    console.log(`\n== ${alvo.nome} — ${CELULAR.largura}×${CELULAR.altura} → ${CELULAR.saida.largura}×${CELULAR.saida.altura}, descida de ${duracao}ms`);
    const r = await gravar({ browser, alvo, tela: CELULAR, duracao, saida, cookie });

    console.log(
      `  preparo: ${r.preparo.imagensProntas}/${r.preparo.imagens} imagens · ` +
        `${r.preparo.trilhos} trilho(s) horizontais · documento ${r.preparo.altura}px · ` +
        `rolagem ${r.preparo.rolagem} (tem que ser 0) · texto estável: ${r.preparo.textoEstavel}`,
    );
    console.log(
      `  descida: ${r.descida.quadros} quadros em ${r.descida.gastoMs}ms ` +
        `(${(r.descida.quadros / (r.descida.gastoMs / 1000)).toFixed(1)} q/s) · ` +
        `parou em ${r.descida.final}/${r.descida.fundo}px`,
    );
    console.log(
      `  vídeo: bruto ${r.brutoSegundos.toFixed(2)}s − corte de cabeça ${r.cortarSegundos.toFixed(2)}s ` +
        `→ ${r.finalSegundos.toFixed(2)}s`,
    );
    console.log(
      `  rastreio: ${r.guardas.publica ? "rota PÚBLICA" : "harness /interno"} · ` +
        `${r.guardas.cookies} cookie(s) no contexto · ${r.guardas.selos} selo(s) "${TEXTO_SELO}" · ` +
        `${r.guardas.beacons} beacon(s) de visita`,
    );
    console.log(`\n  ✔ ${r.destino}`);
  } finally {
    await browser.close();
    encerrar();
  }
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
