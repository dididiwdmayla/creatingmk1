/**
 * MOLDURAS DAS CAPTURAS — a segunda versão de cada print, aquela em que a
 * imagem finalmente se lê como "um site num aparelho".
 *
 * A captura crua é conteúdo puro: começa e termina no pixel da seção, sem
 * nada em volta. Numa conversa de prospecção ela parece um recorte de
 * imagem qualquer. A composta põe a captura de celular dentro de um
 * APARELHO desenhado e a de desktop dentro de um NAVEGADOR desenhado — as
 * duas ficam guardadas, porque a crua ainda é a que serve pra recortar,
 * montar carrossel e mandar detalhe.
 *
 * QUEM DESENHA É O PRÓPRIO CHROMIUM que o motor já tem aberto: este módulo
 * monta uma página HTML com a captura dentro da moldura, e "compor" é tirar
 * um screenshot dela. Nenhuma dependência de rasterização entra no projeto
 * por causa disto, e a moldura vira código de layout — verificável em teste
 * e olhável em captura, como o resto da feature.
 *
 * A composição é montada em dpr 1 nas DIMENSÕES EM PIXEL do PNG cru, então
 * a captura entra 1:1: não há reamostragem e o texto da demo chega na
 * moldura com a mesma nitidez com que saiu do motor.
 *
 * `.mjs` pelo mesmo motivo de `dom.mjs` e `padrao.mjs`: `scripts/capturas.mjs`
 * não compila TypeScript.
 */

/** Sufixo do arquivo composto, ao lado do cru (ver `nomeComposto`). */
export const MOLDURA_SUFIXO = "-moldura";

/** Fundo de emergência quando a paleta da demo não pôde ser lida. */
const PALETA_RESERVA = {
  fundo: "#111318",
  fundoAlt: "#171a20",
  fundoElevado: "#1f232b",
  destaque: "#6b7280",
};

/**
 * @typedef {object} PaletaDemo
 * @property {string} fundo
 * @property {string} [fundoAlt]
 * @property {string} [fundoElevado]
 * @property {string} [destaque]
 * @property {string} [texto]
 */

/**
 * As medidas saem DISCRIMINADAS por tela (o campo `tela` volta no
 * resultado): as duas molduras não têm as mesmas partes, e um retorno
 * único com `barra: 0` no celular seria um número mentiroso circulando.
 *
 * `modo` decide o FORMATO inteiro do corpo (ver `corpoAparelho`/`corpoFatiado`
 * abaixo): "aparelho" tem um campo só (`alturaVisivel`/`folga`); "fatiado"
 * tem uma LISTA de quadros (`numFatias`/`umaTela`/`gap`) e nenhum dos dois
 * conjuntos de campos aparece no modo errado.
 *
 * @typedef {object} MedidasCelularAparelho
 * @property {"celular"} tela
 * @property {"aparelho"} modo
 * @property {number} largura composição inteira, com a margem de fundo
 * @property {number} altura
 * @property {number} margem
 * @property {number} borda espessura da moldura
 * @property {number} raio raio dos cantos da tela
 * @property {number} alturaVisivel altura da tela na composição
 * @property {boolean} cortada sempre `false`: a seção cabe inteira num aparelho
 * @property {number} folga sobra de tela preenchida com o fundo da demo
 *
 * @typedef {object} MedidasCelularFatiado
 * @property {"celular"} tela
 * @property {"fatiado"} modo
 * @property {number} largura composição inteira (deitada), com a margem de fundo
 * @property {number} altura
 * @property {number} margem
 * @property {number} borda espessura da moldura de CADA quadro
 * @property {number} raio raio dos cantos de CADA quadro
 * @property {number} gap espaço entre um quadro e o próximo
 * @property {number} umaTela altura de uma tela de aparelho, em pixel
 * @property {number} numFatias quantos quadros saem (1 a 3)
 * @property {boolean} cortada a seção tem mais de 3 telas — só as 3 primeiras saem
 *
 * @typedef {MedidasCelularAparelho | MedidasCelularFatiado} MedidasCelular
 *
 * @typedef {object} MedidasDesktop
 * @property {"desktop"} tela
 * @property {number} largura
 * @property {number} altura
 * @property {number} margem
 * @property {number} barra altura da barra do navegador
 * @property {number} raio
 * @property {number} ponto diâmetro dos três círculos
 * @property {number} pastilha altura do campo de endereço
 * @property {number} fonte
 */

/**
 * `hero-celular.png` → `hero-celular-moldura.png`.
 * @param {string} arquivo
 * @returns {string}
 */
export function nomeComposto(arquivo) {
  return arquivo.replace(/\.png$/i, `${MOLDURA_SUFIXO}.png`);
}

/**
 * Luminância relativa (0..1) de uma cor CSS em `#rgb`, `#rrggbb` ou
 * `rgb()/rgba()` — que é como `getComputedStyle` devolve as variáveis da
 * demo. Serve para UMA decisão só: se o cromo da moldura sai claro ou
 * escuro. Uma janela de navegador clara sobre uma demo clara (ou escura
 * sobre a tatuagem, que é quase preta) desaparece no fundo, e aí a moldura
 * deixa de ser moldura.
 *
 * Cor que não dá pra ler devolve `null` — quem chama decide, em vez de
 * receber um preto silencioso.
 *
 * @param {string | undefined} cor
 * @returns {number | null}
 */
export function luminancia(cor) {
  if (typeof cor !== "string") return null;
  const texto = cor.trim().toLowerCase();
  let rgb = null;

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(texto);
  if (hex) {
    const d = hex[1];
    const largo = d.length === 3 ? [...d].map((c) => c + c) : [d.slice(0, 2), d.slice(2, 4), d.slice(4, 6)];
    rgb = largo.map((p) => parseInt(p, 16));
  }
  const func = /^rgba?\(([^)]+)\)$/.exec(texto);
  if (func) {
    const partes = func[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
    if (partes.length === 3 && partes.every(Number.isFinite)) rgb = partes;
  }
  if (!rgb) return null;

  // Mesma curva sRGB de lib/demos/barra/srgb.ts, reescrita aqui porque
  // aquele módulo é TypeScript e este arquivo é lido por um script `.mjs`.
  const linear = rgb.map((v) => {
    const c = Math.min(255, Math.max(0, v)) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/**
 * O fundo desta composição é claro? (decide o cromo, ver `luminancia`)
 * @param {PaletaDemo | undefined} paleta
 * @returns {boolean}
 */
export function fundoClaro(paleta) {
  const l = luminancia(paleta?.fundoAlt) ?? luminancia(paleta?.fundo);
  return l !== null && l > 0.45;
}

/**
 * Proporção de tela de aparelho, de reserva: 19,5:9, a de qualquer celular
 * atual. Só entra quando quem chama não informa a altura da tela — o motor
 * informa, e a viewport dele (390×844) JÁ É a proporção de um aparelho de
 * verdade.
 */
export const PROPORCAO_APARELHO = 19.5 / 9;

/** Folga de arredondamento ao comparar a captura com uma tela cheia. */
const TOLERANCIA_UMA_TELA = 8;

/** Quantas telas, no máximo, uma seção fatiada mostra — ver `medidasMoldura`. */
export const FATIAS_MAX = 3;

/**
 * Medidas da composição.
 *
 * **A moldura de aparelho tem SEMPRE proporção de aparelho real.** Antes
 * ela esticava para caber a seção inteira, e uma seção de três telas virava
 * um celular de 1:4 — proporção que não existe, e que denuncia a montagem
 * na hora. A altura de uma tela não é inventada aqui: vem do motor, cuja
 * viewport de celular (390×844, dpr 2) já é a de um aparelho de verdade.
 *
 * Captura mais alta que uma tela não cabe num aparelho único, então ela é
 * **fatiada**: uma tela por quadro, cada quadro num aparelho de proporção
 * real, lado a lado, na ordem de leitura (a imagem final fica deitada). O
 * cartão alongado sem chrome — que existiu antes — não existe mais: ele
 * prometia "site num celular" com uma proporção que nenhum aparelho tem, e
 * fatiar em telas reais resolve isso sem cortar a seção pela metade (o
 * defeito que a moldura de aparelho esticada tinha). No máximo `FATIAS_MAX`
 * quadros — seção maior que isso mostra só as primeiras telas, na ordem em
 * que a página é lida. Ver "Moldura de celular" em ARCHITECTURE.md.
 *
 * @param {{
 *   tela: "celular" | "desktop",
 *   largura: number,
 *   altura: number,
 *   alturaTela?: number,
 * }} captura
 * @returns {MedidasCelular | MedidasDesktop}
 */
export function medidasMoldura({ tela, largura, altura, alturaTela }) {
  if (tela === "celular") {
    const umaTela = Math.round(alturaTela ?? largura * PROPORCAO_APARELHO);
    const cabeNumaTela = altura <= umaTela + TOLERANCIA_UMA_TELA;
    const margem = Math.round(largura * 0.07);

    if (cabeNumaTela) {
      // No aparelho a tela tem SEMPRE uma tela de altura, mesmo que a seção
      // seja mais curta: uma seção de 0,6 tela numa moldura de 0,6 tela
      // vira um celular atarracado (1:1,5), a mesma proporção impossível do
      // celular esticado, só do outro lado. A sobra é preenchida com o
      // fundo da PRÓPRIA demo — o que um aparelho de verdade mostraria
      // acima e abaixo de uma seção curta, porque a página continua.
      const borda = Math.max(2, Math.round(largura * 0.013));
      const raio = Math.round(largura * 0.092);
      return {
        tela: "celular",
        modo: "aparelho",
        largura: largura + 2 * (borda + margem),
        altura: umaTela + 2 * (borda + margem),
        margem,
        borda,
        raio,
        alturaVisivel: umaTela,
        cortada: false,
        folga: Math.max(0, umaTela - altura),
      };
    }

    // FATIADO: uma tela por quadro, cada quadro no MESMO desenho de
    // aparelho do modo acima (a "proporção real" pedida) — só o corpo é
    // diferente (uma fileira de quadros em vez de um só). O raio/borda são
    // os do aparelho: canto bem arredondado é o que lê como aparelho.
    const borda = Math.max(2, Math.round(largura * 0.013));
    const raio = Math.round(largura * 0.092);
    const gap = Math.round(largura * 0.05);
    const numFatias = Math.min(FATIAS_MAX, Math.ceil(altura / umaTela));
    const quadroLargura = largura + 2 * borda;
    const quadroAltura = umaTela + 2 * borda;

    return {
      tela: "celular",
      modo: "fatiado",
      largura: numFatias * quadroLargura + (numFatias - 1) * gap + 2 * margem,
      altura: quadroAltura + 2 * margem,
      margem,
      borda,
      raio,
      gap,
      umaTela,
      numFatias,
      // A seção tem mais telas do que o teto mostra: as fatias além da
      // terceira ficam de fora, na mesma lógica de "mostra as 3 primeiras".
      cortada: altura > numFatias * umaTela,
    };
  }

  const barra = Math.round(largura * 0.034);
  const margem = Math.round(largura * 0.038);
  return {
    tela: "desktop",
    largura: largura + 2 * margem,
    altura: altura + barra + 2 * margem,
    margem,
    barra,
    raio: Math.round(largura * 0.011),
    ponto: Math.round(largura * 0.0092),
    pastilha: Math.round(barra * 0.62),
    fonte: Math.round(barra * 0.36),
  };
}

/**
 * Escape de HTML. Exportado porque a prévia do link (./previa.mjs) monta a
 * própria página com o NOME DO NEGÓCIO dentro — texto de terceiro, que
 * nunca pode virar marcação.
 *
 * @param {string} texto
 * @returns {string}
 */
export function escapar(texto) {
  return String(texto).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

/**
 * Fundo da composição: a paleta da PRÓPRIA demo, nunca uma cor da
 * plataforma. Compartilhado com a prévia do link, que é composta sobre o
 * mesmo fundo pelo mesmo motivo.
 *
 * @param {PaletaDemo | undefined} paleta
 * @returns {string} bloco CSS de `background`
 */
export function fundoDaComposicao(paleta) {
  const p = { ...PALETA_RESERVA, ...(paleta ?? {}) };
  return `
    background:
      radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, ${p.destaque} 16%, ${p.fundoElevado}) 0%, transparent 60%),
      linear-gradient(168deg, ${p.fundoAlt} 0%, ${p.fundo} 55%, color-mix(in srgb, ${p.fundo} 82%, black) 100%);
  `;
}

/**
 * A página da composição. `src` é o caminho da captura crua RELATIVO ao
 * HTML (os dois são escritos no mesmo diretório e abertos por `file://`) —
 * embutir um PNG de vários MB como `data:` URI custaria uma string base64
 * de tamanho equivalente a cada imagem, sem ganho nenhum.
 *
 * `endereco` só existe na moldura de navegador, e SÓ quando se sabe qual é
 * o endereço real da demo (ver APP_PUBLIC_URL). Vazio, a pastilha sai vazia:
 * uma janela sem endereço é honesta, um domínio inventado não.
 *
 * `alturaTela` é a altura de UMA tela do aparelho, em pixel — é o que
 * decide se a captura ganha moldura de aparelho único ou fatiada (ver
 * `medidasMoldura`). Quem chama sabe: é a viewport do motor.
 *
 * @param {{
 *   tela: "celular" | "desktop",
 *   src: string,
 *   largura: number,
 *   altura: number,
 *   alturaTela?: number,
 *   endereco?: string,
 *   paleta?: PaletaDemo,
 * }} composicao
 * @returns {string}
 */
export function htmlMoldura({ tela, src, largura, altura, alturaTela, endereco, paleta }) {
  const m = medidasMoldura({ tela, largura, altura, alturaTela });
  const corpo =
    m.tela === "celular"
      ? m.modo === "aparelho"
        ? corpoAparelho(m, src, largura, altura, paleta, fundoClaro(paleta))
        : corpoFatiado(m, src, largura, altura, paleta, fundoClaro(paleta))
      : molduraNavegador(m, src, endereco, fundoClaro(paleta));

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${m.largura}px; height: ${m.altura}px; }
  body {
    display: flex; align-items: center; justify-content: center;
    ${fundoDaComposicao(paleta)}
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "DejaVu Sans", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .captura { display: block; width: ${largura}px; height: ${altura}px; }
</style></head>
<body>${corpo}</body></html>`;
}

/**
 * O CORPO do aparelho, sem o que está dentro (a tela) — moldura fina, canto
 * bem arredondado, sombra fraca. Compartilhado por `corpoAparelho` (um
 * quadro) e `corpoFatiado` (vários lado a lado): a MESMA moldura, só o que
 * está dentro da tela muda.
 *
 * O que saiu, e por quê: o corpo grafite com gradiente (era brilho de
 * fotografia de produto), a ilha e a faixa de status (entalhe desenhado é
 * enfeite, e a faixa ainda empurrava a captura pra baixo), os botões
 * laterais. Sem barra de endereço em canto nenhum — isto não é um
 * navegador, e quem recebe a foto não precisa ler URL aqui. O objetivo é
 * ler como "site num celular", não como retrato de um aparelho.
 *
 * @param {{ raio: number, borda: number, margem: number }} m
 * @param {number} larguraQuadro
 * @param {number} alturaQuadro altura da TELA (sem a moldura)
 * @param {string} miolo o conteúdo da tela, já pronto (HTML)
 * @param {boolean} claro
 * @returns {string}
 */
function quadroAparelho(m, larguraQuadro, alturaQuadro, miolo, claro) {
  const aro = claro ? "rgba(0,0,0,.22)" : "rgba(255,255,255,.14)";
  return `
  <div style="
    flex: none;
    width: ${larguraQuadro + 2 * m.borda}px; height: ${alturaQuadro + 2 * m.borda}px;
    border-radius: ${m.raio + m.borda}px;
    padding: ${m.borda}px;
    background: #15171b;
    box-shadow:
      0 0 0 1px ${aro},
      0 ${Math.round(m.margem * 0.35)}px ${Math.round(m.margem * 1.1)}px rgba(0,0,0,.38);
  ">${miolo}</div>`;
}

/**
 * APARELHO — um quadro só, a seção inteira dentro (ela cabe numa tela, que
 * é a definição do modo).
 *
 * @param {MedidasCelularAparelho} m
 * @param {string} src
 * @param {number} largura largura do PNG cru
 * @param {number} altura altura do PNG cru
 * @param {PaletaDemo | undefined} paleta
 * @param {boolean} claro
 * @returns {string}
 */
function corpoAparelho(m, src, largura, altura, paleta, claro) {
  // A sobra da tela é o FUNDO DA DEMO, não preto: preto viraria tarja de
  // letterbox, e o que se quer é a página continuando fora da seção.
  const fundoTela = paleta?.fundo || "#000";
  const miolo = `
    <!-- A captura nunca é REDUZIDA para caber: reduzir encolheria o texto
         da demo, que é o que a imagem existe pra mostrar. Ela cabe inteira
         por definição (é o que define o modo) e é centrada na tela. -->
    <div style="
      overflow: hidden;
      width: ${largura}px; height: ${m.alturaVisivel}px;
      border-radius: ${m.raio}px;
      background: ${fundoTela};
      display: flex; align-items: center; justify-content: center;
    ">
      <img class="captura" src="${escapar(src)}" alt="">
    </div>`;
  return quadroAparelho(m, largura, m.alturaVisivel, miolo, claro);
}

/**
 * FATIADO — seção mais alta que uma tela. Um quadro por tela, no máximo
 * `FATIAS_MAX`, lado a lado na ordem de leitura (a primeira tela da seção
 * fica à esquerda). Cada quadro é uma JANELA fixa (uma tela de altura,
 * `overflow: hidden`) sobre a MESMA captura crua, deslocada verticalmente
 * pelo `top` negativo — é a técnica de sprite-sheet: uma imagem só, N
 * recortes dela, sem duplicar arquivo nem recompor nada por fatia.
 *
 * Se a seção não fecha um número inteiro de telas, a ÚLTIMA janela mostra
 * menos conteúdo que as outras — o resto da janela, abaixo do fim da
 * imagem, sai com o fundo da própria demo por trás (mesma lógica da folga
 * do aparelho de seção curta): a imagem deslocada simplesmente não cobre
 * aquele pedaço, e o `overflow: hidden` do lado de fora dela não entra em
 * jogo — quem preenche é o fundo posto atrás da imagem, dentro da mesma
 * janela.
 *
 * @param {MedidasCelularFatiado} m
 * @param {string} src
 * @param {number} largura largura do PNG cru
 * @param {number} altura altura do PNG cru
 * @param {PaletaDemo | undefined} paleta
 * @param {boolean} claro
 * @returns {string}
 */
function corpoFatiado(m, src, largura, altura, paleta, claro) {
  const fundoTela = paleta?.fundo || "#000";
  const quadros = [];
  for (let i = 0; i < m.numFatias; i += 1) {
    const miolo = `
      <div style="
        overflow: hidden; position: relative;
        width: ${largura}px; height: ${m.umaTela}px;
        border-radius: ${m.raio}px;
        background: ${fundoTela};
      ">
        <img class="captura" src="${escapar(src)}" alt="" style="
          position: absolute; top: ${-i * m.umaTela}px; left: 0;
          width: ${largura}px; height: ${altura}px; display: block;
        ">
      </div>`;
    quadros.push(quadroAparelho(m, largura, m.umaTela, miolo, claro));
  }
  return `<div style="display: flex; align-items: flex-start; gap: ${m.gap}px;">${quadros.join("")}</div>`;
}

/**
 * NAVEGADOR. O endereço é o da demo de verdade — o mesmo link que o lead
 * vai receber. Sem `APP_PUBLIC_URL` configurada (ou no harness de skin, que
 * não tem lead), a pastilha sai VAZIA em vez de com um domínio inventado.
 *
 * Exportada porque a prévia do link reaproveita ESTA janela, reduzida:
 * duas implementações de cromo de navegador divergiriam no primeiro
 * ajuste, e aí a moldura da galeria e a do cartão de conversa passariam a
 * mostrar navegadores diferentes do mesmo site.
 *
 * @param {MedidasDesktop} m
 * @param {string} src
 * @param {string | undefined} endereco
 * @param {boolean} claro
 * @returns {string}
 */
export function molduraNavegador(m, src, endereco, claro) {
  const cromo = claro
    ? { fundo: "#e9ebee", borda: "rgba(0,0,0,.10)", pastilha: "#ffffff", texto: "#3c4043", suave: "#80868b" }
    : { fundo: "#24272c", borda: "rgba(255,255,255,.10)", pastilha: "#15171a", texto: "#e3e6ea", suave: "#9aa0a6" };
  const largura = m.largura - 2 * m.margem;
  const url = enderecoExibido(endereco);

  return `
  <div style="
    width: ${largura}px; height: ${m.altura - 2 * m.margem}px;
    border-radius: ${m.raio}px; overflow: hidden;
    box-shadow:
      0 0 0 1px ${cromo.borda},
      0 ${Math.round(m.margem * 0.4)}px ${Math.round(m.margem * 1.5)}px rgba(0,0,0,.45);
  ">
    <div style="
      height:${m.barra}px; display:flex; align-items:center; gap:${Math.round(m.ponto * 0.8)}px;
      padding: 0 ${Math.round(m.barra * 0.4)}px; background:${cromo.fundo};
      border-bottom: 1px solid ${cromo.borda};
    ">
      <span style="width:${m.ponto}px;height:${m.ponto}px;border-radius:50%;background:#ff5f57;flex:none;"></span>
      <span style="width:${m.ponto}px;height:${m.ponto}px;border-radius:50%;background:#febc2e;flex:none;"></span>
      <span style="width:${m.ponto}px;height:${m.ponto}px;border-radius:50%;background:#28c840;flex:none;"></span>
      <div style="
        margin-left:${Math.round(m.barra * 0.5)}px; flex:1; max-width:${Math.round(largura * 0.62)}px;
        height:${m.pastilha}px; border-radius:${m.pastilha}px; background:${cromo.pastilha};
        border:1px solid ${cromo.borda};
        display:flex; align-items:center; gap:${Math.round(m.fonte * 0.45)}px;
        padding: 0 ${Math.round(m.pastilha * 0.42)}px;
        font-size:${m.fonte}px; color:${cromo.texto}; white-space:nowrap; overflow:hidden;
      ">
        ${url ? cadeado(m.fonte, cromo.suave) : ""}
        <span style="overflow:hidden; text-overflow:ellipsis;">${
          url ? `<span style="color:${cromo.suave}">${escapar(url.antes)}</span>${escapar(url.host)}<span style="color:${cromo.suave}">${escapar(url.depois)}</span>` : ""
        }</span>
      </div>
    </div>
    <img class="captura" src="${escapar(src)}" alt="">
  </div>`;
}

function cadeado(tamanho, cor) {
  const t = Math.round(tamanho * 0.85);
  return `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round" style="flex:none;">
    <rect x="4" y="10" width="16" height="11" rx="2.5"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg>`;
}

/**
 * O endereço como um navegador o mostra: esquema apagado, host em
 * destaque, caminho apagado. Endereço ausente ou impossível de ler devolve
 * `null` — e a pastilha fica vazia.
 *
 * @param {string | undefined} endereco
 * @returns {{ antes: string, host: string, depois: string } | null}
 */
export function enderecoExibido(endereco) {
  if (typeof endereco !== "string" || endereco.trim() === "") return null;
  try {
    const u = new URL(endereco);
    return { antes: u.protocol === "http:" ? "http://" : "", host: u.host, depois: `${u.pathname}${u.search}` };
  } catch {
    return null;
  }
}
