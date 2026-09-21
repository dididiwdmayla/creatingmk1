import type { TatuagemComposicao } from "@/lib/demos/types";

/**
 * A COMPOSIÇÃO da tatuagem: uma árvore de seções, quatro desenhos, um
 * caminho de render só.
 *
 * Cada knob de `TatuagemComposicao` vira um `data-te-*` no wrapper da skin
 * e um bloco de regras aqui. É o mesmo mecanismo de
 * `BARBEARIA_COMPOSICAO_CSS`, e existe pela mesma razão: o contrato de
 * seções é da SKIN, não da variante — se cada variante tivesse o seu
 * render, o `data-d-secao` deixaria de ser garantia e a aba Estrutura
 * teria de saber qual variante está aberta.
 *
 * REGRAS DE CASA, todas aprendidas no caminho:
 *
 * 1. **Sai no servidor.** Este CSS é renderizado junto com o HTML. Ordem,
 *    colunas e proporção mexem em layout; aplicar depois da hidratação é
 *    deslocamento de layout puro, que é o que `qa-cls.mjs` reprova.
 * 2. **Especificidade sem `!important`.** As regras competem com utilitárias
 *    do Tailwind (`space-y-6` chega a 0,3,0), então os seletores descem um
 *    nível a mais (`.te[data-te-x="y"] .pai > .filho`) em vez de gritar.
 * 3. **Nenhuma composição esconde TEXTO.** Só duas escondem imagem — a
 *    abertura `cartaz` (sem foto de fundo) e o artista `indice` (sem
 *    retrato) —, e as duas são declaradas em `SkinVariante.imagensOcultas`
 *    para o editor avisar quem sobe a foto. Sumir com conteúdo sem aviso
 *    parece defeito, não desenho.
 * 4. **Tamanho grande vem por token.** `--te-titulo-tam`/`--te-manifesto-tam`
 *    existem porque esses tamanhos estavam em `style` inline, e inline
 *    vence folha de estilo.
 * 5. **O título do hero nunca encolhe.** O vídeo dentro das letras só se lê
 *    em letra grande, e o print do hero vira miniatura no WhatsApp — então
 *    nenhuma abertura mexe no `font-size` do wordmark. O que muda em volta
 *    dele é tudo o mais.
 */
export const TATUAGEM_COMPOSICAO_CSS = `
/* ── Tokens de superfície ──────────────────────────────────────────── */
.te {
  --te-foto-filtro: grayscale(100%) contrast(1.25) brightness(0.75);
  --te-titulo-sombra: 4px 6px 0 color-mix(in srgb, var(--d-bg) 90%, transparent);
  /* Base do gradiente que preenche as letras: o efeito do material bruto é
     a letra vazada na cor do fundo, com o contorno multicor por cima. Numa
     paleta CLARA isso pinta creme sobre creme e o título some — por isso é
     token, e não \`--d-bg\` direto. */
  --te-wordmark-base: var(--d-bg);
  --te-letras: 1;
  --te-veu: 85;
  --te-veu-topo: calc(var(--te-veu) * 1%);
  --te-veu-meio: calc((var(--te-veu) - 10) * 1%);
  --te-veu-base: min(100%, calc((var(--te-veu) + 5) * 1%));
}
.te .te-hero-veu {
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--d-bg) var(--te-veu-topo), transparent) 0%,
    color-mix(in srgb, var(--d-bg) var(--te-veu-meio), transparent) 50%,
    color-mix(in srgb, var(--d-bg) var(--te-veu-base), transparent) 100%);
}
.te .d-gothic-bg span { opacity: calc(var(--te-letra-op, .08) * var(--te-letras)); }
.te[data-te-letra="solida"] { --te-wordmark-base: var(--d-text); }
.te[data-te-foto="cinza"] { --te-foto-filtro: grayscale(100%) contrast(1.02) brightness(.98); }
.te[data-te-foto="suave"] { --te-foto-filtro: grayscale(62%) contrast(.95) brightness(1.03) sepia(10%); }

/* ── ABERTURA ──────────────────────────────────────────────────────────
   monolito: tela cheia, foto sangrada atrás (o desenho do material bruto).
   cisao:    título de um lado, foto como coluna sólida do outro.
   ficha:    três faixas — título, foto larga e baixa, tarja de dados.
   cartaz:   só tipografia; a foto do hero não aparece (segue nas letras). */
.te[data-te-abertura="cisao"] .te-hero,
.te[data-te-abertura="ficha"] .te-hero { display: grid; min-height: 0; }
.te[data-te-abertura="cisao"] .te-hero-veu,
.te[data-te-abertura="ficha"] .te-hero-veu { display: none; }
.te[data-te-abertura="cisao"] .te-hero-foto,
.te[data-te-abertura="ficha"] .te-hero-foto { position: relative; inset: auto; }

.te[data-te-abertura="cisao"] .te-hero {
  grid-template-columns: minmax(0,1fr); align-content: center; row-gap: 2.25rem;
  padding: 7rem 1.5rem 3rem;
}
.te[data-te-abertura="cisao"] .te-hero-foto { order: 2; height: 17rem; }
.te[data-te-abertura="cisao"] .te-hero-corpo {
  order: 1; align-items: flex-start; text-align: left; max-width: none;
}
.te[data-te-abertura="cisao"] .te-hero-corpo .te-hero-titulo { max-width: none; }

.te[data-te-abertura="ficha"] .te-hero {
  grid-template-columns: minmax(0,1fr); align-content: start; row-gap: 1.25rem;
  padding: 7.5rem 1.5rem 2.5rem;
}
.te[data-te-abertura="ficha"] .te-hero-corpo { display: contents; }
.te[data-te-abertura="ficha"] .te-hero-cidade { order: 1; margin-bottom: 0; }
.te[data-te-abertura="ficha"] .te-hero-titulo { order: 2; max-width: none; }
.te[data-te-abertura="ficha"] .te-hero-foto {
  order: 3; height: 12rem; border-block: 1px solid var(--d-border);
}
.te[data-te-abertura="ficha"] .te-hero-slogan { order: 4; margin-bottom: 0; }
.te[data-te-abertura="ficha"] .te-hero-texto { order: 5; max-width: 48ch; }
.te[data-te-abertura="ficha"] .te-hero-cta {
  order: 6; margin-top: .5rem; width: 100%;
  border-top: 3px double var(--d-border); padding-top: 1.5rem;
}

.te[data-te-abertura="cartaz"] .te-hero-foto,
.te[data-te-abertura="cartaz"] .te-hero-veu { display: none; }
.te[data-te-abertura="cartaz"] .te-hero { padding-block: 8rem 4rem; }
.te[data-te-abertura="cartaz"] .te-hero-corpo { justify-content: center; }
.te[data-te-abertura="cartaz"] .te-hero-titulo { max-width: none; }
.te[data-te-abertura="cartaz"] .te-hero-cidade {
  width: min(100%, 30rem); border-bottom: 1px solid var(--d-border); padding-bottom: 1.5rem;
}
.te[data-te-abertura="cartaz"] .te-hero-texto { max-width: 40ch; }
.te[data-te-abertura="cartaz"] .te-hero-cta { margin-top: 3.5rem; }

/* ── GALERIA ───────────────────────────────────────────────────────────
   mosaico: colunas de alturas irregulares (o desenho do material bruto).
   mural:   grade cerrada, goteira de 2px, legenda sempre visível.
   tira:    corre na horizontal, com encaixe — folhear um book.
   lista:   uma peça por linha, numerada, legenda ao lado. */
.te[data-te-galeria="mural"] .te-galeria-lista,
.te[data-te-galeria="tira"] .te-galeria-lista,
.te[data-te-galeria="lista"] .te-galeria-lista { columns: auto; }
.te[data-te-galeria="mural"] .te-galeria-lista > .te-galeria-item,
.te[data-te-galeria="tira"] .te-galeria-lista > .te-galeria-item,
.te[data-te-galeria="lista"] .te-galeria-lista > .te-galeria-item { margin: 0; }
.te[data-te-galeria="mural"] .te-galeria-legenda-texto,
.te[data-te-galeria="tira"] .te-galeria-legenda-texto { opacity: 1; }

.te[data-te-galeria="mural"] .te-galeria-lista {
  display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 2px;
}
.te[data-te-galeria="mural"] .te-galeria-cabeca { margin-bottom: 3rem; }
.te[data-te-galeria="mural"] .te-galeria-foto { aspect-ratio: 1; }

.te[data-te-galeria="tira"] .te-galeria-lista {
  display: flex; gap: 1rem; overflow-x: auto; scroll-snap-type: x mandatory;
  padding-bottom: 1.5rem;
}
.te[data-te-galeria="tira"] .te-galeria-lista > .te-galeria-item {
  flex: 0 0 78%; scroll-snap-align: center;
}
.te[data-te-galeria="tira"] .te-galeria-foto { aspect-ratio: 3/4; }

.te[data-te-galeria="lista"] .te-galeria-lista {
  display: grid; grid-template-columns: minmax(0,1fr); gap: 3.5rem; counter-reset: te-peca;
}
.te[data-te-galeria="lista"] .te-galeria-lista > .te-galeria-item { counter-increment: te-peca; }
.te[data-te-galeria="lista"] .te-galeria-peca {
  display: grid; grid-template-columns: minmax(0,1fr); gap: 1rem; background: transparent;
}
.te[data-te-galeria="lista"] .te-galeria-foto { aspect-ratio: 16/10; }
.te[data-te-galeria="lista"] .te-galeria-legenda { position: static; inset: auto; }
.te[data-te-galeria="lista"] .te-galeria-legenda-texto {
  opacity: 1; background: transparent; padding: 0; font-size: 11px; letter-spacing: .16em;
}
.te[data-te-galeria="lista"] .te-galeria-legenda-texto::before {
  content: counter(te-peca, decimal-leading-zero) "  "; color: var(--d-accent);
}

/* ── O ARTISTA ─────────────────────────────────────────────────────────
   retrato: 3/4 ao lado do texto (o desenho do material bruto).
   indice:  sem retrato; o texto em duas colunas e os ESTILOS dominando.
   faixa:   foto sangrada de ponta a ponta, texto em duas colunas embaixo.
   dossie:  retrato pequeno, nome enorme, medida estreita, fios verticais. */
.te[data-te-artista="indice"] .te-artista-foto { display: none; }
.te[data-te-artista="indice"] .te-artista-copy { grid-column: 1 / -1; }
.te[data-te-artista="indice"] .te-artista-tags {
  margin-top: 3rem; border-top: 0; padding-top: 0;
}
.te[data-te-artista="indice"] .te-artista-tags-lista {
  display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 0; counter-reset: te-tag;
}
.te[data-te-artista="indice"] .te-artista-tag {
  counter-increment: te-tag; border-top: 1px solid var(--d-border); padding: 1rem .75rem 1rem 0;
}
.te[data-te-artista="indice"] .te-artista-tag::before {
  content: counter(te-tag, decimal-leading-zero); display: block; margin-bottom: .4rem;
  font-family: var(--d-mono); font-size: 10px; letter-spacing: .2em; color: var(--d-accent);
}
.te[data-te-artista="indice"] .te-artista-tag-texto {
  border: 0; padding: 0; font-family: var(--d-display); font-size: 1.125rem;
  letter-spacing: 0; text-transform: none;
}

.te[data-te-artista="faixa"] .te-artista { padding-inline: 0; }
.te[data-te-artista="faixa"] .te-artista-grid {
  grid-template-columns: minmax(0,1fr); gap: 2.5rem; max-width: none;
}
.te[data-te-artista="faixa"] .te-artista-foto {
  grid-column: 1 / -1; margin: 0; max-width: none; aspect-ratio: 16/9;
}
.te[data-te-artista="faixa"] .te-artista-moldura { display: none; }
.te[data-te-artista="faixa"] .te-artista-copy {
  grid-column: 1 / -1; margin-inline: auto; max-width: 72rem; padding-inline: 1.5rem;
}

.te[data-te-artista="dossie"] .te-artista-grid {
  grid-template-columns: minmax(0,1fr); max-width: 56rem; gap: 2rem; align-items: start;
}
.te[data-te-artista="dossie"] .te-artista-foto {
  aspect-ratio: 1; width: 8rem; max-width: 8rem; margin: 0;
}
.te[data-te-artista="dossie"] .te-artista-moldura { display: none; }
.te[data-te-artista="dossie"] .te-artista-nome { --te-titulo-tam: clamp(3rem, 9vw, 5.5rem); }
.te[data-te-artista="dossie"] .te-artista-texto { max-width: 46ch; line-height: 1.95; }
.te[data-te-artista="dossie"] .te-artista-tags-lista {
  display: grid; grid-template-columns: minmax(0,1fr); gap: 0;
}
.te[data-te-artista="dossie"] .te-artista-tag {
  border-bottom: 1px solid var(--d-border); padding-block: .85rem;
}
.te[data-te-artista="dossie"] .te-artista-tag-texto {
  border: 0; padding: 0; font-size: 11px; letter-spacing: .24em;
}

/* ── INVESTIMENTO ──────────────────────────────────────────────────────
   lista:   linha alta com descrição corrida (o desenho do material bruto).
   tabela:  linhas cerradas em mono — lista de parede.
   cartoes: valor grande, cartão com fio.
   prosa:   sem fios; o preço entra na frase, em voz baixa. */
.te[data-te-precos="tabela"] .te-precos-caixa { max-width: 64rem; }
.te[data-te-precos="tabela"] .te-preco { padding-block: .9rem; }
.te[data-te-precos="tabela"] .te-preco-linha { margin-bottom: .15rem; gap: 1rem; }
.te[data-te-precos="tabela"] .te-preco-nome {
  font-family: var(--d-mono); font-size: .8125rem; letter-spacing: .14em; text-transform: uppercase;
}
.te[data-te-precos="tabela"] .te-preco-valor { font-size: .8125rem; }
.te[data-te-precos="tabela"] .te-preco-desc { font-size: .6875rem; line-height: 1.5; opacity: .75; }

.te[data-te-precos="cartoes"] .te-precos-lista {
  display: grid; grid-template-columns: minmax(0,1fr); gap: 1rem; border-top: 0;
}
.te[data-te-precos="cartoes"] .te-preco {
  border: 1px solid var(--d-border); background: var(--d-bg); padding: 1.5rem;
}
.te[data-te-precos="cartoes"] .te-preco-linha {
  flex-direction: column; align-items: flex-start; gap: .3rem; margin-bottom: .75rem;
}
.te[data-te-precos="cartoes"] .te-preco-valor { order: -1; font-size: 1.75rem; letter-spacing: .01em; }
.te[data-te-precos="cartoes"] .te-preco-nome { font-size: 1.125rem; }

.te[data-te-precos="prosa"] .te-precos { background: transparent; }
.te[data-te-precos="prosa"] .te-precos-caixa { max-width: 44rem; }
.te[data-te-precos="prosa"] .te-precos-lista { border-top: 0; gap: 2.5rem; }
.te[data-te-precos="prosa"] .te-preco { border-bottom: 0; padding-block: 0; }
.te[data-te-precos="prosa"] .te-preco-linha { display: block; margin-bottom: .4rem; }
.te[data-te-precos="prosa"] .te-preco-nome {
  display: inline; font-family: var(--d-serif); font-size: 1.25rem;
}
.te[data-te-precos="prosa"] .te-preco-valor {
  display: inline; margin-left: .85rem; font-size: .6875rem; letter-spacing: .22em;
  color: var(--d-muted);
}
.te[data-te-precos="prosa"] .te-preco-desc { max-width: none; line-height: 1.9; }

/* ── DEPOIMENTOS ───────────────────────────────────────────────────────
   cartoes:   três cartões com fio (o desenho do material bruto).
   tira:      corre na horizontal, cartão estreito.
   empilhado: autor de um lado, fala do outro, linha a linha.
   citacao:   uma fala gigante de cada vez. */
.te[data-te-provas="tira"] .te-provas-lista {
  display: flex; gap: 1rem; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 1rem;
}
.te[data-te-provas="tira"] .te-provas-lista > .te-prova {
  flex: 0 0 82%; scroll-snap-align: start; padding: 1.5rem; gap: 1rem;
}
.te[data-te-provas="tira"] .te-prova-texto { font-size: .9375rem; font-style: normal; }

.te[data-te-provas="empilhado"] .te-provas-lista {
  display: grid; grid-template-columns: minmax(0,1fr); gap: 0;
}
.te[data-te-provas="empilhado"] .te-provas-lista > .te-prova {
  border: 0; border-top: 1px solid var(--d-border); background: transparent;
  padding: 1.75rem 0; gap: .5rem;
}
.te[data-te-provas="empilhado"] .te-prova-autor { order: -1; }
.te[data-te-provas="empilhado"] .te-prova-texto { font-style: normal; font-size: 1.0625rem; }

.te[data-te-provas="citacao"] .te-provas-caixa { max-width: 60rem; }
.te[data-te-provas="citacao"] .te-provas-lista {
  display: grid; grid-template-columns: minmax(0,1fr); gap: 4.5rem;
}
.te[data-te-provas="citacao"] .te-provas-lista > .te-prova {
  border: 0; background: transparent; padding: 0; text-align: center; gap: 1.25rem;
}
/* As estrelas ficam — só recuam. Composição nenhuma some com conteúdo. */
.te[data-te-provas="citacao"] .te-prova-nota { font-size: .7rem; opacity: .65; }
.te[data-te-provas="citacao"] .te-prova-texto {
  font-family: var(--d-citacao); font-style: normal; line-height: 1.12; letter-spacing: -.02em;
  font-size: clamp(1.625rem, 4.5vw, 2.75rem);
}
.te[data-te-provas="citacao"] .te-prova-autor { letter-spacing: .3em; }

/* ── FECHO ─────────────────────────────────────────────────────────────
   centralizado: bloco central (o desenho do material bruto).
   colunas:      rodapé de três colunas.
   tarja:        faixa de dados em mono, entre fios duplos.
   cartaz:       o CTA ocupa a tela. */
.te[data-te-fecho="colunas"] .te-fecho { text-align: left; }
.te[data-te-fecho="colunas"] .te-fecho-caixa {
  display: grid; grid-template-columns: minmax(0,1fr); gap: 2rem; max-width: 72rem;
  align-items: start;
}
.te[data-te-fecho="colunas"] .te-fecho-dados { margin-bottom: 0; }
.te[data-te-fecho="colunas"] .te-fecho-rodape { grid-column: 1 / -1; }

.te[data-te-fecho="tarja"] .te-fecho { padding-top: calc(var(--d-sec-y) * .55); }
.te[data-te-fecho="tarja"] .te-fecho-caixa { max-width: 72rem; }
.te[data-te-fecho="tarja"] .te-fecho-titulo {
  --te-titulo-tam: clamp(1.5rem, 3.5vw, 2.25rem);
  width: 100%; margin-bottom: 1.5rem; padding-block: 1.25rem;
  border-block: 3px double var(--d-border);
}
.te[data-te-fecho="tarja"] .te-fecho-cta { margin-bottom: 2rem; }
.te[data-te-fecho="tarja"] .te-fecho-dados {
  flex-direction: row; flex-wrap: wrap; justify-content: center; gap: .35rem 2rem;
}

.te[data-te-fecho="cartaz"] .te-fecho { padding-block: calc(var(--d-sec-y) * 1.15) 3rem; }
.te[data-te-fecho="cartaz"] .te-fecho-titulo { --te-titulo-tam: clamp(3rem, 11vw, 7.5rem); }
.te[data-te-fecho="cartaz"] .te-fecho-titulo .te-titulo { line-height: .92; letter-spacing: -.03em; }
.te[data-te-fecho="cartaz"] .te-fecho-cta { margin-bottom: 4rem; }

/* ── MANIFESTO ─────────────────────────────────────────────────────────
   alternado: pesos e itálico alternando (o desenho do material bruto).
   bloco:     um peso só, cerrado.
   marca:     à esquerda, com o acento na alternância.
   sussurro:  mono pequena, entre-letras larga — grito virando recado. */
.te[data-te-manifesto="bloco"] .te-manifesto-texto {
  --te-manifesto-tam: clamp(2rem, 6vw, 4.25rem);
  gap: .55rem 1.25rem;
}
.te[data-te-manifesto="bloco"] .te-manifesto-par {
  font-weight: 900; font-style: normal; color: var(--d-text);
}
.te[data-te-manifesto="marca"] .te-manifesto { justify-content: flex-start; }
.te[data-te-manifesto="marca"] .te-manifesto-caixa { width: 100%; text-align: left; }
.te[data-te-manifesto="marca"] .te-manifesto-texto {
  --te-manifesto-tam: clamp(2.5rem, 8vw, 6rem); justify-content: flex-start;
}
.te[data-te-manifesto="marca"] .te-manifesto-par { color: var(--d-accent); font-style: normal; }
.te[data-te-manifesto="sussurro"] .te-manifesto-texto {
  --te-manifesto-tam: clamp(.8125rem, 2.1vw, 1.125rem);
  font-family: var(--d-mono); font-weight: 400; letter-spacing: .38em; line-height: 2.2;
  text-transform: uppercase;
}
.te[data-te-manifesto="sussurro"] .te-manifesto-par { font-style: normal; }

/* ── PROTOCOLO ─────────────────────────────────────────────────────────
   linhas:   número à esquerda, texto à direita (o desenho do material bruto).
   colunas:  os quatro passos lado a lado.
   escada:   cada passo entra um degrau, com fio vertical.
   numerado: o número domina a linha. */
.te[data-te-protocolo="colunas"] .te-protocolo-caixa { max-width: 80rem; }
.te[data-te-protocolo="escada"] .te-passo {
  border-top: 0; border-left: 1px solid var(--d-border); padding-left: 1.5rem;
}
.te[data-te-protocolo="numerado"] .te-passo-num-texto {
  font-size: clamp(3.25rem, 9vw, 5.5rem); line-height: .85;
}

/* ── FAIXA ROLANTE ─────────────────────────────────────────────────── */
.te[data-te-faixa="estatica"] .te-faixa { justify-content: center; }
.te[data-te-faixa="estatica"] .te-faixa-trilho { animation: none; }

@media (min-width: 768px) {
  .te[data-te-abertura="cisao"] .te-hero {
    grid-template-columns: minmax(0,1.05fr) minmax(0,.95fr);
    column-gap: 3rem; min-height: 34rem; align-items: center;
  }
  .te[data-te-abertura="cisao"] .te-hero-foto { height: 100%; min-height: 30rem; }
  .te[data-te-abertura="ficha"] .te-hero-foto { height: 15rem; }

  .te[data-te-galeria="mural"] .te-galeria-lista { grid-template-columns: repeat(4, minmax(0,1fr)); }
  .te[data-te-galeria="tira"] .te-galeria-lista > .te-galeria-item { flex-basis: 32%; }
  .te[data-te-galeria="lista"] .te-galeria-peca {
    grid-template-columns: minmax(0,13rem) minmax(0,1fr); column-gap: 2.5rem; align-items: start;
  }
  .te[data-te-galeria="lista"] .te-galeria-legenda { order: -1; }

  .te[data-te-artista="indice"] .te-artista-texto { columns: 2; column-gap: 3rem; max-width: none; }
  .te[data-te-artista="indice"] .te-artista-tags-lista {
    grid-template-columns: repeat(5, minmax(0,1fr)); column-gap: 2rem;
  }
  .te[data-te-artista="faixa"] .te-artista-foto { aspect-ratio: 21/9; }
  .te[data-te-artista="faixa"] .te-artista-texto { columns: 2; column-gap: 3rem; max-width: none; }
  .te[data-te-artista="dossie"] .te-artista-foto { width: 10rem; max-width: 10rem; }

  .te[data-te-precos="tabela"] .te-precos-lista {
    display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); column-gap: 3.5rem;
  }
  .te[data-te-precos="cartoes"] .te-precos-lista {
    grid-template-columns: repeat(3, minmax(0,1fr)); gap: 1.25rem;
  }

  .te[data-te-provas="tira"] .te-provas-lista > .te-prova { flex-basis: 30%; }
  .te[data-te-provas="empilhado"] .te-provas-lista > .te-prova {
    display: grid; grid-template-columns: minmax(0,12rem) minmax(0,1fr);
    column-gap: 2.5rem; align-items: baseline;
  }
  .te[data-te-provas="empilhado"] .te-prova-autor { order: 0; }

  .te[data-te-fecho="colunas"] .te-fecho-caixa {
    grid-template-columns: minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr); column-gap: 3rem;
  }
  .te[data-te-fecho="colunas"] .te-fecho-cta { margin-bottom: 0; }

  .te[data-te-protocolo="colunas"] .te-protocolo-lista {
    display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); column-gap: 2rem;
  }
  .te[data-te-protocolo="colunas"] .te-passo { display: block; }
  .te[data-te-protocolo="colunas"] .te-passo-num { margin-bottom: 1rem; }
  /* O degrau usa o índice do passo, que a skin escreve como \`--te-passo-n\`:
     é o único knob que precisa saber a POSIÇÃO do item, e contador de CSS
     não serve para calcular margem. */
  .te[data-te-protocolo="escada"] .te-passo {
    display: block; margin-left: calc(var(--te-passo-n) * 3.25rem); padding-block: 1.5rem;
  }
  .te[data-te-protocolo="escada"] .te-passo-num { margin-bottom: .5rem; }
  .te[data-te-protocolo="numerado"] .te-passo-num { grid-column: span 3 / span 3; }
  .te[data-te-protocolo="numerado"] .te-passo-corpo { grid-column: span 9 / span 9; }
}

@media (max-width: 767px) {
  /* A abertura dividida STACKA no celular: numa coluna de meia largura o
     título espremeria, e o vídeo dentro das letras só se lê em letra
     grande. Aqui ele recebe a largura inteira, como nas outras três. */
  .te[data-te-abertura="cisao"] .te-hero-corpo { width: 100%; }
  .te[data-te-galeria="lista"] .te-galeria-lista { gap: 2.5rem; }
  .te[data-te-provas="citacao"] .te-provas-lista { gap: 3rem; }
}
`;

/**
 * A composição do material bruto — o que a skin renderiza quando o tema não
 * declara `tatuagem`. É exatamente o desenho que existia antes do eixo de
 * variante, e é o que a variante `sangue` declara.
 */
export const TATUAGEM_COMPOSICAO_PADRAO: TatuagemComposicao = {
  abertura: "monolito",
  galeria: "mosaico",
  artista: "retrato",
  precos: "lista",
  provas: "cartoes",
  fecho: "centralizado",
  manifesto: "alternado",
  protocolo: "linhas",
  faixa: "rolante",
  foto: "duro",
  letra: "vazada",
  letras: 100,
  veu: 85,
};
