/**
 * ENQUADRAMENTO NO NAVEGADOR — a metade do assunto que roda DENTRO da
 * página da demo, compartilhada por quem precisa dela nos dois lados:
 *
 *   - a PRÉVIA da tela de marcação (/interno/capturas), que importa estas
 *     funções e as chama no `contentWindow` de um <iframe> de mesma origem;
 *   - o MOTOR de captura (scripts/capturas.mjs), que passa estas MESMAS
 *     funções para `page.evaluate` do Playwright.
 *
 * É `.mjs` justamente por isso: um `.ts` não seria importável pelo script
 * de laço, e uma cópia em cada lado divergiria no primeiro ajuste — a
 * prévia passaria a prometer um enquadramento que a captura não entrega.
 *
 * REGRA DE OURO DESTE ARQUIVO: toda função exportada é AUTOSSUFICIENTE —
 * não referencia nada de escopo de módulo. `page.evaluate` serializa a
 * função pelo código-fonte e a avalia noutro realm, onde imports e
 * constantes deste arquivo não existem. Helper compartilhado aqui vira
 * `ReferenceError` lá.
 *
 * Toda função recebe a JANELA ALVO como último parâmetro, com default
 * `window`. É o que permite os dois usos com o mesmo código: o Playwright
 * avalia a função DENTRO da página (o default já é a janela certa), e a
 * prévia chama do frame de fora passando o `contentWindow` do iframe — sem
 * isso as funções mexeriam no documento do painel em vez do da demo.
 */

/**
 * Prepara a página para medição/captura: percorre o documento até o fim e
 * volta ao topo, e só então espera fontes e imagens.
 *
 * A rolagem não é frescura. As skins revelam seção por seção com
 * `whileInView` (`once: true`) e as imagens entram por lazy-load — uma
 * seção que nunca passou pela viewport estaria transparente/deslocada, e
 * medir ou capturar ali pegaria o estado animado em vez do final. Espera
 * fonte DEPOIS da varredura porque é a varredura que traz para a página as
 * imagens (e com elas o resto do texto que ainda não tinha sido pedido).
 *
 * @param {{ alturaTela: number, quietoMs?: number }} opcoes
 * @param {Window} [win] janela alvo (default: a da própria página)
 * @returns {Promise<{ altura: number, imagens: number, imagensProntas: number }>}
 */
export async function prepararPagina({ alturaTela, quietoMs = 900 }, win = window) {
  const doc = win.document;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const passo = Math.max(200, Math.round(alturaTela * 0.8));

  for (let y = 0; y < doc.documentElement.scrollHeight; y += passo) {
    win.scrollTo(0, y);
    await espera(60);
  }
  win.scrollTo(0, 0);
  await espera(quietoMs);

  await doc.fonts.ready;

  // Imagem sem `complete` viraria buraco na captura; `decode()` garante
  // que ela também já foi rasterizada, não só baixada.
  const imgs = Array.from(doc.images);
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? (img.decode?.().catch(() => undefined) ?? Promise.resolve())
        : new Promise((r) => {
            img.addEventListener("load", r, { once: true });
            img.addEventListener("error", r, { once: true });
            setTimeout(r, 8000);
          }),
    ),
  );
  await espera(250);

  return {
    altura: doc.documentElement.scrollHeight,
    imagens: imgs.length,
    imagensProntas: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
  };
}

/**
 * Caixa da seção marcada, em coordenadas do DOCUMENTO. É daqui que sai o
 * enquadramento: a seção inteira, do início ao fim, porque o elemento
 * `[data-d-secao]` envolve a `<section>` completa (ver SecaoMarcada).
 *
 * @param {string} secaoId
 * @param {Window} [win] janela alvo (default: a da própria página)
 * @returns {{ topo: number, altura: number, largura: number, primeira: boolean, docAltura: number } | null}
 */
export function medirSecao(secaoId, win = window) {
  const doc = win.document;
  const todas = Array.from(doc.querySelectorAll("[data-d-secao]"));
  const el = todas.find((n) => n.getAttribute("data-d-secao") === secaoId);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    topo: Math.round(r.top + win.scrollY),
    altura: Math.round(r.height),
    largura: Math.round(r.width),
    // Primeira seção do documento = a abertura. É o único enquadramento em
    // que o cromo fixo (header, botão flutuante) PERTENCE à imagem.
    primeira: todas[0] === el,
    docAltura: doc.documentElement.scrollHeight,
  };
}

/**
 * Some com o cromo fixo que atravessaria o enquadramento.
 *
 * O motivo é o requisito de nunca cortar título: header e nav das skins
 * são `position: fixed`, então numa seção do MEIO da página eles pousariam
 * por cima do começo dela — exatamente onde mora o título. Na PRIMEIRA
 * seção não há o que esconder: ali o header é parte da abertura, é assim
 * que o visitante vê o site, e o hero já nasce com espaço reservado pra
 * ele.
 *
 * Fica de fora a DECORAÇÃO, que é parte do produto e não cobre título:
 * a camada de efeito de fundo (`[data-d-efeito-camada]`, cujos efeitos se
 * posicionam fixos por dentro) e o LED de borda (`[data-d-led-estilo]`).
 *
 * `visibility: hidden` em vez de `display: none` de propósito: não tira o
 * elemento do fluxo, então nada relayouta e a caixa medida antes continua
 * valendo depois.
 *
 * @param {string} secaoId
 * @param {Window} [win] janela alvo (default: a da própria página)
 * @returns {{ escondidos: number, primeira: boolean }}
 */
export function neutralizarCromo(secaoId, win = window) {
  const doc = win.document;
  const todas = Array.from(doc.querySelectorAll("[data-d-secao]"));
  const el = todas.find((n) => n.getAttribute("data-d-secao") === secaoId);
  const primeira = todas.length > 0 && todas[0] === el;
  if (primeira) return { escondidos: 0, primeira: true };

  let escondidos = 0;
  for (const node of Array.from(doc.body.querySelectorAll("*"))) {
    const pos = win.getComputedStyle(node).position;
    if (pos !== "fixed" && pos !== "sticky") continue;
    if (node.closest("[data-d-efeito-camada], [data-d-led-estilo]")) continue;
    // Grudado DENTRO da própria seção é conteúdo, não cromo: a sidebar de
    // Serviços da barbearia é `position: sticky` por dentro, e escondê-la
    // deixava metade do enquadramento vazio (foi o que a captura desta
    // tela mostrou). Ancestral que envolve a seção também fica — apagá-lo
    // apagaria a seção junto.
    if (el && (el.contains(node) || node.contains(el))) continue;
    // Um fixo dentro de outro fixo já some junto com o pai.
    if (node.parentElement?.closest("[data-d-captura-oculto]")) continue;
    node.setAttribute("data-d-captura-oculto", "1");
    node.style.visibility = "hidden";
    escondidos += 1;
  }
  return { escondidos, primeira: false };
}

/**
 * O PORTÃO do enquadramento: algum elemento fixo/sticky ainda cobre o
 * primeiro título da seção?
 *
 * É a checagem que transforma "nunca cortando título" de intenção em
 * medida. Roda DEPOIS de `neutralizarCromo` e reprova a captura se sobrou
 * qualquer coisa por cima do título — um cromo novo numa skin futura
 * aparece aqui, não na conversa com o lead.
 *
 * @param {string} secaoId
 * @param {Window} [win] janela alvo (default: a da própria página)
 * @returns {{ titulo: string | null, coberto: boolean, porQuem: string | null }}
 */
export function tituloCoberto(secaoId, win = window) {
  const doc = win.document;
  const todas = Array.from(doc.querySelectorAll("[data-d-secao]"));
  const secao = todas.find((n) => n.getAttribute("data-d-secao") === secaoId);
  if (!secao) return { titulo: null, coberto: false, porQuem: null };

  const titulo = secao.querySelector("h1, h2, h3");
  if (!titulo) return { titulo: null, coberto: false, porQuem: null };
  const alvo = titulo.getBoundingClientRect();
  if (alvo.width === 0 || alvo.height === 0) {
    return { titulo: titulo.textContent?.trim().slice(0, 40) ?? "", coberto: false, porQuem: null };
  }

  for (const node of Array.from(doc.body.querySelectorAll("*"))) {
    const estilo = win.getComputedStyle(node);
    if (estilo.position !== "fixed" && estilo.position !== "sticky") continue;
    if (estilo.visibility === "hidden" || estilo.display === "none") continue;
    // Decoração translúcida por cima é parte do visual, não corte de título.
    if (node.closest("[data-d-efeito-camada], [data-d-led-estilo]")) continue;
    if (estilo.pointerEvents === "none" && Number(estilo.opacity) < 0.5) continue;
    if (secao.contains(node)) continue;

    const r = node.getBoundingClientRect();
    const cruza =
      r.left < alvo.right && r.right > alvo.left && r.top < alvo.bottom && r.bottom > alvo.top;
    if (cruza) {
      return {
        titulo: titulo.textContent?.trim().slice(0, 40) ?? "",
        coberto: true,
        porQuem: `${node.tagName.toLowerCase()}${node.className ? `.${String(node.className).split(" ")[0]}` : ""}`,
      };
    }
  }
  return { titulo: titulo.textContent?.trim().slice(0, 40) ?? "", coberto: false, porQuem: null };
}
