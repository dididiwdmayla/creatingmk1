import type { ChapaComposicao } from "@/lib/demos/types";

/**
 * A COMPOSIÇÃO da `lancheria-chapa-burger`: cinco seções, quatro desenhos,
 * um caminho de render só.
 *
 * Cada knob de `ChapaComposicao` vira um `data-ch-*` no wrapper da skin e um
 * bloco de regras aqui. É o mesmo mecanismo de `TATUAGEM_COMPOSICAO_CSS` e
 * de `BARBEARIA_COMPOSICAO_CSS`, e existe pela mesma razão: o contrato de
 * seções é da SKIN, não da variante — se cada variante tivesse o seu render,
 * o `data-d-secao` deixaria de ser garantia e a aba Estrutura teria de saber
 * qual variante está aberta.
 *
 * REGRAS DE CASA:
 *
 * 1. **Sai no servidor.** Este CSS é renderizado junto com o HTML. Ordem,
 *    colunas e proporção mexem em layout; aplicar depois da hidratação é
 *    deslocamento de layout puro, que é o que `qa-cls.mjs` reprova.
 * 2. **Especificidade sem `!important`.** As regras competem com utilitárias
 *    do Tailwind (uma classe = 0,1,0; `md:` não soma nada), então os
 *    seletores de knob descem um nível a mais (`.ch[data-ch-x="y"] .filho`,
 *    0,3,0) em vez de gritar.
 * 3. **O LAYOUT mora aqui; a PINTURA, no componente.** Display, colunas,
 *    ordem, proporção e tamanho de caixa saem deste arquivo — inclusive os
 *    do desenho DEFAULT (`.ch .ch-prato`, sem atributo). Cor, fonte, raio e
 *    respiro continuam em utilitária no JSX. Sem essa divisão as regras de
 *    knob passariam a rodada inteira brigando com um `grid-cols-3` cravado
 *    no `className`.
 * 4. **Nenhuma composição esconde TEXTO.** Só UMA esconde imagem — a carta
 *    de bebidas da `sala`, que é tipográfica —, e ela está declarada em
 *    `SkinVariante.imagensOcultas` para o editor avisar quem sobe a foto.
 *    Os três flutuantes decorativos que `balcao` e `sala` não desenham nem
 *    chegam ao HTML (ver `floatVisivel` em ./Skin.tsx), pelo mesmo motivo.
 *    Sumir com conteúdo sem aviso parece defeito, não desenho.
 * 5. **Tamanho grande vem por token.** `--ch-hero-tam` e `--ch-hero-traco`
 *    existem porque o `font-size` e o `-webkit-text-stroke` do `<h1>`
 *    estavam em `style` inline, e inline vence folha de estilo.
 * 6. **A lente está nas quatro.** O raio é `--d-lente-raio` e muda por
 *    composição porque as caixas de foto mudam de tamanho — um círculo de
 *    56px dentro de uma miniatura de 64px não revela nada (ver §5.1 do
 *    plano). É o único knob que o JavaScript do card LÊ de volta.
 */
export const LANCHERIA_COMPOSICAO_CSS = `
/* ── Tokens de superfície ──────────────────────────────────────────────
   A lavagem sob a foto era \`bg-black/10\` cravado em dois componentes: em
   paleta clara isso é sujeira cinza. Aqui ela é a PRÓPRIA cor de fundo da
   variante, diluída — escurece no escuro e clareia no claro. */
.ch {
  --ch-foto-lavagem: color-mix(in srgb, var(--d-bg) 14%, transparent);
  --ch-hero-tam: clamp(3.25rem, 13vw, 9rem);
  --ch-hero-traco: 8px;
  --ch-hero-sombra: drop-shadow(10px 10px 0px var(--d-bg));
  --ch-hero-cor: var(--d-accent-2);
  --ch-campo: transparent;
  --ch-veu-dir: to right;
  --d-lente-raio: 56px;
}

/* ── Esqueleto default (chapa) ─────────────────────────────────────────
   O desenho do material bruto, escrito aqui em vez de em utilitária: é o
   que as outras três sobrescrevem. */
.ch .ch-hero { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ch .ch-hero-fundo { position: absolute; inset: 0; z-index: 0; }
.ch .ch-hero-veu {
  position: absolute; inset: 0;
  background: linear-gradient(var(--ch-veu-dir),
    var(--d-bg) 0%,
    color-mix(in srgb, var(--d-bg) 70%, transparent) 55%,
    color-mix(in srgb, var(--d-bg) 30%, transparent) 100%);
}
.ch .ch-hero-corpo { position: relative; z-index: 20; display: flex; flex-direction: column; width: 100%; }
.ch .ch-hero-role { position: absolute; bottom: 1.5rem; left: 50%; transform: translateX(-50%); z-index: 20; }

.ch .ch-cardapio-lista { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
.ch .ch-prato {
  position: relative; display: grid; grid-template-columns: minmax(0, 1fr);
  grid-template-areas: "foto" "corpo" "rodape"; gap: 1rem; align-content: start;
}
.ch .ch-prato-foto { position: relative; width: 100%; height: 12rem; overflow: hidden; }
.ch .ch-prato-corpo { grid-area: corpo; display: flex; flex-direction: column; justify-content: center; min-width: 0; }
.ch .ch-prato-rodape { grid-area: rodape; display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
/* A frase do hover ocupa a MESMA área de grade da foto: sobrepõe sem
   coordenada e sem ficar presa ao \`overflow: hidden\` da caixa da foto. */
.ch .ch-prato-frase {
  grid-area: foto; align-self: start; justify-self: center; z-index: 30;
  display: flex; justify-content: center; margin-top: .5rem;
}

/* Sangra até a borda da tela no celular (o trilho do material bruto corre
   de ponta a ponta); volta à caixa da seção no desktop. */
.ch .ch-lista {
  display: flex; gap: 1rem; overflow-x: auto;
  width: calc(100% + 2rem); margin-inline: -1rem; padding-inline: 1rem;
}
.ch .ch-item { display: flex; flex-direction: column; flex: 0 0 auto; width: 150px; }
.ch .ch-item-foto { position: relative; width: 100%; aspect-ratio: 1; margin-bottom: .75rem; }
.ch .ch-item-corpo { display: flex; flex: 1 1 auto; flex-direction: column; min-width: 0; }
.ch .ch-item-rodape { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: .5rem; }

/* A tarja de esmaecimento é a dica de que a lista CORRE. Composição que
   não rola (chips, carta, grade4, quadros, linha) não tem o que esmaecer —
   e a tarja ficava por cima do último item, comendo o botão dele. */
.ch .ch-lista-fade { display: none; }
.ch .ch-contato-caixa { display: flex; flex-direction: column; align-items: center; gap: 3rem; }
.ch .ch-contato-rodape { display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 1rem; }
.ch .ch-dados { display: flex; flex-direction: column; gap: .75rem; }
.ch .ch-dado { display: flex; flex-direction: column; gap: .15rem; }
/* <dd> nasce com 40px de recuo no navegador; a escada alinha pelo rótulo. */
.ch .ch-dado-valor { margin: 0; }

/* ── ABERTURA ──────────────────────────────────────────────────────────
   cartaz: tela cheia, foto sangrada, nome contornado por cima (o desenho
           do material bruto).
   ficha:  cartão de balcão — faixa de foto baixa, nome, e as linhas de
           dado (endereço, horário) num cartão. Sem foto grande.
   cisao:  a foto ocupa metade, a tipografia sóbria ocupa a outra.
   pilha:  o nome ocupa a tela sobre campo de cor; a foto vira selo. */
.ch[data-ch-abertura="ficha"] .ch-hero,
.ch[data-ch-abertura="cisao"] .ch-hero,
.ch[data-ch-abertura="pilha"] .ch-hero { min-height: 0; }
.ch[data-ch-abertura="ficha"] .ch-hero-veu,
.ch[data-ch-abertura="pilha"] .ch-hero-veu { display: none; }
.ch[data-ch-abertura="ficha"] .ch-hero-fundo,
.ch[data-ch-abertura="cisao"] .ch-hero-fundo,
.ch[data-ch-abertura="pilha"] .ch-hero-fundo { position: relative; inset: auto; }
/* \`order\` decide a colocação na grade, e o indicador de rolagem é o último
   filho do hero — sem esta linha ele cai ANTES do corpo (order 0 < 1) e o
   "ROLE" abre a abertura em vez de fechá-la. */
.ch[data-ch-abertura="ficha"] .ch-hero-role,
.ch[data-ch-abertura="cisao"] .ch-hero-role,
.ch[data-ch-abertura="pilha"] .ch-hero-role {
  position: static; transform: none; margin-top: 2rem; order: 3;
  justify-self: center; align-self: center;
}

.ch[data-ch-abertura="ficha"] .ch-hero {
  display: grid; grid-template-columns: minmax(0, 1fr); row-gap: 1.75rem;
  align-content: start; padding: 6.5rem 1rem 3rem;
}
.ch[data-ch-abertura="ficha"] {
  --ch-hero-tam: clamp(2.25rem, 8vw, 4rem);
  --ch-hero-traco: 3px;
  --ch-hero-sombra: drop-shadow(4px 4px 0px var(--d-bg));
}
.ch[data-ch-abertura="ficha"] .ch-hero-fundo {
  order: 1; height: 10rem; width: 100%; overflow: hidden;
  border-radius: calc(var(--d-radius) * .7);
}
.ch[data-ch-abertura="ficha"] .ch-hero-corpo { order: 2; align-items: flex-start; text-align: left; }
.ch[data-ch-abertura="ficha"] .ch-ficha {
  width: 100%; border: 1px solid var(--d-border); background: var(--d-bg-elev);
  border-radius: calc(var(--d-radius) * .6); padding: 1.1rem 1.25rem;
  /* Respiro do CTA: a sombra da pílula encostava na borda do cartão. */
  margin-top: 1.75rem;
}
.ch[data-ch-abertura="ficha"] .ch-ficha .ch-dado + .ch-dado {
  border-top: 1px solid var(--d-border); padding-top: .7rem;
}

.ch[data-ch-abertura="cisao"] .ch-hero {
  display: grid; grid-template-columns: minmax(0, 1fr); row-gap: 2rem;
  align-content: center; padding: 7rem 1rem 3.5rem;
}
.ch[data-ch-abertura="cisao"] {
  --ch-hero-tam: clamp(2.5rem, 9vw, 5rem);
  --ch-hero-traco: 0px;
  --ch-hero-sombra: none;
  --ch-hero-cor: var(--d-text);
}
.ch[data-ch-abertura="cisao"] .ch-hero-fundo { order: 2; height: 17rem; width: 100%; overflow: hidden; }
.ch[data-ch-abertura="cisao"] .ch-hero-veu {
  background: linear-gradient(to top, color-mix(in srgb, var(--d-bg) 55%, transparent), transparent 60%);
}
.ch[data-ch-abertura="cisao"] .ch-hero-corpo { order: 1; align-items: flex-start; text-align: left; }

.ch[data-ch-abertura="pilha"] .ch-hero {
  display: grid; grid-template-columns: minmax(0, 1fr); row-gap: 1.5rem;
  align-content: center; justify-items: center; padding: 7rem 1rem 3rem;
  background: var(--ch-campo);
}
/* O campo é a cor de AÇÃO e a tinta é o \`destaqueInk\` dela: esse par é o
   único da paleta que a Forja garante legível um sobre o outro, em claro e
   em escuro. Com \`acentoSecundario\` + \`fundo\` a pilha ficava amarelo sobre
   creme numa variante clara. */
.ch[data-ch-abertura="pilha"] {
  --ch-campo: var(--d-accent);
  --ch-hero-cor: var(--d-accent-ink);
  --ch-hero-tam: clamp(3.5rem, 17vw, 8rem);
  --ch-hero-traco: 0px;
  --ch-hero-sombra: drop-shadow(6px 6px 0px color-mix(in srgb, var(--d-bg) 22%, transparent));
}
.ch[data-ch-abertura="pilha"] .ch-hero-corpo { order: 1; align-items: center; text-align: center; }
.ch[data-ch-abertura="pilha"] .ch-hero-fundo {
  order: 2; width: 9rem; height: 9rem; border-radius: 9999px; overflow: hidden;
  border: 4px solid var(--d-bg);
}
/* Tudo que cai no campo de cor troca de tinta junto — inclusive o CTA,
   que é da cor do campo e sumiria nele. */
.ch[data-ch-abertura="pilha"] .ch-hero-texto,
.ch[data-ch-abertura="pilha"] .ch-hero-role { color: var(--d-accent-ink); opacity: .88; }
.ch[data-ch-abertura="pilha"] .ch-hero-cta {
  background: var(--d-accent-ink); color: var(--d-accent);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--d-bg) 25%, transparent);
}
.ch[data-ch-abertura="pilha"] .ch-hero-fundo { border-color: var(--d-accent-ink); }

/* ── CARDÁPIO ──────────────────────────────────────────────────────────
   grade:     três colunas de cards com lente no hover (material bruto).
   comanda:   uma coluna, miniatura de 64px, preço à direita.
   editorial: um por linha, foto grande alternando de lado, descrição longa.
   mural:     duas colunas, preço sobre a foto. */
/* O raio acompanha a CAIXA da foto: 56px dentro de uma miniatura de 64px
   cobriria tudo de uma vez, e 56px numa foto editorial de 16/10 seria um
   furo de alfinete. Quem lê o token de volta é o card (ver
   ./interactive/BurgerCard.tsx). */
.ch[data-ch-cardapio="comanda"] { --d-lente-raio: 26px; }
.ch[data-ch-cardapio="editorial"] { --d-lente-raio: 110px; }
.ch[data-ch-cardapio="mural"] { --d-lente-raio: 72px; }

/* Onde a frase do hover abre, por composição. Na comanda ela NÃO cabe
   dentro da miniatura, então vai para o lado da linha; nas outras três
   fica dentro da caixa da foto, em cantos diferentes. */
.ch[data-ch-cardapio="comanda"] .ch-prato { cursor: crosshair; }
/* A frase sobe para a linha do NOME e ganha fundo: sem isso ela caía em
   cima da descrição, e duas linhas de texto uma sobre a outra não se leem
   (ver item9/balcao--desktop--lente.png). */
.ch[data-ch-cardapio="comanda"] .ch-prato-frase {
  grid-area: corpo; justify-self: end; align-self: start; margin-top: 0;
  background: var(--d-bg); border-radius: 9999px; padding: .1rem .6rem;
}
/* O giro de -6deg joga a ponta esquerda da frase para fora, e a caixa do
   cartão tem \`overflow: hidden\`: a margem cobre o que o giro rouba. */
.ch[data-ch-cardapio="editorial"] .ch-prato-frase {
  justify-self: start; margin: 1rem 0 0 1.4rem;
}
.ch[data-ch-cardapio="mural"] .ch-prato-frase { margin-top: 2.4rem; }

.ch[data-ch-cardapio="comanda"] .ch-cardapio-lista {
  gap: 0; max-width: 46rem; margin-inline: auto;
}
.ch[data-ch-cardapio="comanda"] .ch-prato {
  grid-template-columns: 64px minmax(0, 1fr);
  grid-template-areas: "foto corpo" "foto rodape";
  gap: .35rem .9rem; align-items: center; padding-block: .9rem;
  border-radius: 0; background: transparent; box-shadow: none;
  border: 0; border-bottom: 1px solid var(--d-border);
}
.ch[data-ch-cardapio="comanda"] .ch-prato-foto {
  grid-area: foto; align-self: center; width: 64px; height: 64px;
  border-radius: calc(var(--d-radius) * .4);
}
.ch[data-ch-cardapio="comanda"] .ch-prato-rodape { justify-content: flex-start; }
.ch[data-ch-cardapio="comanda"] .ch-prato-preco { margin-left: auto; order: 2; }

.ch[data-ch-cardapio="editorial"] .ch-cardapio-lista {
  gap: 3.5rem; max-width: 62rem; margin-inline: auto;
}
.ch[data-ch-cardapio="editorial"] .ch-prato {
  gap: 1.25rem; padding: 0; border: 0; border-radius: 0;
  background: transparent; box-shadow: none;
}
.ch[data-ch-cardapio="editorial"] .ch-prato-foto {
  height: auto; aspect-ratio: 16 / 10; border-radius: calc(var(--d-radius) * .5);
}
.ch[data-ch-cardapio="editorial"] .ch-prato-rodape { justify-content: flex-start; gap: 1.5rem; }

.ch[data-ch-cardapio="mural"] .ch-cardapio-lista {
  grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem;
}
.ch[data-ch-cardapio="mural"] .ch-prato {
  gap: .6rem; padding: 0; overflow: hidden;
}
.ch[data-ch-cardapio="mural"] .ch-prato-foto {
  height: auto; aspect-ratio: 1; border-radius: 0;
}
.ch[data-ch-cardapio="mural"] .ch-prato-corpo { padding: 0 .75rem; }
.ch[data-ch-cardapio="mural"] .ch-prato-rodape { padding: 0 .75rem .9rem; }
/* SÓ o preço vai pra cima da foto. O primeiro desenho levava o botão
   junto, e num cartão de 170px (duas colunas no celular) a pílula
   "ESCOLHER" saía pela borda direita, cortada pelo \`overflow: hidden\`. */
.ch[data-ch-cardapio="mural"] .ch-prato-preco {
  position: absolute; top: .5rem; left: .5rem; z-index: 20;
  background: color-mix(in srgb, var(--d-bg) 82%, transparent);
  border-radius: 9999px; padding: .15rem .6rem;
}

/* ── BEBIDAS ───────────────────────────────────────────────────────────
   trilho: cards de 150/180px correndo na horizontal (material bruto).
   chips:  pílulas em linha, miniatura de 28px.
   carta:  carta tipográfica — a única composição SEM foto (declarada).
   grade4: grade quadrada de 4 colunas. */
.ch[data-ch-bebidas="chips"] .ch-bebidas .ch-lista {
  flex-wrap: wrap; gap: .5rem; overflow: visible;
}
.ch[data-ch-bebidas="chips"] .ch-bebidas .ch-item {
  width: auto; flex-direction: row; align-items: center; gap: .6rem;
  border-radius: 9999px; padding: .35rem .85rem .35rem .4rem;
}
.ch[data-ch-bebidas="chips"] .ch-bebidas .ch-item-foto { width: 28px; margin-bottom: 0; }
.ch[data-ch-bebidas="chips"] .ch-bebidas .ch-item-corpo {
  flex-direction: row; align-items: center; gap: .6rem; flex: 0 0 auto;
}
.ch[data-ch-bebidas="chips"] .ch-bebidas .ch-item-titulo { margin-bottom: 0; }
.ch[data-ch-bebidas="chips"] .ch-bebidas .ch-item-rodape { margin-top: 0; gap: .6rem; }

.ch[data-ch-bebidas="carta"] .ch-bebidas .ch-lista {
  display: grid; grid-template-columns: minmax(0, 1fr); gap: 0;
  overflow: visible; max-width: 40rem;
}
.ch[data-ch-bebidas="carta"] .ch-bebidas .ch-item {
  width: auto; flex-direction: row; align-items: baseline; gap: 1rem;
  border: 0; border-bottom: 1px solid var(--d-border); border-radius: 0;
  background: transparent; box-shadow: none; padding: .8rem 0;
}
.ch[data-ch-bebidas="carta"] .ch-bebidas .ch-item-foto { display: none; }
.ch[data-ch-bebidas="carta"] .ch-bebidas .ch-item-corpo { flex-direction: row; align-items: baseline; gap: 1rem; }
.ch[data-ch-bebidas="carta"] .ch-bebidas .ch-item-titulo { margin-bottom: 0; }
.ch[data-ch-bebidas="carta"] .ch-bebidas .ch-item-rodape { margin-top: 0; margin-left: auto; gap: 1rem; }

.ch[data-ch-bebidas="grade4"] .ch-bebidas .ch-lista {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .75rem; overflow: visible;
}
.ch[data-ch-bebidas="grade4"] .ch-bebidas .ch-item { width: auto; }

/* ── ACOMPANHAMENTOS ───────────────────────────────────────────────────
   trilho:  igual às bebidas (material bruto).
   quadros: quadrinhos em grade cerrada.
   linha:   linha discreta, miniatura de 20px, sob o cardápio.
   tira:    tira sangrada que rola de ponta a ponta. */
.ch[data-ch-acomp="quadros"] .ch-acomp .ch-lista {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: .5rem; overflow: visible;
}
.ch[data-ch-acomp="quadros"] .ch-acomp .ch-item { width: auto; padding: .5rem; }
.ch[data-ch-acomp="quadros"] .ch-acomp .ch-lista-caixa { max-width: 34rem; }
.ch[data-ch-acomp="quadros"] .ch-acomp .ch-item-foto { margin-bottom: .5rem; }

.ch[data-ch-acomp="linha"] .ch-acomp .ch-lista {
  flex-wrap: wrap; gap: .1rem 1.75rem; overflow: visible;
}
.ch[data-ch-acomp="linha"] .ch-acomp .ch-item {
  width: auto; flex-direction: row; align-items: center; gap: .55rem;
  border: 0; border-radius: 0; background: transparent; box-shadow: none;
  padding: .3rem 0;
}
.ch[data-ch-acomp="linha"] .ch-acomp .ch-item-foto { width: 20px; margin-bottom: 0; }
.ch[data-ch-acomp="linha"] .ch-acomp .ch-item-corpo { flex-direction: row; align-items: center; gap: .55rem; flex: 0 0 auto; }
.ch[data-ch-acomp="linha"] .ch-acomp .ch-item-titulo { margin-bottom: 0; }
.ch[data-ch-acomp="linha"] .ch-acomp .ch-item-rodape { margin-top: 0; gap: .55rem; }

.ch[data-ch-acomp="tira"] .ch-acomp .ch-lista {
  gap: .5rem; scroll-snap-type: x mandatory;
  width: calc(100% + 2rem); margin-inline: -1rem; padding-inline: 1rem;
}
.ch[data-ch-acomp="tira"] .ch-acomp .ch-item {
  flex: 0 0 62%; width: auto; flex-direction: row; align-items: center;
  gap: .75rem; scroll-snap-align: start; border-radius: calc(var(--d-radius) * .35);
}
.ch[data-ch-acomp="tira"] .ch-acomp .ch-item-foto { width: 72px; flex: 0 0 72px; margin-bottom: 0; }

/* ── CONTATO ───────────────────────────────────────────────────────────
   rodape: três colunas + barra de copyright (material bruto).
   tarja:  uma linha só, tudo na mesma altura.
   fecho:  bloco central com o CTA grande.
   bloco:  "onde estamos hoje" — vira <section> e sobe pro topo da página. */
.ch[data-ch-contato="tarja"] .ch-contato-caixa {
  flex-direction: row; flex-wrap: wrap; align-items: center;
  justify-content: space-between; gap: .75rem 2rem; margin-bottom: 1.25rem;
}
.ch[data-ch-contato="tarja"] .ch-contato-marca { align-items: flex-start; text-align: left; }
.ch[data-ch-contato="tarja"] .ch-contato-acao { flex-direction: row; align-items: center; gap: 1rem; }
.ch[data-ch-contato="tarja"] .ch-contato-titulo { margin-bottom: 0; }

.ch[data-ch-contato="fecho"] .ch-contato-caixa {
  max-width: 44rem; gap: 1.5rem; text-align: center; margin-bottom: 3rem;
}
.ch[data-ch-contato="fecho"] .ch-contato-acao { align-items: center; }
.ch[data-ch-contato="fecho"] .ch-dados { align-items: center; text-align: center; }
.ch[data-ch-contato="fecho"] .ch-dado { align-items: center; }

.ch[data-ch-contato="bloco"] .ch-contato-caixa {
  align-items: stretch; gap: 1.5rem; text-align: left; margin-bottom: 1.5rem;
}
.ch[data-ch-contato="bloco"] .ch-contato-marca,
.ch[data-ch-contato="bloco"] .ch-contato-acao { align-items: flex-start; text-align: left; }
.ch[data-ch-contato="bloco"] .ch-dados {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem;
}
/* A seção ABRE a página: borda grossa em cima seria o segundo fio logo
   abaixo do hero. Ela desce e vira o fio que separa o bloco do cardápio. */
.ch[data-ch-contato="bloco"] .ch-contato {
  border-top-width: 0; border-bottom: 8px solid var(--d-accent-2);
  padding-top: 2.5rem;
}

@media (min-width: 640px) {
  .ch .ch-prato {
    grid-template-columns: 7rem minmax(0, 1fr);
    grid-template-areas: "foto corpo" "foto rodape";
    align-items: center;
  }
  .ch .ch-prato-foto { grid-area: foto; height: 7rem; }
  /* As TRÊS áreas, não duas: sem "rodape" no mapa, o botão era colocado
     automaticamente numa coluna implícita e abria uma faixa branca ao lado
     da foto (item11/praca--desktop--pagina.png). */
  .ch[data-ch-cardapio="mural"] .ch-prato {
    grid-template-columns: minmax(0, 1fr); grid-template-areas: "foto" "corpo" "rodape";
  }
  .ch[data-ch-cardapio="mural"] .ch-prato-foto { height: auto; }
  .ch[data-ch-cardapio="editorial"] .ch-prato-foto { height: auto; }
  .ch[data-ch-cardapio="comanda"] .ch-prato-foto { height: 64px; }
}

@media (min-width: 768px) {
  .ch .ch-cardapio-lista { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2rem; }
  .ch .ch-lista { width: auto; margin-inline: 0; padding-inline: 0; }
  .ch[data-ch-bebidas="trilho"] .ch-bebidas .ch-lista-fade,
  .ch[data-ch-acomp="trilho"] .ch-acomp .ch-lista-fade,
  .ch[data-ch-acomp="tira"] .ch-acomp .ch-lista-fade { display: block; }
  .ch .ch-item { width: 180px; }
  .ch .ch-contato-caixa { flex-direction: row; justify-content: space-between; align-items: flex-start; }
  .ch .ch-contato-rodape { flex-direction: row; align-items: center; }

  .ch[data-ch-abertura="ficha"] .ch-hero {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr);
    column-gap: 3rem; align-items: center; padding-block: 8rem 4rem;
  }
  .ch[data-ch-abertura="ficha"] .ch-hero-fundo { order: 2; height: 100%; min-height: 20rem; }
  .ch[data-ch-abertura="ficha"] .ch-hero-corpo { order: 1; }
  .ch[data-ch-abertura="ficha"] .ch-hero-role { grid-column: 1 / -1; }

  .ch[data-ch-abertura="cisao"] .ch-hero {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    column-gap: 3.5rem; min-height: 34rem; align-items: center; padding-block: 9rem 4rem;
  }
  .ch[data-ch-abertura="cisao"] .ch-hero-fundo { height: 100%; min-height: 28rem; }
  .ch[data-ch-abertura="cisao"] .ch-hero-role { grid-column: 1 / -1; }

  .ch[data-ch-abertura="pilha"] .ch-hero { padding-block: 9rem 4rem; }
  .ch[data-ch-abertura="pilha"] .ch-hero-fundo { width: 11rem; height: 11rem; }

  .ch[data-ch-cardapio="comanda"] .ch-cardapio-lista,
  .ch[data-ch-cardapio="editorial"] .ch-cardapio-lista { grid-template-columns: minmax(0, 1fr); }
  .ch[data-ch-cardapio="comanda"] .ch-prato {
    grid-template-columns: 64px minmax(0, 1fr) auto;
    grid-template-areas: "foto corpo rodape";
    column-gap: 1.25rem;
  }
  .ch[data-ch-cardapio="comanda"] .ch-prato-rodape {
    grid-area: rodape; flex-direction: row-reverse; gap: 1.25rem; justify-content: flex-start;
  }
  .ch[data-ch-cardapio="comanda"] .ch-prato-preco { margin-left: 0; order: 0; }

  .ch[data-ch-cardapio="editorial"] .ch-prato {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr);
    grid-template-areas: "foto corpo" "foto rodape";
    column-gap: 2.5rem; align-items: center;
  }
  .ch[data-ch-cardapio="editorial"] .ch-prato:nth-child(even) {
    grid-template-areas: "corpo foto" "rodape foto";
    grid-template-columns: minmax(0, .95fr) minmax(0, 1.05fr);
  }
  .ch[data-ch-cardapio="editorial"] .ch-prato-rodape { align-self: start; }

  /* DUAS colunas também no desktop: em três, o mural viraria a grade da
     chapa e o eixo de drasticidade do cardápio perderia um dos quatro. */
  .ch[data-ch-cardapio="mural"] .ch-cardapio-lista { gap: 1rem; }

  .ch[data-ch-bebidas="grade4"] .ch-bebidas .ch-lista { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .ch[data-ch-acomp="quadros"] .ch-acomp .ch-lista { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .ch[data-ch-acomp="tira"] .ch-acomp .ch-item { flex-basis: 30%; }

  .ch[data-ch-contato="fecho"] .ch-contato-caixa { flex-direction: column; align-items: center; margin-inline: auto; }
  .ch[data-ch-contato="bloco"] .ch-contato-caixa { align-items: flex-start; }
  .ch[data-ch-contato="bloco"] .ch-dados { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (min-width: 1024px) {
  .ch .ch-cardapio-lista { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .ch[data-ch-cardapio="comanda"] .ch-cardapio-lista,
  .ch[data-ch-cardapio="editorial"] .ch-cardapio-lista { grid-template-columns: minmax(0, 1fr); }
}
/* ── Alinhamento da abertura (aba Tema) ────────────────────────────────
   \`heroTitulo.alinhamento\` é escolha do OPERADOR, e a composição também
   tem opinião sobre ela (a ficha e a cisão nascem à esquerda, o cartaz e a
   pilha no centro). Quem vence é o operador — por isso este bloco desce um
   nível a mais (0,4,0) que os de knob (0,3,0) e não mora dentro de media
   query nenhuma. */
.ch[data-ch-hero-al="esquerda"] .ch-hero .ch-hero-corpo { align-items: flex-start; text-align: left; }
.ch[data-ch-hero-al="centro"] .ch-hero .ch-hero-corpo { align-items: center; text-align: center; }
.ch[data-ch-hero-al="direita"] .ch-hero .ch-hero-corpo { align-items: flex-end; text-align: right; }
`;

/**
 * A composição do material bruto — o que a skin renderiza quando o tema não
 * declara `chapa`. É exatamente o desenho que existia antes do eixo de
 * variante, e é o que a variante `chapa` declara.
 */
export const LANCHERIA_COMPOSICAO_PADRAO: ChapaComposicao = {
  abertura: "cartaz",
  cardapio: "grade",
  bebidas: "trilho",
  acompanhamentos: "trilho",
  contato: "rodape",
};
