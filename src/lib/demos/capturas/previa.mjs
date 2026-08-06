/**
 * IMAGEM DE PRÉVIA DO LINK — o cartão que aparece quando alguém cola o
 * endereço da demo numa conversa (o `og:image` de `/demo/{leadId}`).
 *
 * Três restrições mandam no desenho, e todas vêm de FORA do nosso código:
 *
 *   1. O buscador de prévia do WhatsApp **não executa JavaScript** e
 *      desiste depressa. A imagem tem que existir pronta num arquivo, num
 *      endereço direto — nada que dependa do app renderizar nada na hora.
 *      Por isso ela é gerada junto com as capturas e servida do Storage.
 *   2. O cartão de conversa é pequeno: a imagem chega com uns 340px de
 *      largura num celular. **O nome do negócio é TEXTO desta composição,
 *      não pixel do print** — o nome dentro do screenshot vira borrão
 *      nessa escala, e "o nome legível em miniatura" é o ponto todo.
 *   3. É deitada (1200×630, a proporção que as prévias usam) e mostra o
 *      TOPO do site, que é a parte que apresenta o negócio.
 *
 * A janela de navegador é a MESMA de `moldura.mjs`, reduzida — duas
 * implementações de cromo divergiriam no primeiro ajuste.
 */

import {
  escapar,
  fundoClaro,
  fundoDaComposicao,
  medidasMoldura,
  molduraNavegador,
} from "./moldura.mjs";

/** Proporção do cartão de prévia (a que WhatsApp, Telegram e afins usam). */
export const PREVIA_LARGURA = 1200;
export const PREVIA_ALTURA = 630;

/** Onde a coluna de texto termina e a janela começa. */
const COLUNA_TEXTO = 0.47;
/**
 * Redução da janela. Escolhida pra ela SANGRAR pela direita: um site
 * inteirinho e centralizado vira selo pequeno no meio do cartão, enquanto
 * a janela cortada continua se lendo como janela e deixa o topo do site
 * grande o bastante pra reconhecer.
 */
const ESCALA_JANELA = 0.52;

/**
 * Corpo de texto da prévia, com o tamanho do nome escolhido pelo
 * comprimento dele. O piso é alto de propósito: abaixo de ~46px o nome
 * deixa de se ler no tamanho em que o cartão aparece na conversa, e aí a
 * imagem perde a única coisa que ela precisa entregar.
 *
 * @param {string} nome
 * @returns {number} tamanho em px na composição de 1200×630
 */
export function tamanhoDoNome(nome) {
  const n = String(nome ?? "").trim().length;
  if (n <= 14) return 78;
  if (n <= 22) return 66;
  if (n <= 34) return 54;
  return 46;
}

/**
 * Linha de apoio: a descrição da própria demo, cortada no limite em que
 * ainda cabe em duas linhas ao lado do nome. Corta em espaço, nunca no
 * meio da palavra, e só põe reticências quando de fato sobrou texto.
 *
 * @param {string | undefined} texto
 * @param {number} [limite]
 * @returns {string | undefined}
 */
export function apoioCurto(texto, limite = 96) {
  const limpo = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (limpo === "") return undefined;
  if (limpo.length <= limite) return limpo;
  const corte = limpo.slice(0, limite);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > limite * 0.6 ? corte.slice(0, espaco) : corte).trimEnd()}…`;
}

/**
 * A página da prévia. `src` é o caminho, relativo a este HTML, da captura
 * do TOPO do site (1440×900, viewport de desktop sem rolagem) — mesma
 * convenção de `htmlMoldura`, pelo mesmo motivo.
 *
 * @param {{
 *   src: string,
 *   largura: number,
 *   altura: number,
 *   nome: string,
 *   apoio?: string,
 *   endereco?: string,
 *   paleta?: import("./moldura.mjs").PaletaDemo,
 * }} previa
 * @returns {string}
 */
export function htmlPrevia({ src, largura, altura, nome, apoio, endereco, paleta }) {
  const m = medidasMoldura({ tela: "desktop", largura, altura });
  if (m.tela !== "desktop") throw new Error("medidas de desktop esperadas");

  const texto = paleta?.texto || "#f4f5f7";
  const larguraTexto = Math.round(PREVIA_LARGURA * COLUNA_TEXTO);
  const tamanho = tamanhoDoNome(nome);
  const janela = { largura: m.largura - 2 * m.margem, altura: m.altura - 2 * m.margem };
  const linha = apoioCurto(apoio);

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${PREVIA_LARGURA}px; height: ${PREVIA_ALTURA}px; overflow: hidden; }
  body {
    display: flex; align-items: stretch;
    ${fundoDaComposicao(paleta)}
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "DejaVu Sans", sans-serif;
    -webkit-font-smoothing: antialiased; color: ${texto};
  }
  .texto {
    width: ${larguraTexto}px; flex: none;
    display: flex; flex-direction: column; justify-content: center;
    padding: 56px 40px 56px 64px;
  }
  /* O nome quebra em até três linhas antes de encolher: encolher é o
     último recurso, porque é ele que custa legibilidade na miniatura. */
  .nome {
    font-size: ${tamanho}px; font-weight: 700; line-height: 1.06;
    letter-spacing: -0.02em; overflow-wrap: anywhere;
  }
  .apoio {
    margin-top: 22px; font-size: 25px; line-height: 1.35; font-weight: 400;
    opacity: .72;
  }
  /* A janela sangra pela direita e pela base: o recorte é intencional (ver
     ESCALA_JANELA), e sem o overflow oculto ela empurraria o layout. */
  .janela { flex: 1; position: relative; overflow: hidden; }
  .janela > div {
    position: absolute; top: ${Math.round((PREVIA_ALTURA - janela.altura * ESCALA_JANELA) / 2)}px; left: 0;
    width: ${janela.largura}px; height: ${janela.altura}px;
    transform: scale(${ESCALA_JANELA}); transform-origin: top left;
  }
  .captura { display: block; width: ${largura}px; height: ${altura}px; }
</style></head>
<body>
  <div class="texto">
    <div class="nome">${escapar(nome)}</div>
    ${linha ? `<div class="apoio">${escapar(linha)}</div>` : ""}
  </div>
  <div class="janela"><div>${molduraNavegador(m, src, endereco, fundoClaro(paleta))}</div></div>
</body></html>`;
}
