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
 * `behavior: "instant"` em CADA passo, pelo mesmo motivo que `rolarAteSecao`
 * documenta — e aqui o estrago era maior. `imobiliaria` e `multimarcas`
 * declaram `html { scroll-behavior: smooth }` (nav de âncora), então um
 * `scrollTo` sem `behavior` ANIMA: cada passo do laço reiniciava a animação
 * do passo anterior, a varredura mal saía do topo e o `scrollTo(0, 0)` do
 * fim cancelava o resto. Medido nas duas skins: tudo abaixo das primeiras
 * telas ficava em `opacity: 0; translateY(56px)` — a revelação por entrada
 * na viewport nunca disparava, e a seção capturada saía com buracos (e as
 * vizinhas, em branco, na prévia de enquadramento de /interno/capturas, que
 * chama esta MESMA função dentro do iframe).
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
    win.scrollTo({ top: y, behavior: "instant" });
    await espera(60);
  }
  win.scrollTo({ top: 0, behavior: "instant" });
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
 * FORÇA todas as seções ao estado REVELADO — a garantia de que nenhuma
 * parte da página entra na foto ainda transparente ou deslocada.
 *
 * A varredura de `prepararPagina` DISPARA as revelações; esta função
 * garante o RESULTADO delas, que é coisa diferente. Uma revelação depende
 * de IntersectionObserver e de uma animação de até 0,75s, e o motor mexe na
 * viewport entre um passo e outro (cresce pra caber a seção alta): basta a
 * foto sair no meio desse caminho pra a imagem que vai pro lead ter um
 * pedaço apagado. Aqui o estado final é IMPOSTO, não esperado.
 *
 * SÓ NO CONTEXTO DE CAPTURA. Isto roda por `page.evaluate` (e no
 * `contentWindow` do iframe da prévia de marcação); nenhuma linha da demo
 * muda, e quem abre o link continua vendo as seções entrarem por scroll
 * exatamente como antes.
 *
 * COMO SE RECONHECE UMA REVELAÇÃO PRESA, sem a skin precisar declarar nada:
 * `motion` pinta o estado inicial de `whileInView` INLINE no elemento
 * (`style="opacity:0;transform:translateY(56px)"`). Então o alvo é o
 * elemento com opacidade INLINE abaixo de 1 que ou está em zero, ou carrega
 * um transform inline junto. O que fica de fora, de propósito:
 *
 *   - opacidade inline de DESENHO, sem transform (o degradê a 0.9 sobre o
 *     card de imóvel) — mexer nela mudaria o visual da demo, não revelaria
 *     nada;
 *   - transform inline SEM opacidade: é carrossel, parallax, barra de
 *     progresso e contador rolante (medidos: `translateX(-680px)`,
 *     `scaleX(0.4)`, `translateY(-2.2em)`). Zerar esses transforms
 *     desmontaria o conteúdo em vez de revelá-lo;
 *   - a camada decorativa (`[data-d-efeito-camada]`, `[data-d-led-estilo]`),
 *     cuja opacidade é escrita no DOM por design (ver LedEdges).
 *
 * O laço repete porque uma animação EM VOO reescreve o inline no quadro
 * seguinte: força, cede um quadro, confere. `restantes > 0` significa que
 * alguma coisa continuou reescrevendo até o fim do orçamento — quem chama
 * trata como reprovação, não como detalhe.
 *
 * @param {{ limiteMs?: number }} [opcoes]
 * @param {Window} [win] janela alvo (default: a da própria página)
 * @returns {Promise<{ forcados: number, restantes: number, esperouMs: number }>}
 */
export async function forcarRevelacaoDasSecoes({ limiteMs = 2000 } = {}, win = window) {
  const doc = win.document;
  const inicio = Date.now();
  const quadro = () =>
    new Promise((r) =>
      typeof win.requestAnimationFrame === "function"
        ? win.requestAnimationFrame(() => r(undefined))
        : setTimeout(r, 16),
    );

  let forcados = 0;
  let restantes = 0;

  for (;;) {
    restantes = 0;
    for (const node of Array.from(doc.querySelectorAll("[data-d-secao] *"))) {
      const inline = node.style;
      if (!inline) continue;
      const op = inline.opacity;
      if (op === "" || op === undefined) continue;
      const valor = Number(op);
      if (!Number.isFinite(valor) || valor >= 0.98) continue;
      const transform = String(inline.transform ?? "");
      const comTransform = /translate|scale|rotate|skew|matrix/.test(transform);
      if (valor > 0.02 && !comTransform) continue;
      if (node.closest("[data-d-efeito-camada], [data-d-led-estilo]")) continue;

      inline.removeProperty("opacity");
      if (comTransform) inline.removeProperty("transform");
      // Marca quem foi forçado: é o que permite a uma captura reprovada
      // dizer ONDE estava o buraco, em vez de só quantos eram.
      node.setAttribute("data-d-captura-revelado", "1");
      forcados += 1;
      restantes += 1;
    }
    if (restantes === 0 || Date.now() - inicio >= limiteMs) break;
    await quadro();
  }

  return { forcados, restantes, esperouMs: Date.now() - inicio };
}

/**
 * O PORTÃO da revelação: sobrou alguma coisa presa no estado inicial?
 *
 * Mesmo critério de `forcarRevelacaoDasSecoes` (a regra de ouro deste
 * arquivo proíbe helper compartilhado — `page.evaluate` avalia cada função
 * noutro realm), só que aqui ele MEDE em vez de corrigir, e reparte o
 * resultado pela posição em relação ao recorte: `acima`, `dentro` e
 * `abaixo` da seção capturada.
 *
 * A repartição é o ponto. Um buraco DENTRO do recorte é um pedaço apagado
 * na foto que vai pro lead; um buraco ACIMA ou ABAixo é a página vizinha em
 * branco — que é o que aparece na prévia de enquadramento de
 * /interno/capturas e no que a moldura mostra em volta da seção. Nenhum dos
 * dois pode sair de uma rodada aprovada, então os três números voltam
 * separados e quem chama reprova com o lugar na mão.
 *
 * @param {string} secaoId
 * @param {Window} [win] janela alvo (default: a da própria página)
 * @returns {{ total: number, acima: number, dentro: number, abaixo: number, exemplos: string[] }}
 */
export function revelacaoPendente(secaoId, win = window) {
  const doc = win.document;
  const secao = Array.from(doc.querySelectorAll("[data-d-secao]")).find(
    (n) => n.getAttribute("data-d-secao") === secaoId,
  );
  const caixa = secao?.getBoundingClientRect();
  const topoSecao = caixa ? caixa.top + win.scrollY : 0;
  const baseSecao = caixa ? topoSecao + caixa.height : 0;

  let acima = 0;
  let dentro = 0;
  let abaixo = 0;
  const exemplos = [];

  for (const node of Array.from(doc.querySelectorAll("[data-d-secao] *"))) {
    const inline = node.style;
    if (!inline) continue;
    const op = inline.opacity;
    if (op === "" || op === undefined) continue;
    const valor = Number(op);
    if (!Number.isFinite(valor) || valor >= 0.98) continue;
    const transform = String(inline.transform ?? "");
    const comTransform = /translate|scale|rotate|skew|matrix/.test(transform);
    if (valor > 0.02 && !comTransform) continue;
    if (node.closest("[data-d-efeito-camada], [data-d-led-estilo]")) continue;

    const r = node.getBoundingClientRect();
    const topo = r.top + win.scrollY;
    if (!caixa || (topo + r.height > topoSecao && topo < baseSecao)) dentro += 1;
    else if (topo < topoSecao) acima += 1;
    else abaixo += 1;

    if (exemplos.length < 5) {
      const dono = node.closest("[data-d-secao]")?.getAttribute("data-d-secao") ?? "?";
      exemplos.push(`${dono}/${node.tagName.toLowerCase()}(opacity ${op})`);
    }
  }

  return { total: acima + dentro + abaixo, acima, dentro, abaixo, exemplos };
}

/**
 * ASSENTA o LED de borda para a foto.
 *
 * O LED é `position: fixed` e o ponto mais brilhante viaja com
 * `--d-led-scroll` (0–1, a posição do scroll na página). Numa captura isso
 * não sobrevive: pra enquadrar uma seção mais alta que a tela o motor
 * CRESCE a viewport, e a barra — que ocupa a viewport inteira — passa a
 * espalhar por uma altura que nenhum visitante tem. Medido na
 * tatuagem-editorial: `--d-led-scroll` 0,67 em "investimento" e 0,81 em
 * "depoimentos", com a viewport esticada de 844 para 1457 e 1330px. O
 * resultado na imagem é uma FAIXA acesa no meio do recorte, com as duas
 * pontas apagadas — o LED deixa de ler como luz de borda.
 *
 * Prender a fase é a mesma decisão de `congelarAnimacoes`, pelo mesmo
 * motivo: a foto não pode sair no instante em que o efeito está apagado. A
 * meia-fase centra a luz no recorte, que é o que um visitante vê ao chegar
 * na seção. Capture-only: o valor é escrito no DOM depois do último
 * scroll/resize da rodada, e nada na demo muda.
 *
 * @param {{ fase?: number }} [opcoes]
 * @param {Window} [win] janela alvo (default: a da própria página)
 * @returns {{ leds: number, fase: number }}
 */
export function assentarLed({ fase = 0.5 } = {}, win = window) {
  const leds = Array.from(win.document.querySelectorAll("[data-d-led-estilo]"));
  for (const el of leds) el.style.setProperty("--d-led-scroll", String(fase));
  return { leds: leds.length, fase };
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

/**
 * CONGELA o relógio das animações no instante do disparo — a mesma técnica
 * que o laço visual usa para provar neutralidade de cor (`congelarCores` em
 * scripts/qa-visual.mjs): WAAPI, `pause()` + `currentTime` numa fase fixa
 * do ciclo, em vez de esperar um instante aleatório.
 *
 * Sem isso a captura pega o meio do voo: a faísca vive menos de um segundo
 * e a varredura de luz ocupa ~14% de um ciclo de dezenas de segundos, então
 * um print tirado "quando der" mostra tela apagada — ou pior, um risco de
 * luz cortando a imagem que o lead vai receber. Cada efeito com janela
 * curta declara a fração do ciclo em que ele está ACESO (`fasePorEfeito`,
 * mesmos números do laço visual).
 *
 * Só congela o que ROLA SOZINHO (`iterations: Infinity`) e as animações da
 * camada decorativa. As revelações de entrada de seção ficam de fora de
 * propósito: elas já terminaram durante o `prepararPagina`, e mexer no
 * relógio delas devolveria a seção ao estado inicial (transparente,
 * deslocada) bem na hora da foto.
 *
 * @param {{ fasePadrao?: number, fasePorEfeito?: Record<string, number>, efeitoId?: string }} opcoes
 * @param {Window} [win] janela alvo (default: a da própria página)
 * @returns {{ congeladas: number, infinitas: number }}
 */
export function congelarAnimacoes({ fasePadrao = 0.35, fasePorEfeito = {}, efeitoId } = {}, win = window) {
  const doc = win.document;
  let congeladas = 0;
  let infinitas = 0;

  for (const anim of doc.getAnimations()) {
    const nome = String(anim.animationName ?? "");
    const t = anim.effect?.getComputedTiming?.();
    const ciclo = t?.duration;
    if (typeof ciclo !== "number" || !Number.isFinite(ciclo) || ciclo <= 0) continue;

    const daCamada = nome.startsWith("d-efeito-") || nome.startsWith("d-cores-");
    const infinita = t.iterations === Infinity;
    if (infinita) infinitas += 1;
    if (!daCamada && !infinita) continue;

    // Cor: fase 0 (o começo do ciclo é a cor do tema, que é a que o preset
    // escolheu). Efeito: a fase em que ele está aceso.
    const fase = nome.startsWith("d-cores-")
      ? 0
      : (efeitoId !== undefined ? fasePorEfeito[efeitoId] : undefined) ?? fasePadrao;

    const delay = Number(t.delay) || 0;
    anim.pause();
    // `currentTime` corre na linha do tempo da animação, que só entra no
    // ciclo depois do delay. Os efeitos usam delay NEGATIVO pra defasar
    // cópias, o que daria um currentTime negativo (inválido): avança ciclos
    // inteiros até ficar positivo — a fase dentro do ciclo é a mesma.
    const ciclosExtras = Math.ceil(Math.max(0, -delay) / ciclo);
    anim.currentTime = delay + ciclo * (ciclosExtras + fase);
    congeladas += 1;
  }
  return { congeladas, infinitas };
}

/**
 * Rola até o topo da seção. `behavior: "instant"` é obrigatório: skins com
 * nav de âncora ligam `scroll-behavior: smooth` no documento, e aí a
 * rolagem ANIMA — ler a caixa logo depois devolvia a posição antiga, e o
 * enquadramento saía reprovado como "não coube na viewport".
 *
 * @param {string} secaoId
 * @param {Window} [win] janela alvo (default: a da própria página)
 * @returns {boolean} achou a seção?
 */
export function rolarAteSecao(secaoId, win = window) {
  const el = Array.from(win.document.querySelectorAll("[data-d-secao]")).find(
    (n) => n.getAttribute("data-d-secao") === secaoId,
  );
  if (!el) return false;
  win.scrollTo({ top: el.getBoundingClientRect().top + win.scrollY, behavior: "instant" });
  return true;
}

/**
 * Caixa da seção RELATIVA À VIEWPORT — o sistema de coordenadas do `clip`
 * do Playwright quando não se usa `fullPage` (provado por sonda: com
 * `fullPage` a captura refaz o render com a viewport esticada, o que
 * redefine `100vh`, incha o hero, empurra tudo pra baixo e faz o recorte
 * cair noutra seção).
 *
 * Ler a caixa DEPOIS de rolar, em vez de calcular o recorte a partir da
 * posição pretendida, é o que torna o enquadramento autocorretivo: se o
 * scroll não alcançou (seção no fim do documento) ou se algo assentou no
 * caminho, o recorte ainda sai de onde a seção ESTÁ.
 *
 * @param {string} secaoId
 * @param {Window} [win] janela alvo (default: a da própria página)
 * @returns {{ x: number, y: number, width: number, height: number, cabe: boolean } | null}
 */
export function caixaNaViewport(secaoId, win = window) {
  const el = Array.from(win.document.querySelectorAll("[data-d-secao]")).find(
    (n) => n.getAttribute("data-d-secao") === secaoId,
  );
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: Math.max(0, Math.round(r.left)),
    y: Math.max(0, Math.round(r.top)),
    width: Math.round(r.width),
    height: Math.round(r.height),
    cabe: r.top >= -1 && r.top + r.height <= win.innerHeight + 1,
  };
}

/**
 * Imagens DENTRO da seção que vai virar foto — e quantas delas de fato
 * carregaram. É o número que importa: uma imagem pendente noutro canto do
 * documento não aparece no enquadramento, mas uma pendente aqui vira
 * buraco na imagem que o lead recebe.
 *
 * @param {string} secaoId
 * @param {Window} [win] janela alvo (default: a da própria página)
 * @returns {{ total: number, prontas: number }}
 */
export function imagensDaSecao(secaoId, win = window) {
  const doc = win.document;
  const el = Array.from(doc.querySelectorAll("[data-d-secao]")).find(
    (n) => n.getAttribute("data-d-secao") === secaoId,
  );
  if (!el) return { total: 0, prontas: 0 };
  const imgs = Array.from(el.querySelectorAll("img"));
  return {
    total: imgs.length,
    prontas: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
  };
}

/**
 * PRENDE as alturas em unidade de tela (`vh`) ao valor que elas têm AGORA.
 *
 * Existe por causa de um laço de realimentação: para capturar uma seção
 * mais alta que a tela, o motor cresce a viewport — e uma seção medida em
 * `vh` cresce junto, então ela nunca cabe. O hero da barbearia no celular
 * (`min-h-screen` na seção + `h-[60vh]` na foto) ia de 1300px para 1463px
 * a cada tentativa; a galeria da tatuagem2, rolada por scroll, chegava a
 * 11608px.
 *
 * Rodando com a viewport na altura REAL da tela, converte essas alturas
 * para pixels inline. O layout congelado é exatamente o que o visitante
 * vê, e a partir daí crescer a viewport não mexe mais em nada.
 *
 * @param {Window} [win] janela alvo (default: a da própria página)
 * @returns {{ presos: number, alturaTela: number }}
 */
export function fixarUnidadesDeTela(win = window) {
  const doc = win.document;
  // Tailwind deixa a unidade visível na classe: `h-screen`, `min-h-screen`,
  // `h-dvh` e os valores arbitrários `h-[60vh]`/`md:h-[80vh]`.
  const usaTela = /(^|:)(min-h|max-h|h)-(screen|\[[^\]]*(vh|dvh|svh|lvh)[^\]]*\])/;
  let presos = 0;

  for (const node of Array.from(doc.querySelectorAll("*"))) {
    const classes = String(node.className?.baseVal ?? node.className ?? "");
    if (!classes.split(/\s+/).some((c) => usaTela.test(c))) continue;
    const estilo = win.getComputedStyle(node);
    for (const prop of ["height", "minHeight", "maxHeight"]) {
      const valor = estilo[prop];
      if (!valor || valor === "auto" || valor === "none" || valor === "0px") continue;
      node.style[prop] = valor;
    }
    presos += 1;
  }
  return { presos, alturaTela: win.innerHeight };
}

/**
 * A PALETA DA DEMO, lida da própria página — é o fundo sobre o qual a
 * moldura é composta (ver `capturas/moldura.mjs`).
 *
 * Sai do elemento da seção, e não do `<html>`: cada skin declara as
 * variáveis `--d-*` na raiz do SEU componente, não no documento. Como
 * propriedade customizada é herdada, ler de um descendente devolve o valor
 * vigente — e a seção capturada é, por definição, um descendente.
 *
 * Compor sobre uma cor da plataforma seria carimbar o Radar na imagem que
 * vai pro lead; o fundo tem que ser da marca DELE. Seção inexistente
 * devolve `null` e quem chama cai no fundo de reserva, em vez de compor
 * sobre preto sem avisar.
 *
 * @param {string} secaoId
 * @param {Window} [win] janela alvo (default: a da própria página)
 * @returns {{ fundo: string, fundoAlt: string, fundoElevado: string, destaque: string, texto: string } | null}
 */
export function paletaDaPagina(secaoId, win = window) {
  const el = Array.from(win.document.querySelectorAll("[data-d-secao]")).find(
    (n) => n.getAttribute("data-d-secao") === secaoId,
  );
  const alvo = el ?? win.document.body;
  if (!alvo) return null;
  const estilo = win.getComputedStyle(alvo);
  const ler = (nome) => estilo.getPropertyValue(nome).trim();
  const fundo = ler("--d-bg");
  if (!fundo) return null;
  return {
    fundo,
    fundoAlt: ler("--d-bg-alt") || fundo,
    fundoElevado: ler("--d-bg-elev") || fundo,
    destaque: ler("--d-accent") || fundo,
    texto: ler("--d-text") || "#ffffff",
  };
}

/**
 * Espera o TEXTO parar de mudar — a defesa contra animação de texto feita
 * em JavaScript, que `congelarAnimacoes` não alcança.
 *
 * O caso que a descobriu: o hero da barbearia escreve o título com uma
 * máquina de escrever montada em `setTimeout` + estado do React
 * (`TypewriterText`), não em WAAPI. Congelar animação não a toca, e o
 * disparo pegava o título pela metade — a captura de desktop saiu com
 * "BARBEARIA DOM AUR|" no lugar do nome do negócio, que é justamente o que
 * a imagem existe pra mostrar. No celular passava por acidente: a seção
 * mais alta que a tela faz o motor crescer a viewport e preparar a página
 * de novo, e esse tempo a mais dava pro texto terminar. Verificação por
 * captura de um lead real é o que separou os dois casos.
 *
 * Genérica de propósito: qualquer skin que anime texto por JS cai aqui,
 * sem o motor precisar conhecer o componente.
 *
 * @param {{ secaoId?: string, quietoMs?: number, limiteMs?: number }} opcoes
 * @param {Window} [win] janela alvo (default: a da própria página)
 * @returns {Promise<{ estavel: boolean, esperouMs: number }>}
 */
export async function esperarTextoEstavel({ secaoId, quietoMs = 500, limiteMs = 6000 } = {}, win = window) {
  const doc = win.document;
  const alvo = secaoId
    ? Array.from(doc.querySelectorAll("[data-d-secao]")).find(
        (n) => n.getAttribute("data-d-secao") === secaoId,
      ) ?? doc.body
    : doc.body;

  const inicio = Date.now();
  let anterior = alvo.textContent ?? "";
  let paradoDesde = Date.now();

  while (Date.now() - inicio < limiteMs) {
    await new Promise((r) => setTimeout(r, 100));
    const atual = alvo.textContent ?? "";
    if (atual !== anterior) {
      anterior = atual;
      paradoDesde = Date.now();
      continue;
    }
    if (Date.now() - paradoDesde >= quietoMs) {
      return { estavel: true, esperouMs: Date.now() - inicio };
    }
  }
  // Texto que nunca para (marquee escrito em JS, contador infinito) não
  // pode travar a rodada: a captura sai com a ressalva.
  return { estavel: false, esperouMs: Date.now() - inicio };
}

/**
 * TÍTULO E DESCRIÇÃO que a própria demo declara — o que a prévia do link
 * usa como linha de apoio ao lado do nome do negócio.
 *
 * Sai do `<head>` da página em vez de ser remontado no motor: quem escreve
 * esses dois textos é o `generateMetadata` da rota pública, a partir do
 * lead. Recalcular aqui abriria a porta pra a prévia dizer uma coisa e a
 * página dizer outra.
 *
 * @param {Window} [win] janela alvo (default: a da própria página)
 * @returns {{ titulo: string, descricao: string }}
 */
export function identidadeDaPagina(win = window) {
  const meta = win.document.querySelector('meta[name="description"]');
  return {
    titulo: (win.document.title ?? "").trim(),
    descricao: (meta?.getAttribute("content") ?? "").trim(),
  };
}

/**
 * Força as imagens DA SEÇÃO a carregar, inclusive as que o lazy-load nunca
 * pediria: as que vivem fora do campo de visão HORIZONTAL, dentro de
 * galerias e carrosséis arrastáveis (a galeria da barbearia2 saía com 2 de
 * 5 fotos; o cardápio da lancheria, com 7 de 13). Rolar a página resolve o
 * eixo vertical e só ele — por isso o `prepararPagina` não bastava.
 *
 * Duas frentes: `loading = "eager"` em tudo que está marcado como lazy, e
 * uma varredura de cada trilho com rolagem horizontal, que é o que traz os
 * itens do fim para dentro do observador.
 *
 * @param {string} secaoId
 * @param {Window} [win] janela alvo (default: a da própria página)
 * @returns {{ trilhos: number, forcadas: number }}
 */
export function forcarImagensDaSecao(secaoId, win = window) {
  const doc = win.document;
  const secao = Array.from(doc.querySelectorAll("[data-d-secao]")).find(
    (n) => n.getAttribute("data-d-secao") === secaoId,
  );
  if (!secao) return { trilhos: 0, forcadas: 0 };

  let forcadas = 0;
  for (const img of Array.from(secao.querySelectorAll("img"))) {
    if (img.loading === "lazy") {
      img.loading = "eager";
      forcadas += 1;
    }
    img.removeAttribute("decoding");
  }

  let trilhos = 0;
  for (const node of [secao, ...Array.from(secao.querySelectorAll("*"))]) {
    if (node.scrollWidth <= node.clientWidth + 1) continue;
    trilhos += 1;
    const volta = node.scrollLeft;
    const passo = Math.max(120, Math.round(node.clientWidth * 0.8));
    for (let x = 0; x < node.scrollWidth; x += passo) node.scrollLeft = x;
    node.scrollLeft = volta;
  }
  return { trilhos, forcadas };
}
