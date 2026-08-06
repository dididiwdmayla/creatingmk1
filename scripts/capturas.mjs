/**
 * MOTOR DE CAPTURA das demos — os prints que vão pra prospecção no
 * WhatsApp. Reaproveita o laço visual inteiro: `subirServidor` (app real +
 * cookie de sessão assinado), o Chromium do ambiente e a técnica de
 * congelamento de animação do `qa-visual.mjs`.
 *
 * Por âncora marcada (ver lib/demos/capturas/ancoras.ts) e por tela
 * (celular e desktop), gera UMA imagem enquadrando a seção inteira, do
 * início ao fim.
 *
 * Uso:
 *   node scripts/capturas.mjs --lead=<placeId>      # demo REAL do lead
 *   node scripts/capturas.mjs --leads=<id>,<id>     # lote (um build só)
 *   node scripts/capturas.mjs --skin=<skinId>       # harness, sem banco
 *   node scripts/capturas.mjs --skins               # todas as 8 skins
 *   node scripts/capturas.mjs --lead=<id> --subir   # sobe pro Storage
 *
 * Opções: --saida=<dir> (default: ./capturas) · --sem-build · --so=<tela>
 *          --manifesto=<arquivo.json> (o que cada alvo produziu, com as URLs
 *          do Storage quando houve `--subir`) — é o que o workflow lê
 *
 * O modo `--skin` existe pra exercitar e verificar o motor sem depender de
 * lead nem de Firestore (é como o enquadramento foi validado); o modo
 * `--lead` é o de produção e captura a rota PÚBLICA, que é o que o lead
 * enxerga.
 *
 * NENHUM REQUEST PAGO: a demo pública é Server Component que lê só o
 * Firestore, e o harness não lê nem isso. Nada aqui toca a Google Places
 * nem o Gemini.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

import {
  caixaNaViewport,
  congelarAnimacoes,
  esperarTextoEstavel,
  fixarUnidadesDeTela,
  forcarImagensDaSecao,
  identidadeDaPagina,
  imagensDaSecao,
  medirSecao,
  neutralizarCromo,
  paletaDaPagina,
  prepararPagina,
  rolarAteSecao,
  tituloCoberto,
} from "../src/lib/demos/capturas/dom.mjs";
import { htmlMoldura, medidasMoldura, nomeComposto } from "../src/lib/demos/capturas/moldura.mjs";
import {
  htmlPrevia,
  PREVIA_ALTURA,
  PREVIA_LARGURA,
} from "../src/lib/demos/capturas/previa.mjs";
import { ANCORAS_PADRAO } from "../src/lib/demos/capturas/padrao.mjs";
import { CHROMIUM, RAIZ, subirServidor } from "./qa-servidor.mjs";

/**
 * As duas telas. Celular em dpr 2 porque a imagem é vista NUM CELULAR — em
 * dpr 1 o texto da demo chega serrilhado na conversa. Desktop em dpr 1 já
 * sai com 1440px de largura, que é mais do que o WhatsApp entrega.
 */
/** Teto de viewport (a textura do Chromium tem limite; nenhuma seção chega perto). */
const ALTURA_MAX = 12000;
/**
 * Teto da COMPOSIÇÃO. A moldura acrescenta faixa de status e bisel à
 * captura, então uma seção já perto do teto acima pode passar do limite de
 * textura do Chromium (16384px) depois de emoldurada. Passando disto, a
 * crua sai e a composta não — melhor faltar a moldura de uma imagem do que
 * subir um PNG cortado pela metade sem ninguém perceber.
 */
const ALTURA_MAX_MOLDURA = 15800;

/**
 * Endereço público do Radar — o que a moldura de navegador exibe.
 *
 * Não dá pra deduzir: no runner o app roda em 127.0.0.1:3123, e o
 * `window.location.origin` que o resto do app usa não existe fora do
 * navegador. Sem a variável, a pastilha de endereço sai VAZIA (ver
 * `enderecoExibido` em moldura.mjs) — inventar domínio é pior que não ter.
 */
const APP_PUBLIC_URL = (process.env.APP_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");

/**
 * Carimbo desta rodada. Entra no nome da prévia e como `?v=` nas URLs
 * gravadas no lead — é o que faz uma rodada nova aparecer.
 *
 * Os objetos sobem com cache IMUTÁVEL de um ano (é seguro: ninguém edita
 * um PNG no lugar). Só que o caminho de cada captura é determinístico, e
 * sem uma versão na URL o "Refazer" trocaria o arquivo no Storage enquanto
 * navegador e buscador de prévia continuariam servindo o antigo — a ficha
 * mostrando a rodada passada e o WhatsApp, um cartão que já não existe.
 */
const CARIMBO = Date.now();

const TELAS = [
  { id: "desktop", largura: 1440, altura: 900, dpr: 1 },
  { id: "celular", largura: 390, altura: 844, dpr: 2 },
];

/**
 * Fase do ciclo em que cada efeito de janela curta está ACESO. Mesmos
 * números do laço visual (scripts/qa-visual.mjs, FASE_POR_EFEITO) — se um
 * dia divergirem, a captura de prospecção passa a mostrar um efeito que a
 * verificação visual nunca olhou.
 */
const FASE_POR_EFEITO = {
  "varredura-de-luz": 0.035,
  faiscas: 0.45,
};

function opcao(nome) {
  const arg = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return arg?.split("=").slice(1).join("=");
}
const temFlag = (nome) => process.argv.includes(`--${nome}`);

const SAIDA = path.resolve(RAIZ, opcao("saida") ?? "capturas");
const soTela = opcao("so");
const telas = TELAS.filter((t) => !soTela || t.id === soTela);

/**
 * Um alvo de captura: de onde vem a página e quais âncoras capturar.
 * `--lead` bate na rota pública (a demo real); `--skin`, no harness.
 */
async function resolverAlvos(base, cookie) {
  // `--leads=a,b,c` é o modo do workflow: um `next build` e um Chromium
  // para o lote inteiro, em vez de um processo por lead (o build sozinho
  // custa mais que todas as capturas de um lead juntas).
  const leadIds = (opcao("leads") ?? opcao("lead") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const skinId = opcao("skin");

  if (leadIds.length > 0) {
    // A marcação vigente vem de /config uma vez só, e a skin de cada lead
    // da ficha dele — as duas coisas o app já sabe responder.
    const rc = await fetch(`${base}/api/config`, {
      headers: { cookie: `${cookie.name}=${cookie.value}` },
    });
    const { config } = await rc.json();

    const alvos = [];
    for (const leadId of leadIds) {
      const r = await fetch(`${base}/api/leads/${encodeURIComponent(leadId)}`, {
        headers: { cookie: `${cookie.name}=${cookie.value}` },
      });
      if (!r.ok) throw new Error(`lead ${leadId}: /api/leads respondeu ${r.status}`);
      const { lead } = await r.json();
      const skinId = lead?.demo?.skinId ?? lead?.demo?.skin;
      if (!skinId) throw new Error(`lead ${leadId} não tem demo salva (nada a capturar)`);
      alvos.push({
        nome: leadId,
        leadId,
        skinId,
        // O NOME DO NEGÓCIO, que a prévia do link escreve em tipo grande —
        // é o nome do lead, o mesmo que aparece na ficha. Ler do doc em vez
        // de tirar do print é o que faz o nome continuar legível quando o
        // cartão de conversa encolhe a imagem.
        nomeNegocio: lead?.nome,
        // Sem `?t=`: token é para envio ao lead, e uma captura interna não
        // pode entrar na timeline de visitas da demo dele.
        url: `${base}/demo/${encodeURIComponent(leadId)}`,
        // O que a moldura de navegador exibe: o endereço REAL da demo, não
        // o localhost onde ela foi capturada. Sem token, pelo mesmo motivo
        // — um `?t=` estampado na foto viraria link de envio circulando
        // fora da timeline a que pertence.
        enderecoPublico: APP_PUBLIC_URL
          ? `${APP_PUBLIC_URL}/demo/${encodeURIComponent(leadId)}`
          : undefined,
        ancoras: ancorasDe(config?.capturas?.ancoras, skinId),
      });
    }
    return alvos;
  }

  const rc = await fetch(`${base}/api/config`, {
    headers: { cookie: `${cookie.name}=${cookie.value}` },
  }).catch(() => null);
  const config = rc?.ok ? (await rc.json()).config : undefined;

  // A lista de skins vem da PRÓPRIA marcação: `capturas.ancoras` já cobre
  // as 8 skins do registro por default (ver lib/demos/capturas/ancoras.ts).
  // Evita importar o registro, que é TypeScript e este script não compila.
  // Sem Firestore (sandbox de verificação) o /api/config responde erro:
  // cai no padrão do código, que é a mesma fonte que semeia o /config.
  const marcacao = config?.capturas?.ancoras ?? ANCORAS_PADRAO;
  const ids = skinId ? [skinId] : Object.keys(marcacao);
  if (ids.length === 0) {
    throw new Error("informe --lead=<id> ou --skin=<skinId>; --skins precisa do app respondendo /api/config");
  }
  return ids.map((id) => ({
    nome: id,
    skinId: id,
    // `intro=0`: a splash de abertura cobriria a página e a captura sairia
    // da tela de abertura, não da seção.
    url: `${base}/interno/demo-qa?skin=${encodeURIComponent(id)}&intro=0`,
    ancoras: ancorasDe(marcacao, id),
  }));
}

/** Fallback local do `ancorasEfetivas` (o script não importa TS). */
function ancorasDe(ancoras, skinId) {
  const lista = ancoras?.[skinId];
  if (!Array.isArray(lista)) throw new Error(`sem âncoras marcadas para a skin ${skinId}`);
  return lista;
}

/**
 * Uma captura. Cada passo existe por um defeito que a captura mostrou:
 *
 *   1. `prepararPagina` — varre a página (dispara as revelações de entrada
 *      e o lazy-load das imagens) e espera fontes + imagens decodificadas.
 *      Sem isso entra fonte de reserva ou buraco de imagem na foto.
 *   2. mede a seção com a viewport na altura REAL da tela. É o único
 *      momento em que `100vh` vale o que deve — o hero de toda skin é
 *      `min-h-screen`, e medir com a viewport esticada dava "hero" de
 *      7737px.
 *   3. seção mais alta que a tela → CRESCE A VIEWPORT até ela caber, e
 *      prepara de novo. Não dá pra usar `fullPage`+`clip`: o `fullPage`
 *      refaz o render com a viewport esticada, cai na mesma armadilha do
 *      `vh` e o recorte pousa noutra seção (foi o que a 1ª rodada deste
 *      motor produziu — "Imóveis em destaque" saiu mostrando o manifesto).
 *      Crescer a viewport tem o mesmo efeito colateral, mas aqui ele é
 *      TRATADO: remede depois de assentar e avisa se a própria seção mudou
 *      de altura.
 *   4. `neutralizarCromo` — some com header/nav fixos, que pousariam por
 *      cima do começo da seção. Na primeira seção o cromo FICA: ali ele é
 *      parte da abertura.
 *   5. `congelarAnimacoes` — WAAPI, fase fixa. Nada de faísca no meio do voo.
 *   6. `posicionarSecao` — rola e devolve a caixa MEDIDA na viewport, que
 *      é o recorte. Autocorretivo: sai de onde a seção está, não de onde
 *      se esperava que estivesse.
 *   7. `tituloCoberto` — o PORTÃO: sobrou algo por cima do título?
 */
async function capturar(page, alvo, ancora, tela, destino) {
  await page.setViewportSize({ width: tela.largura, height: tela.altura });
  await page.goto(alvo.url, { waitUntil: "networkidle" });
  await page.evaluate(prepararPagina, { alturaTela: tela.altura });

  // Prende as alturas em `vh` ANTES de qualquer redimensionamento — com a
  // viewport ainda na altura real da tela, que é onde `100vh` vale o que
  // deve. Sem isso a seção cresce junto com a viewport e nunca cabe.
  const presos = await page.evaluate(fixarUnidadesDeTela);
  const imagensForcadas = await page.evaluate(forcarImagensDaSecao, ancora);
  await page.waitForTimeout(300);

  const caixa = await page.evaluate(medirSecao, ancora);
  if (!caixa) return { erro: `seção "${ancora}" não existe no DOM desta skin` };

  // Seção mais alta que a tela: cresce a viewport até ela caber. A
  // CONVERGÊNCIA é iterativa porque uma seção que usa `vh` cresce JUNTO com
  // a viewport (o hero da barbearia no celular mede 1300px numa tela de
  // 844, e crescer pra 1300 o empurrava pra mais ainda) — persegue no
  // máximo três vezes e para quando estabiliza. `esticou` marca quem só
  // parou porque a perseguição acabou: a foto sai, com a ressalva.
  let esticou = false;
  let alvoAltura = caixa.altura;
  for (let i = 0; i < 3 && alvoAltura > tela.altura; i += 1) {
    await page.setViewportSize({ width: tela.largura, height: Math.min(alvoAltura, ALTURA_MAX) });
    // Preparar DE NOVO não é zelo: a viewport gigante traz pro campo de
    // visão imagens que estavam em lazy-load, e cada uma que chega muda a
    // altura de quem está acima. Medir antes disso mede um layout que já
    // não existe na hora do disparo.
    await page.evaluate(prepararPagina, { alturaTela: alvoAltura, quietoMs: 500 });
    const depois = await page.evaluate(medirSecao, ancora);
    if (!depois) break;
    esticou = Math.abs(depois.altura - alvoAltura) > 2;
    if (!esticou) break;
    alvoAltura = depois.altura;
  }

  const cromo = await page.evaluate(neutralizarCromo, ancora);
  const gelo = await page.evaluate(congelarAnimacoes, {
    fasePorEfeito: FASE_POR_EFEITO,
    efeitoId: new URL(alvo.url).searchParams.get("efeito") ?? undefined,
  });

  await page.evaluate(rolarAteSecao, ancora);
  await page.waitForTimeout(400);

  // Última espera, e a mais importante pra imagem que vai pro lead: as
  // imagens DA SEÇÃO. As da skin entram por lazy-load, e uma que ainda não
  // chegou vira buraco exatamente no enquadramento (a 1ª rodada saiu com
  // 7 de 13 no cardápio da lancheria). Aqui a seção já está em vista, que
  // é a condição pro carregamento começar.
  await page
    .waitForFunction(
      (id) => {
        const el = Array.from(document.querySelectorAll("[data-d-secao]")).find(
          (n) => n.getAttribute("data-d-secao") === id,
        );
        if (!el) return true;
        return Array.from(el.querySelectorAll("img")).every((i) => i.complete && i.naturalWidth > 0);
      },
      ancora,
      { timeout: 15000 },
    )
    .catch(() => undefined);

  // Texto animado por JavaScript (a máquina de escrever do hero da
  // barbearia) não é tocado por `congelarAnimacoes`, e o disparo pegava o
  // título do negócio pela metade. Ver `esperarTextoEstavel`.
  const texto = await page.evaluate(esperarTextoEstavel, { secaoId: ancora });

  const recorte = await page.evaluate(caixaNaViewport, ancora);
  const portao = await page.evaluate(tituloCoberto, ancora);
  const imagens = await page.evaluate(imagensDaSecao, ancora);
  // A paleta da própria demo, que vira o fundo da composição em moldura.
  const paleta = await page.evaluate(paletaDaPagina, ancora);

  if (!recorte || !recorte.cabe) {
    return { erro: `seção "${ancora}" não coube na viewport (${recorte?.height ?? "?"}px)` };
  }

  await page.screenshot({
    path: destino,
    clip: { x: recorte.x, y: recorte.y, width: recorte.width, height: recorte.height },
  });

  return { caixa: recorte, cromo, gelo, portao, imagens, esticou, presos, imagensForcadas, paleta, texto };
}

/**
 * A SEGUNDA VERSÃO da imagem: a captura crua dentro da moldura (aparelho no
 * celular, navegador no desktop). Ver `capturas/moldura.mjs` para o desenho
 * e o porquê de ele ser HTML.
 *
 * A composição é montada em **dpr 1 nas dimensões em pixel do PNG cru**, e
 * é o que faz a captura entrar 1:1: qualquer outro fator reamostraria a
 * imagem e o texto da demo chegaria borrado do outro lado.
 *
 * O HTML é escrito ao LADO do PNG e aberto por `file://` com `src`
 * relativo. Embutir a captura como `data:` URI custaria uma string base64
 * do tamanho do arquivo a cada imagem, sem ganho nenhum.
 */
async function comporMoldura(pagina, { tela, arquivo, largura, altura, endereco, paleta }) {
  const m = medidasMoldura({ tela, largura, altura });
  if (m.altura > ALTURA_MAX_MOLDURA) {
    return { erro: `composição de ${m.altura}px passa do teto de textura (${ALTURA_MAX_MOLDURA}px)` };
  }

  const arquivoComposto = nomeComposto(arquivo);
  const paginaHtml = path.join(SAIDA, `${arquivo}.moldura.html`);
  await fs.writeFile(
    paginaHtml,
    htmlMoldura({ tela, src: `./${arquivo}`, largura, altura, endereco, paleta }),
  );

  try {
    // `fullPage` aqui é seguro (e necessário): esta página é toda em pixel
    // fixo, sem nenhuma unidade de tela — não existe a armadilha do `vh`
    // que proíbe `fullPage` do outro lado, e a composta costuma ser mais
    // alta que qualquer viewport razoável.
    await pagina.setViewportSize({ width: m.largura, height: Math.min(m.altura, 2000) });
    await pagina.goto(`file://${paginaHtml}`, { waitUntil: "load" });
    await pagina.waitForFunction(
      () => {
        const img = document.querySelector("img.captura");
        return Boolean(img && img.complete && img.naturalWidth > 0);
      },
      undefined,
      { timeout: 20000 },
    );
    const destino = path.join(SAIDA, arquivoComposto);
    await pagina.screenshot({ path: destino, fullPage: true });
    return { arquivo: arquivoComposto, caminhoLocal: destino, largura: m.largura, altura: m.altura };
  } finally {
    await fs.unlink(paginaHtml).catch(() => undefined);
  }
}

/**
 * O TOPO DO SITE, numa viewport de desktop e sem rolagem — a matéria-prima
 * da prévia do link.
 *
 * Duas diferenças deliberadas em relação à captura por âncora:
 *
 *   - o cromo NÃO é neutralizado. Cabeçalho e nav fixos são parte do topo
 *     de um site; escondê-los aqui entregaria uma página decapitada.
 *   - o recorte é a viewport inteira, não a caixa de uma seção: o que a
 *     prévia mostra é "a primeira tela", não uma seção específica.
 *
 * O resto é o mesmo tratamento das outras: varrer para disparar revelações
 * e lazy-load, prender as unidades de tela, congelar a animação — e então
 * VOLTAR AO TOPO, porque `prepararPagina` termina a varredura no fim da
 * página e capturar dali mostraria o rodapé.
 */
async function capturarTopo(page, alvo, tela, destino) {
  await page.setViewportSize({ width: tela.largura, height: tela.altura });
  await page.goto(alvo.url, { waitUntil: "networkidle" });
  await page.evaluate(prepararPagina, { alturaTela: tela.altura });
  await page.evaluate(fixarUnidadesDeTela);
  await page.evaluate(congelarAnimacoes, {
    fasePorEfeito: FASE_POR_EFEITO,
    efeitoId: new URL(alvo.url).searchParams.get("efeito") ?? undefined,
  });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(400);
  // O topo é justamente onde mora a máquina de escrever do título: sem
  // esta espera a prévia do link sairia com o nome do negócio truncado
  // dentro do print (ver `esperarTextoEstavel`).
  await page.evaluate(esperarTextoEstavel, {});

  const identidade = await page.evaluate(identidadeDaPagina);
  // A paleta sai da primeira âncora (o hero em toda skin): as variáveis
  // `--d-*` vivem na raiz do componente da skin, e `getComputedStyle` do
  // `<body>` não as enxerga — propriedade customizada herda para baixo.
  const paleta = alvo.ancoras[0]
    ? await page.evaluate(paletaDaPagina, alvo.ancoras[0])
    : null;

  await page.screenshot({ path: destino });
  return { identidade, paleta };
}

/**
 * A prévia composta: janela de navegador com o topo do site à direita,
 * NOME DO NEGÓCIO em tipo grande à esquerda. Ver `capturas/previa.mjs`
 * para o porquê de cada decisão do desenho.
 *
 * Sai em **JPEG**, não PNG: o WhatsApp descarta prévia grande, e 1200×630
 * de screenshot em PNG passa de 1MB com folga. Em JPEG de qualidade 82 a
 * mesma imagem fica na casa das centenas de KB — e a prévia precisa chegar
 * rápido, não ser perfeita ao pixel.
 */
async function comporPrevia(pagina, { arquivoTopo, largura, altura, arquivo, ...resto }) {
  const paginaHtml = path.join(SAIDA, `${arquivo}.previa.html`);
  await fs.writeFile(paginaHtml, htmlPrevia({ src: `./${arquivoTopo}`, largura, altura, ...resto }));

  try {
    await pagina.setViewportSize({ width: PREVIA_LARGURA, height: PREVIA_ALTURA });
    await pagina.goto(`file://${paginaHtml}`, { waitUntil: "load" });
    await pagina.waitForFunction(
      () => {
        const img = document.querySelector("img.captura");
        return Boolean(img && img.complete && img.naturalWidth > 0);
      },
      undefined,
      { timeout: 20000 },
    );
    const destino = path.join(SAIDA, arquivo);
    await pagina.screenshot({ path: destino, type: "jpeg", quality: 82 });
    return { arquivo, caminhoLocal: destino, largura: PREVIA_LARGURA, altura: PREVIA_ALTURA };
  } finally {
    await fs.unlink(paginaHtml).catch(() => undefined);
  }
}

/**
 * Capturar o topo e compor a prévia, na ordem. O nome vem do DOC DO LEAD
 * (o mesmo da ficha); só na falta dele — o harness de skin, que não tem
 * lead — cai no título que a própria página declara. A linha de apoio é a
 * descrição da demo, escrita pelo `generateMetadata` da rota pública a
 * partir do lead: recalcular aqui deixaria a prévia dizendo uma coisa e a
 * página outra.
 */
async function gerarPrevia(page, paginaMoldura, alvo, tela) {
  const arquivoTopo = `${alvo.nome}-previa-topo.png`;
  const { identidade, paleta } = await capturarTopo(
    page,
    alvo,
    tela,
    path.join(SAIDA, arquivoTopo),
  );
  const nome = alvo.nomeNegocio?.trim() || identidade.titulo || alvo.nome;

  const composta = await comporPrevia(paginaMoldura, {
    arquivoTopo,
    largura: tela.largura,
    altura: tela.altura,
    // O CARIMBO no nome do arquivo é o que fura o cache da prévia do
    // WhatsApp: ele guarda a imagem pela URL, e uma rodada nova no mesmo
    // caminho continuaria servindo a antiga pra sempre.
    arquivo: `${alvo.nome}-previa-${CARIMBO}.jpg`,
    nome,
    apoio: identidade.descricao,
    endereco: alvo.enderecoPublico,
    paleta: paleta ?? undefined,
  });
  return { ...composta, nome };
}

async function main() {
  const { base, cookie, encerrar } = await subirServidor({ build: !temFlag("sem-build") });
  await fs.mkdir(SAIDA, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const reprovadas = [];
  // Manifesto: o que cada alvo de fato produziu. É o que o workflow lê pra
  // saber o que subir e o que gravar no doc do lead — derivar isso do nome
  // do arquivo depois seria adivinhação (id de lead pode conter hífen).
  const manifesto = new Map();
  let geradas = 0;
  let compostas = 0;

  // Uma página só pro compositor, num contexto SEM escala de dispositivo: a
  // composição é montada nas dimensões em pixel do PNG cru, e qualquer dpr
  // diferente de 1 reamostraria a captura.
  const ctxMoldura = await browser.newContext({ deviceScaleFactor: 1 });
  const paginaMoldura = await ctxMoldura.newPage();

  try {
    const alvos = await resolverAlvos(base, cookie);
    for (const alvo of alvos) {
      console.log(`\n== ${alvo.nome} (${alvo.skinId}) — ${alvo.ancoras.length} âncora(s)`);
      manifesto.set(alvo.nome, {
        alvo: alvo.nome,
        leadId: alvo.leadId,
        skinId: alvo.skinId,
        imagens: [],
        reprovadas: [],
      });
      for (const tela of telas) {
        const ctx = await browser.newContext({
          viewport: { width: tela.largura, height: tela.altura },
          deviceScaleFactor: tela.dpr,
        });
        // A rota /interno/* exige sessão; a demo pública NÃO — e é
        // deliberado não mandar cookie nenhum pra ela: com sessão (ou com o
        // marcador de dispositivo) a demo estampa o selo "Vendo como
        // membro" na página, e ele entraria na imagem que vai pro lead.
        if (alvo.url.includes("/interno/")) await ctx.addCookies([cookie]);
        const page = await ctx.newPage();

        for (const [i, ancora] of alvo.ancoras.entries()) {
          const arquivo = `${alvo.nome}-${String(i + 1).padStart(2, "0")}-${ancora}-${tela.id}.png`;
          const destino = path.join(SAIDA, arquivo);
          const r = await capturar(page, alvo, ancora, tela, destino);
          if (r.erro) {
            console.log(`  ✗ ${tela.id}/${ancora}: ${r.erro}`);
            reprovadas.push(`${alvo.nome}/${ancora}/${tela.id}: ${r.erro}`);
            manifesto.get(alvo.nome).reprovadas.push(`${ancora}/${tela.id}: ${r.erro}`);
            continue;
          }
          geradas += 1;
          const entradaImagem = {
            arquivo,
            caminhoLocal: destino,
            ancora,
            tela: tela.id,
            ordem: i + 1,
            largura: r.caixa.width,
            altura: r.caixa.height,
          };
          manifesto.get(alvo.nome).imagens.push(entradaImagem);

          // A composta é DERIVADA da crua: só existe se a crua saiu, e uma
          // falha aqui não invalida a imagem que já está no disco — a
          // ficha simplesmente não oferece a moldura daquela captura.
          const composta = await comporMoldura(paginaMoldura, {
            tela: tela.id,
            arquivo,
            // Em PIXEL, não em px de CSS. A caixa medida vem em px de CSS
            // (`getBoundingClientRect`), e o PNG do celular sai com o dobro
            // disso porque a captura é em dpr 2 — de propósito, pra imagem
            // vista NUM celular não chegar serrilhada. Montar a moldura na
            // medida de CSS encolheria a captura à metade dentro dela e
            // jogaria fora exatamente essa nitidez.
            largura: r.caixa.width * tela.dpr,
            altura: r.caixa.height * tela.dpr,
            endereco: alvo.enderecoPublico,
            paleta: r.paleta ?? undefined,
          }).catch((e) => ({ erro: e instanceof Error ? e.message : String(e) }));

          if (composta.erro) {
            reprovadas.push(`${alvo.nome}/${ancora}/${tela.id}: moldura não saiu (${composta.erro})`);
          } else {
            compostas += 1;
            entradaImagem.composta = composta;
          }

          const alerta = r.portao.coberto ? ` ✗ TÍTULO COBERTO por ${r.portao.porQuem}` : "";
          if (r.portao.coberto) {
            reprovadas.push(`${alvo.nome}/${ancora}/${tela.id}: título coberto (${r.portao.porQuem})`);
          }
          const semImagem = r.imagens.prontas < r.imagens.total;
          if (semImagem) {
            reprovadas.push(
              `${alvo.nome}/${ancora}/${tela.id}: ${r.imagens.total - r.imagens.prontas} imagem(ns) da seção não carregaram`,
            );
          }
          console.log(
            `  ${r.portao.coberto || semImagem ? "✗" : "ok"} ${tela.id}/${ancora}: ${r.caixa.width}×${r.caixa.height}` +
              ` (${(r.caixa.height / tela.altura).toFixed(1)} telas)` +
              ` · cromo oculto ${r.cromo.escondidos}` +
              ` · congeladas ${r.gelo.congeladas}/${r.gelo.infinitas} infinitas` +
              ` · imagens ${r.imagens.prontas}/${r.imagens.total}` +
              (r.presos.presos > 0 ? ` · vh preso em ${r.presos.presos}` : "") +
              (r.imagensForcadas.trilhos > 0 ? ` · ${r.imagensForcadas.trilhos} trilho(s)` : "") +
              (r.esticou ? " · ⚠ seção ainda cresceu" : "") +
              (r.texto.estavel ? "" : " · ⚠ texto ainda mudava") +
              ` · título "${r.portao.titulo ?? "—"}"${alerta}` +
              (entradaImagem.composta
                ? ` · moldura ${entradaImagem.composta.largura}×${entradaImagem.composta.altura}`
                : " · ✗ sem moldura"),
          );
        }

        // A PRÉVIA DO LINK sai do contexto de desktop, depois das âncoras:
        // é o único que já está na viewport de 1440×900 em dpr 1, que é o
        // enquadramento do topo do site. Uma tela só, e não uma por
        // âncora — a prévia é do site, não de uma seção.
        if (tela.id === "desktop") {
          const previa = await gerarPrevia(page, paginaMoldura, alvo, tela).catch((e) => ({
            erro: e instanceof Error ? e.message : String(e),
          }));
          if (previa.erro) {
            reprovadas.push(`${alvo.nome}/prévia: ${previa.erro}`);
            console.log(`  ✗ prévia do link: ${previa.erro}`);
          } else {
            manifesto.get(alvo.nome).previa = previa;
            console.log(`  ok prévia do link: ${previa.largura}×${previa.altura} · "${previa.nome}"`);
          }
        }

        await ctx.close();
      }
    }

    if (temFlag("subir")) await subirParaStorage([...manifesto.values()]);
  } finally {
    await ctxMoldura.close().catch(() => undefined);
    await browser.close();
    encerrar();
  }

  const arquivoManifesto = opcao("manifesto");
  if (arquivoManifesto) {
    await fs.mkdir(path.dirname(path.resolve(RAIZ, arquivoManifesto)), { recursive: true });
    await fs.writeFile(
      path.resolve(RAIZ, arquivoManifesto),
      JSON.stringify([...manifesto.values()], null, 2),
    );
    console.log(`manifesto em ${arquivoManifesto}`);
  }

  console.log(`\n${geradas} captura(s) em ${SAIDA} · ${compostas} com moldura`);
  if (!APP_PUBLIC_URL) {
    console.log(
      "  ⚠ APP_PUBLIC_URL não configurada: a moldura de navegador sai sem endereço (ver .env.example)",
    );
  }
  if (reprovadas.length > 0) {
    console.log(`\n✗ ${reprovadas.length} reprovada(s) no portão:`);
    for (const r of reprovadas) console.log(`   ${r}`);
    process.exitCode = 1;
  }
}

/**
 * Sobe as capturas pro Firebase Storage no caminho POR LEAD
 * (`capturas/{leadId}/{arquivo}`), na mesma convenção das imagens de demo:
 * públicas (a demo já é pública) e com cache imutável, que é seguro porque
 * cada rodada gera nome novo com timestamp.
 *
 * Recebe o MANIFESTO em memória em vez de varrer o diretório: o id do lead
 * sai do alvo que produziu a imagem, não de um `split("-")` no nome do
 * arquivo, que quebraria em qualquer id com hífen. Anota a `url` de volta
 * em cada entrada — é ela que o workflow grava no doc do lead.
 *
 * Sobe as DUAS versões de cada captura: a crua (que continua sendo a que
 * serve pra recortar e mandar detalhe) e a composta em moldura. Guardar só
 * uma obrigaria a escolher, no motor, o que só se sabe na hora de mandar a
 * mensagem.
 */
async function subirParaStorage(entradas) {
  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const { getStorage } = await import("firebase-admin/storage");
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error("FIREBASE_STORAGE_BUCKET não configurada (ver .env.example)");
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
      }),
    });
  }
  const bucket = getStorage().bucket(bucketName);

  /**
   * Um objeto. Marcado como ANEXO: é o que faz o "Baixar" da ficha salvar o
   * arquivo com nome bom em vez de abrir a imagem numa aba. A alternativa
   * seria baixar por fetch no cliente, que exigiria configurar CORS no
   * bucket — o objeto é público, mas sem CORS o `fetch` de outra origem é
   * bloqueado. Não atrapalha a miniatura: `<img src>` ignora
   * Content-Disposition.
   */
  const subir = async (caminho, caminhoLocal, contentType, { inline = false } = {}) => {
    await bucket.file(caminho).save(await fs.readFile(caminhoLocal), {
      contentType,
      resumable: false,
      public: true,
      metadata: {
        cacheControl: "public, max-age=31536000, immutable",
        contentDisposition: inline
          ? "inline"
          : `attachment; filename="${path.basename(caminho)}"`,
      },
    });
    // `?v=` é o que faz uma rodada nova aparecer: o objeto sobe com cache
    // imutável e o caminho é determinístico, então sem a versão o
    // "Refazer" trocaria o arquivo enquanto navegador e buscador de prévia
    // seguiriam servindo o antigo (ver CARIMBO).
    const url = `https://storage.googleapis.com/${bucketName}/${caminho}?v=${CARIMBO}`;
    console.log(`  ↑ ${url}`);
    return url;
  };

  for (const entrada of entradas) {
    const pasta = entrada.leadId ?? entrada.alvo;
    // Rodada nova substitui a anterior: sem isto o Storage acumularia uma
    // cópia por "refazer", e ninguém nunca olharia as velhas.
    await bucket.deleteFiles({ prefix: `capturas/${pasta}/`, force: true }).catch(() => undefined);
    for (const img of entrada.imagens) {
      img.url = await subir(`capturas/${pasta}/${img.arquivo}`, img.caminhoLocal, "image/png");
      if (img.composta) {
        img.composta.url = await subir(
          `capturas/${pasta}/${img.composta.arquivo}`,
          img.composta.caminhoLocal,
          "image/png",
        );
      }
    }
    // A prévia do link é servida ao BUSCADOR DE PRÉVIA, não baixada por
    // ninguém: `inline`, e não `attachment`, porque um `Content-Disposition`
    // de anexo faz parte dos clientes recusarem a imagem do cartão.
    if (entrada.previa) {
      entrada.previa.url = await subir(
        `capturas/${pasta}/${entrada.previa.arquivo}`,
        entrada.previa.caminhoLocal,
        "image/jpeg",
        { inline: true },
      );
    }
  }
}

await main();
