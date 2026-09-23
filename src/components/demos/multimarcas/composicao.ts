import type { MultimarcasComposicao } from "@/lib/demos/types";

/**
 * A COMPOSIÇÃO da `multimarcas-vortice`: nove seções, quatro desenhos, um
 * caminho de render só (docs/plano-multimarcas.md §6).
 *
 * Cada knob de `MultimarcasComposicao` vira um `data-mm-*` no wrapper da
 * skin e um bloco de regras aqui — o mesmo mecanismo de
 * `LANCHERIA_COMPOSICAO_CSS` (chapa burger), `TATUAGEM_COMPOSICAO_CSS` e
 * `BARBEARIA_COMPOSICAO_CSS`, pela mesma razão: o contrato de seções é da
 * SKIN, não da variante. Se cada variante tivesse o seu render, o
 * `data-d-secao` deixaria de ser garantia e a aba Estrutura teria de saber
 * qual variante está aberta.
 *
 * REGRAS DE CASA (as da chapa, que valem igual aqui):
 *
 * 1. **Sai no servidor.** Este CSS é renderizado junto com o HTML: ordem,
 *    colunas e proporção são layout, e aplicá-los depois da hidratação é
 *    deslocamento de layout, que `qa-cls.mjs` reprova.
 * 2. **Especificidade sem `!important`.** As regras competem com
 *    utilitárias do Tailwind (0,1,0), então o desenho default desce um
 *    nível (`.mm .mm-x`, 0,2,0) e os knobs dois (`.mm[data-mm-k="v"] .mm-x`,
 *    0,3,0).
 * 3. **O LAYOUT mora aqui; a PINTURA, no componente.** Display, colunas,
 *    ordem, proporção e o TAMANHO do que muda de tamanho entre as
 *    composições saem deste arquivo — inclusive os do desenho default.
 *    Cor, família de fonte, raio e o resto continuam em utilitária no JSX.
 * 4. **Nenhuma composição esconde TEXTO.** A única imagem que duas
 *    composições não desenham (`hero`, na abertura tipográfica e na busca)
 *    nem chega ao HTML, e está declarada em `SkinVariante.imagensOcultas`.
 */
export const MULTIMARCAS_COMPOSICAO_CSS = `
/* ── Esqueleto default (vórtice) ───────────────────────────────────────
   O desenho do material bruto, escrito aqui em vez de em utilitária: é o
   que as outras três composições sobrescrevem. */
.mm .mm-caixa { max-width: 1200px; margin-inline: auto; width: 100%; }
.mm .mm-cabeca { margin-bottom: 2.75rem; }

/* Abertura: tela cheia tipográfica. */
.mm .mm-hero {
  position: relative; display: flex; flex-direction: column; justify-content: center;
  min-height: 100svh; overflow: hidden;
  padding: 120px max(24px, 5vw) 90px;
}
.mm .mm-hero-corpo { position: relative; z-index: 2; display: flex; flex-direction: column; width: 100%; max-width: 1200px; margin-inline: auto; }
.mm .mm-hero-h1 { font-size: calc(clamp(42px, 9.6vw, 124px) * var(--d-hero-escala)); }
.mm .mm-hero-diagonal { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.mm .mm-hero-gauge {
  position: absolute; z-index: 3; display: flex; align-items: center; gap: .625rem; opacity: .9;
  top: calc(86px + env(safe-area-inset-top)); right: max(24px, 5vw);
}
.mm .mm-gauge-svg { display: block; width: 54px; height: auto; }

/* ── O PAINEL DE INSTRUMENTOS em quatro escalas (§3 do plano) ──────────
   selo (acima, o default) · marcador ao lado das faixas da busca ·
   mostrador grande no pé da foto sangrada · canto da moldura dividida.
   A escala vem em \`data-escala\` (ver ./interactive/Mostrador.tsx). */
.mm .mm-hero-busca { display: flex; align-items: center; gap: .9rem; margin-bottom: 2rem; }
.mm .mm-hero-busca .mm-hero-faixas { margin-bottom: 0; flex: 1 1 auto; }
.mm .mm-hero-gauge[data-escala="marcador"] {
  position: static; flex-direction: column; gap: .2rem; opacity: 1; flex: none;
}
.mm .mm-hero-gauge[data-escala="marcador"] .mm-gauge-svg { width: 58px; }
.mm .mm-hero-gauge[data-escala="mostrador"] { top: auto; bottom: 1.25rem; opacity: 1; }
.mm .mm-hero-gauge[data-escala="mostrador"] .mm-gauge-svg { width: clamp(118px, 19vw, 210px); }
.mm .mm-hero-gauge[data-escala="canto"] { top: auto; right: auto; bottom: .75rem; left: .75rem; opacity: 1; }
.mm .mm-hero-gauge[data-escala="canto"] .mm-gauge-svg { width: clamp(84px, 11vw, 116px); }
.mm .mm-hero-chev {
  position: absolute; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center;
  bottom: calc(22px + env(safe-area-inset-bottom));
}

/* Estoque: grade de 3 colunas (auto-fill 288px) de cards verticais. */
.mm .mm-carros { display: grid; grid-template-columns: repeat(auto-fill, minmax(288px, 1fr)); gap: 22px; }
.mm .mm-carro { display: flex; flex-direction: column; overflow: hidden; height: 100%; }
.mm .mm-carro-foto { position: relative; aspect-ratio: 16 / 10; overflow: hidden; }
.mm .mm-carro-corpo { display: flex; flex-direction: column; gap: .75rem; padding: 18px 18px 20px; }
.mm .mm-carro-preco { display: flex; align-items: baseline; gap: .375rem; }
.mm .mm-carro-chips { display: flex; flex-wrap: wrap; gap: .375rem; }

/* Vantagens: grade de 4 cartões numerados. */
.mm .mm-vantagens { padding: var(--d-sec-y) max(24px, 5vw) 2.5rem; }
.mm .mm-vant-lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 18px; }
.mm .mm-vant-item { display: flex; flex-direction: column; gap: 1rem; height: 100%; padding: 1.75rem; }
.mm .mm-vant-num { display: flex; align-items: center; justify-content: center; width: 54px; height: 54px; font-size: 22px; flex: none; }

/* Números: linha de 3 contadores. O respiro é PRÓPRIO — antes era \`pt-3\`
   e dependia de \`vantagens\` estar logo acima (§1, "Três achados"). */
.mm .mm-numeros { padding: calc(var(--d-sec-y) * .6) max(24px, 5vw) var(--d-sec-y); }
.mm .mm-num-lista { display: flex; flex-wrap: wrap; gap: clamp(28px, 6vw, 80px); }
.mm .mm-num-valor { font-size: clamp(38px, 4.6vw, 56px); line-height: 1; }

/* Destaque: cartão horizontal, foto metade + ficha. */
.mm .mm-destaque { padding: var(--d-sec-y) max(24px, 5vw); }
.mm .mm-dest-grade { display: grid; gap: 2.5rem; grid-template-columns: minmax(0, 1fr); align-items: center; }
.mm .mm-dest-foto { position: relative; aspect-ratio: 4 / 3; overflow: hidden; }
.mm .mm-dest-titulo { font-size: clamp(30px, 4.6vw, 48px); }
.mm .mm-ficha { display: flex; flex-direction: column; gap: .625rem; margin: 1.5rem 0 0; padding-top: 1.25rem; }
.mm .mm-ficha-linha { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
.mm .mm-ficha-linha dd { margin: 0; }

/* Simulador: dois cartões lado a lado. */
.mm .mm-simulador { padding: var(--d-sec-y) max(24px, 5vw); }
.mm .mm-sim { display: grid; align-items: start; gap: 22px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.mm .mm-sim-controles { display: flex; flex-direction: column; gap: 30px; padding: clamp(24px, 4vw, 36px); }
.mm .mm-sim-resultado { display: flex; flex-direction: column; gap: 18px; padding: clamp(24px, 4vw, 36px); }
.mm .mm-sim-controles, .mm .mm-sim-resultado { border-radius: var(--d-radius); }
.mm .mm-sim-parcela { font-size: clamp(48px, 6.5vw, 66px); }

/* Avaliação: faixa inteira no acento + marquee de marcas. */
.mm .mm-avaliacao { overflow: hidden; padding-top: clamp(60px, 8vw, 100px); }
.mm .mm-aval-caixa {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1.75rem;
  padding-inline: max(24px, 5vw);
}
.mm .mm-aval-titulo { font-size: clamp(38px, 6.4vw, 74px); line-height: 1; }
.mm .mm-aval-acao { flex: none; }

/* Depoimentos: carrossel arrastável. */
.mm .mm-depoimentos { padding: var(--d-sec-y) max(24px, 5vw); }
.mm .mm-dep-janela { overflow: hidden; }
.mm .mm-dep-trilho { display: flex; gap: 20px; }
.mm .mm-dep-item { display: flex; flex-direction: column; gap: 18px; flex: none; width: min(360px, 82vw); margin: 0; padding: 1.75rem; }
.mm .mm-dep-texto { font-size: 15.5px; line-height: 1.65; }
.mm .mm-dep-autor { display: flex; align-items: center; gap: .875rem; margin-top: auto; }

/* Contato: rodapé em duas colunas + barra com wordmark. */
.mm .mm-contato-secao { padding: var(--d-sec-y) max(24px, 5vw) clamp(50px, 6vw, 80px); }
.mm .mm-contato-caixa { display: grid; gap: 2.5rem; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.mm .mm-contato-caixa.mm-sem-grade { display: block; }
.mm .mm-contato-acoes { display: flex; flex-direction: column; gap: .75rem; }
.mm .mm-contato-barra {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1.5rem;
  margin-top: clamp(60px, 8vw, 100px); padding-top: 34px;
}

/* ── Pintura que as composições trocam ─────────────────────────────────
   Estava em \`style\` inline, e inline vence folha: fundo/borda/raio do
   card, do cartão de vantagem, do depoimento e da faixa de avaliação
   descem para cá para que um knob possa tirá-los. */
.mm .mm-carro { background: var(--d-bg-elev); border: 1px solid var(--d-border); border-radius: var(--d-radius); }
.mm .mm-carro-cat {
  position: absolute; left: .875rem; top: .875rem; padding: .375rem .75rem; font-size: 11px; letter-spacing: 2.5px;
}
.mm .mm-carro-valor { font-size: 30px; }
.mm .mm-carro-valores { display: flex; flex-direction: column; gap: .5rem; }
.mm .mm-vant-item { background: var(--d-bg-elev); border: 1px solid var(--d-border); border-radius: var(--d-radius); }
.mm .mm-vant-num { border: 2.5px solid var(--d-accent); border-radius: 9999px; background: var(--d-bg); color: var(--d-text); }
.mm .mm-dep-item { background: var(--d-bg-elev); border: 1px solid var(--d-border); border-radius: var(--d-radius); }
.mm .mm-avaliacao { background: var(--d-accent); color: var(--d-accent-ink); }
.mm .mm-marcas {
  display: flex; flex-wrap: wrap; gap: .5rem 1.75rem; list-style: none; margin: 0;
  padding: 1.75rem max(24px, 5vw) clamp(40px, 6vw, 64px); font-size: 13px;
}
.mm .mm-marcas li + li::before { content: "◆"; margin-right: 1.75rem; font-size: .7em; color: var(--d-accent); }
.mm .mm-hero-foto { display: none; }
.mm .mm-hero-faixas {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; margin-bottom: 2rem; max-width: 760px;
}
.mm .mm-faixa {
  display: flex; align-items: center; min-height: 3.25rem; padding: .7rem .9rem; font-size: 13.5px; line-height: 1.2;
  background: var(--d-bg-elev); border-color: var(--d-border);
}
.mm .mm-dados-barra {
  flex-direction: row; flex-wrap: wrap; gap: .75rem 2rem; margin-top: 2.25rem; padding-top: 1.25rem;
  border-top: 1px solid var(--d-border);
}

/* ── ABERTURA ──────────────────────────────────────────────────────────
   tipografica: tela cheia, nome em duas linhas, diagonal (material bruto).
   busca:       nome + faixas de preço como links + barra de identidade;
                sem tela cheia — o Pátio vende pressa.
   sangrada:    foto de tela cheia, nome sobre véu tokenizado.
   dividida:    nome + CTA de troca à esquerda, foto emoldurada à direita;
                empilha abaixo de 768px. */
.mm[data-mm-abertura="busca"] .mm-hero { min-height: 0; padding-block: 128px 3.5rem; }
.mm[data-mm-abertura="busca"] .mm-hero-h1 { font-size: calc(clamp(40px, 8vw, 96px) * var(--d-hero-escala)); }
.mm[data-mm-abertura="busca"] .mm-hero-diagonal,
.mm[data-mm-abertura="busca"] .mm-hero-chev { display: none; }

.mm[data-mm-abertura="sangrada"] {
  /* O véu: o próprio fundo da variante, subindo de baixo — é sobre ele
     que o nome é lido, e ele é medido como texto sobre fundo. */
  --mm-veu:
    linear-gradient(to bottom, color-mix(in srgb, var(--d-bg) 75%, transparent) 0%, transparent 24%),
    linear-gradient(to top,
      var(--d-bg) 0%, color-mix(in srgb, var(--d-bg) 92%, transparent) 42%,
      color-mix(in srgb, var(--d-bg) 62%, transparent) 76%, color-mix(in srgb, var(--d-bg) 40%, transparent) 100%);
}
.mm[data-mm-abertura="sangrada"] .mm-hero { justify-content: flex-end; padding-bottom: 7rem; }
.mm[data-mm-abertura="sangrada"] .mm-hero-foto { display: block; position: absolute; inset: 0; z-index: 0; }
.mm[data-mm-abertura="sangrada"] .mm-hero-veu { position: absolute; inset: 0; background: var(--mm-veu); }
.mm[data-mm-abertura="sangrada"] .mm-hero-diagonal { display: none; }

.mm[data-mm-abertura="dividida"] .mm-hero {
  display: grid; grid-template-columns: minmax(0, 1fr); row-gap: 2.25rem; align-content: center;
  min-height: 0; padding-block: 120px 4rem;
}
.mm[data-mm-abertura="dividida"] .mm-hero-corpo { order: 1; }
.mm[data-mm-abertura="dividida"] .mm-hero-foto {
  display: block; position: relative; order: 2; aspect-ratio: 4 / 3; overflow: hidden;
  border: 6px solid var(--d-bg-elev); border-radius: var(--d-radius);
  box-shadow: 0 0 0 1px var(--d-border), 0 24px 60px var(--mm-sombra);
}
.mm[data-mm-abertura="dividida"] .mm-hero-h1 { font-size: calc(clamp(40px, 8.5vw, 92px) * var(--d-hero-escala)); }
.mm[data-mm-abertura="dividida"] .mm-hero-diagonal,
.mm[data-mm-abertura="dividida"] .mm-hero-chev { display: none; }
/* Dois CTAs: o de troca é o gesto da loja; o do estoque vira contorno. */
.mm[data-mm-abertura="dividida"] .mm-hero-cta {
  background: transparent; color: var(--d-text); box-shadow: none;
  border: 1px solid color-mix(in srgb, var(--d-text) 35%, transparent);
}

/* ── ESTOQUE ───────────────────────────────────────────────────────────
   grade:   3 colunas de cards (material bruto).
   lista:   lista densa, parcela em destaque, preço à vista menor.
   vitrine: um carro por linha, foto 21:9, nome grande, sem filtro.
   tabela:  miniatura + a ficha em colunas, preço à direita. */
.mm[data-mm-estoque="lista"] .mm-carros { grid-template-columns: minmax(0, 1fr); gap: 0; max-width: 880px; }
.mm[data-mm-estoque="lista"] .mm-carro {
  display: grid; grid-template-columns: 112px minmax(0, 1fr); column-gap: 1rem; align-items: start;
  border-width: 0 0 1px; border-radius: 0; background: transparent; padding-block: 1rem;
}
.mm[data-mm-estoque="lista"] .mm-carro-foto { aspect-ratio: 4 / 3; border-radius: calc(var(--d-radius) * .6); border-width: 0; }
.mm[data-mm-estoque="lista"] .mm-carro-cat { left: .3rem; top: .3rem; padding: .15rem .4rem; font-size: 8.5px; letter-spacing: 1.2px; }
.mm[data-mm-estoque="lista"] .mm-carro-corpo { padding: 0; gap: .5rem; }
.mm[data-mm-estoque="lista"] .mm-carro-nome { font-size: 1.05rem; }
.mm[data-mm-estoque="lista"] .mm-carro-parcela span:first-child { font-size: 26px; line-height: 1.05; }
.mm[data-mm-estoque="lista"] .mm-carro-valor { font-size: 16px; }
.mm[data-mm-estoque="lista"] .mm-carro-valores { gap: .35rem; }

.mm[data-mm-estoque="vitrine"] .mm-carros { grid-template-columns: minmax(0, 1fr); gap: 3rem; }
.mm[data-mm-estoque="vitrine"] .mm-carro { border-width: 0; background: transparent; border-radius: 0; }
.mm[data-mm-estoque="vitrine"] .mm-carro-foto { aspect-ratio: 16 / 10; border-radius: var(--d-radius); border-width: 0; }
.mm[data-mm-estoque="vitrine"] .mm-carro-corpo { padding: 1.25rem 0 0; gap: .9rem; }
.mm[data-mm-estoque="vitrine"] .mm-carro-nome { font-size: clamp(28px, 4.6vw, 52px); line-height: 1; }
.mm[data-mm-estoque="vitrine"] .mm-carro-valor { font-size: clamp(28px, 3.4vw, 40px); }

.mm[data-mm-estoque="tabela"] .mm-carros { grid-template-columns: minmax(0, 1fr); gap: 0; border-top: 2px solid var(--d-text); }
.mm[data-mm-estoque="tabela"] .mm-carro {
  display: grid; grid-template-columns: 76px minmax(0, 1fr); column-gap: .9rem; align-items: center;
  border-width: 0 0 1px; border-radius: 0; background: transparent; padding-block: .8rem;
}
.mm[data-mm-estoque="tabela"] .mm-carro-foto { aspect-ratio: 4 / 3; border-width: 0; border-radius: 4px; }
.mm[data-mm-estoque="tabela"] .mm-carro-cat { display: none; }
.mm[data-mm-estoque="tabela"] .mm-carro-corpo {
  padding: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 1rem; row-gap: .4rem; align-items: center;
}
.mm[data-mm-estoque="tabela"] .mm-carro-nome { font-size: 1rem; grid-column: 1; }
.mm[data-mm-estoque="tabela"] .mm-carro-valores { grid-column: 2; grid-row: 1; align-items: flex-end; }
.mm[data-mm-estoque="tabela"] .mm-carro-valor { font-size: 20px; }
.mm[data-mm-estoque="tabela"] .mm-carro-chips { grid-column: 1 / -1; }
.mm[data-mm-estoque="tabela"] .mm-carro-painel { grid-column: 1 / -1; }

/* ── VANTAGENS ─────────────────────────────────────────────────────────
   grade (material bruto) · faixa de 4 linhas curtas · lista editorial
   numerada, coluna estreita · 2×2 com número grande. */
.mm[data-mm-vantagens="faixa"] .mm-vantagens { padding-block: calc(var(--d-sec-y) * .7); }
.mm[data-mm-vantagens="faixa"] .mm-vant-lista { grid-template-columns: minmax(0, 1fr); gap: 0; }
.mm[data-mm-vantagens="faixa"] .mm-vant-item {
  flex-direction: row; align-items: flex-start; gap: .9rem; padding: .9rem 0;
  background: transparent; border-width: 0 0 1px; border-radius: 0;
}
.mm[data-mm-vantagens="faixa"] .mm-vant-num { width: 34px; height: 34px; font-size: 15px; border-width: 2px; }
.mm[data-mm-vantagens="faixa"] .mm-vant-titulo { font-size: 1rem; }
.mm[data-mm-vantagens="faixa"] .mm-vant-textos p { margin-top: .25rem; }

.mm[data-mm-vantagens="editorial"] .mm-vant-lista { grid-template-columns: minmax(0, 1fr); gap: 0; max-width: 680px; }
.mm[data-mm-vantagens="editorial"] .mm-vant-item {
  flex-direction: row; gap: 1.5rem; padding: 1.75rem 0; background: transparent;
  border-width: 1px 0 0; border-radius: 0;
}
.mm[data-mm-vantagens="editorial"] .mm-vant-num {
  width: auto; height: auto; border: 0; background: transparent; font-size: 44px; line-height: 1; color: var(--d-accent);
}

.mm[data-mm-vantagens="quadrantes"] .mm-vant-lista { grid-template-columns: minmax(0, 1fr); gap: 1px; background: var(--d-border); border: 1px solid var(--d-border); }
.mm[data-mm-vantagens="quadrantes"] .mm-vant-item { border: 0; border-radius: 0; padding: 2rem; }
.mm[data-mm-vantagens="quadrantes"] .mm-vant-num {
  width: auto; height: auto; justify-content: flex-start; border: 0; background: transparent; font-size: 72px; line-height: .9; color: var(--d-accent);
}

/* ── NÚMEROS ───────────────────────────────────────────────────────────
   linha (material bruto) · selos em pílula · numerais gigantes em coluna ·
   placar em grade com borda. */
.mm[data-mm-numeros="selos"] .mm-numeros { padding-block: 2.5rem; }
.mm[data-mm-numeros="selos"] .mm-num-lista { gap: .75rem; }
.mm[data-mm-numeros="selos"] .mm-num-item {
  display: flex; align-items: baseline; gap: .6rem; padding: .7rem 1.2rem;
  background: var(--d-bg-elev); border: 1px solid var(--d-border); border-radius: 9999px;
}
.mm[data-mm-numeros="selos"] .mm-num-valor { font-size: 24px; }
.mm[data-mm-numeros="selos"] .mm-num-detalhe { margin-top: 0; }

.mm[data-mm-numeros="coluna"] .mm-num-lista { flex-direction: column; gap: 0; }
.mm[data-mm-numeros="coluna"] .mm-num-item { padding: 1.5rem 0; border-bottom: 1px solid var(--d-border); }
.mm[data-mm-numeros="coluna"] .mm-num-valor { font-size: clamp(64px, 13vw, 168px); line-height: .9; }

.mm[data-mm-numeros="placar"] .mm-num-lista { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; border: 2px solid var(--d-text); }
.mm[data-mm-numeros="placar"] .mm-num-item { padding: 1.5rem; text-align: center; }
.mm[data-mm-numeros="placar"] .mm-num-item + .mm-num-item { border-top: 2px solid var(--d-text); }
.mm[data-mm-numeros="placar"] .mm-num-valor { font-size: clamp(44px, 6vw, 64px); }

/* ── DESTAQUE ──────────────────────────────────────────────────────────
   cartao: foto metade + ficha (default) · tira "oferta da semana": foto
   pequena + ficha curta em linha · catalogo: foto grande e a ficha técnica
   em tabela tipográfica de página inteira · ficha de pátio: tabela larga,
   foto como miniatura. */
.mm[data-mm-destaque="tira"] .mm-destaque { padding-block: calc(var(--d-sec-y) * .6); }
.mm[data-mm-destaque="tira"] .mm-dest-grade {
  grid-template-columns: 96px minmax(0, 1fr); gap: 1.1rem; align-items: start; padding: 1.1rem;
  background: var(--d-bg-elev); border: 1px solid var(--d-border); border-radius: var(--d-radius);
}
.mm[data-mm-destaque="tira"] .mm-dest-foto { aspect-ratio: 1; }
.mm[data-mm-destaque="tira"] .mm-dest-titulo { font-size: clamp(22px, 3vw, 30px); }
.mm[data-mm-destaque="tira"] .mm-ficha { flex-direction: row; flex-wrap: wrap; gap: .35rem 1.25rem; margin-top: .9rem; padding-top: .8rem; }
.mm[data-mm-destaque="tira"] .mm-ficha-linha { justify-content: flex-start; gap: .4rem; }

.mm[data-mm-destaque="catalogo"] .mm-dest-grade { grid-template-columns: minmax(0, 1fr); gap: 2.5rem; }
.mm[data-mm-destaque="catalogo"] .mm-dest-foto { aspect-ratio: 16 / 9; }
.mm[data-mm-destaque="catalogo"] .mm-dest-titulo { font-size: clamp(40px, 7.5vw, 104px); line-height: .95; }
.mm[data-mm-destaque="catalogo"] .mm-dest-texto { font-size: 17px; max-width: 640px; }
.mm[data-mm-destaque="catalogo"] .mm-ficha { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; margin-top: 2.5rem; padding-top: 0; }
.mm[data-mm-destaque="catalogo"] .mm-ficha-linha {
  flex-direction: column; align-items: flex-start; gap: .3rem; padding: 1.1rem 0; border-bottom: 1px solid var(--d-border);
}
.mm[data-mm-destaque="catalogo"] .mm-ficha-linha dd { font-family: var(--d-display); font-size: clamp(24px, 3vw, 34px); line-height: 1.1; }

.mm[data-mm-destaque="ficha"] .mm-dest-grade { grid-template-columns: 120px minmax(0, 1fr); gap: 1.25rem; align-items: start; }
.mm[data-mm-destaque="ficha"] .mm-dest-foto { aspect-ratio: 1; }
.mm[data-mm-destaque="ficha"] .mm-dest-titulo { font-size: clamp(26px, 4vw, 44px); }
.mm[data-mm-destaque="ficha"] .mm-ficha { gap: 0; padding-top: 0; border: 2px solid var(--d-text); }
.mm[data-mm-destaque="ficha"] .mm-ficha-linha { padding: .75rem 1rem; }
.mm[data-mm-destaque="ficha"] .mm-ficha-linha:nth-child(odd) { background: var(--d-bg-alt); }

/* ── SIMULADOR ─────────────────────────────────────────────────────────
   cartoes: dois cartões (material bruto) · coluna: uma coluna, RESULTADO
   ACIMA dos controles · painel: horizontal compacto · lateral: cartão
   único ao lado do texto. */
.mm[data-mm-simulador="coluna"] .mm-sim { grid-template-columns: minmax(0, 1fr); max-width: 560px; }
.mm[data-mm-simulador="coluna"] .mm-sim-resultado { order: -1; }

.mm[data-mm-simulador="painel"] .mm-simulador { padding-block: calc(var(--d-sec-y) * .7); }
.mm[data-mm-simulador="painel"] .mm-sim { grid-template-columns: minmax(0, 1fr); gap: 0; }
.mm[data-mm-simulador="painel"] .mm-sim-controles { gap: 1.5rem; border-radius: var(--d-radius) var(--d-radius) 0 0; }
.mm[data-mm-simulador="painel"] .mm-sim-resultado { gap: .6rem; border-top-width: 0; border-radius: 0 0 var(--d-radius) var(--d-radius); }
.mm[data-mm-simulador="painel"] .mm-sim-parcela { font-size: clamp(36px, 4.4vw, 48px); }

.mm[data-mm-simulador="lateral"] .mm-sim { grid-template-columns: minmax(0, 1fr); gap: 0; }
.mm[data-mm-simulador="lateral"] .mm-sim-controles { border-radius: var(--d-radius) var(--d-radius) 0 0; }
.mm[data-mm-simulador="lateral"] .mm-sim-resultado { border-top-width: 0; border-radius: 0 0 var(--d-radius) var(--d-radius); }

/* ── AVALIAÇÃO ─────────────────────────────────────────────────────────
   faixa no acento + marquee (material bruto) · tarja no acento com CTA e
   as marcas paradas · linha discreta + marquee lenta · formulário de
   troca em cartão grande + marcas paradas. */
.mm[data-mm-avaliacao="tarja"] .mm-avaliacao { padding-top: 2.75rem; }
.mm[data-mm-avaliacao="tarja"] .mm-aval-titulo { font-size: clamp(28px, 4.4vw, 46px); }
.mm[data-mm-avaliacao="tarja"] .mm-marcas { padding-top: 1.25rem; padding-bottom: 2.25rem; opacity: 1; }
.mm[data-mm-avaliacao="tarja"] .mm-marcas li + li::before { color: inherit; }

.mm[data-mm-avaliacao="linha"] .mm-avaliacao {
  background: var(--d-bg); color: var(--d-text); padding-top: calc(var(--d-sec-y) * .6);
  border-top: 1px solid var(--d-border);
}
.mm[data-mm-avaliacao="linha"] .mm-aval-titulo { font-size: clamp(24px, 3.2vw, 36px); line-height: 1.1; }
.mm[data-mm-avaliacao="linha"] .d-marquee-track { animation-duration: 70s; }

.mm[data-mm-avaliacao="formulario"] .mm-avaliacao { background: var(--d-bg-alt); color: var(--d-text); padding-top: var(--d-sec-y); }
.mm[data-mm-avaliacao="formulario"] .mm-aval-caixa {
  display: grid; grid-template-columns: minmax(0, 1fr); gap: 2rem; align-items: start;
  padding: clamp(24px, 4vw, 44px); background: var(--d-bg-elev); border: 1px solid var(--d-border);
  border-radius: var(--d-radius); max-width: calc(1200px - 2 * max(24px, 5vw));
}
.mm[data-mm-avaliacao="formulario"] .mm-aval-caixa { width: calc(100% - 2 * max(24px, 5vw)); }
.mm[data-mm-avaliacao="formulario"] .mm-aval-titulo { font-size: clamp(32px, 4.6vw, 56px); }
.mm[data-mm-avaliacao="formulario"] .mm-aval-texto [data-demo-slot="secoes.avaliacao.rotulo"] { color: var(--d-accent); }

/* ── DEPOIMENTOS ───────────────────────────────────────────────────────
   carrossel (material bruto) · três cartões empilhados · uma citação
   gigante por vez · tira com o veículo em destaque sobre o autor. */
.mm[data-mm-depoimentos="empilhado"] .mm-dep-trilho { flex-direction: column; gap: .875rem; max-width: 760px; }
.mm[data-mm-depoimentos="empilhado"] .mm-dep-item { width: auto; }

.mm[data-mm-depoimentos="citacao"] .mm-dep-item {
  width: 100%; background: transparent; border-width: 0; border-radius: 0; padding: 0; gap: 2rem;
}
.mm[data-mm-depoimentos="citacao"] .mm-dep-texto {
  font-family: var(--d-display); font-size: clamp(28px, 4.4vw, 58px); line-height: 1.12; max-width: 1000px;
}

.mm[data-mm-depoimentos="tira"] .mm-dep-trilho { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; border-top: 2px solid var(--d-text); }
.mm[data-mm-depoimentos="tira"] .mm-dep-item {
  width: auto; flex-direction: column-reverse; gap: .8rem; background: transparent;
  border-width: 0 0 1px; border-radius: 0; padding: 1.4rem 0;
}
.mm[data-mm-depoimentos="tira"] .mm-dep-autor { margin-top: 0; }
.mm[data-mm-depoimentos="tira"] .mm-dep-quem { display: flex; flex-direction: column-reverse; }
.mm[data-mm-depoimentos="tira"] .mm-dep-contexto {
  font-family: var(--d-display); font-size: clamp(18px, 2.2vw, 24px); font-weight: 700; text-transform: uppercase;
  margin: 0 0 .15rem;
}
.mm[data-mm-depoimentos="tira"] .mm-dep-texto { font-size: 15px; }

/* ── CONTATO ───────────────────────────────────────────────────────────
   rodape em duas colunas (material bruto) · tarja de uma linha (a
   identidade já subiu para a abertura) · fecho centralizado · bloco "onde
   fica o pátio", endereço grande e horário em tabela. */
.mm[data-mm-contato="tarja"] .mm-contato-secao { padding-block: 2.75rem 2.25rem; }
.mm[data-mm-contato="tarja"] .mm-contato-caixa {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem 2rem;
}
.mm[data-mm-contato="tarja"] .mm-contato-titulo { font-size: clamp(22px, 3vw, 32px); margin-bottom: 0; }
.mm[data-mm-contato="tarja"] .mm-contato-acoes { flex-direction: row; flex-wrap: wrap; }
.mm[data-mm-contato="tarja"] .mm-contato-barra { margin-top: 2rem; padding-top: 1.25rem; }

.mm[data-mm-contato="fecho"] .mm-contato-caixa { display: flex; flex-direction: column; align-items: center; text-align: center; max-width: 760px; gap: 1.5rem; }
.mm[data-mm-contato="fecho"] .mm-contato-marca { display: flex; flex-direction: column; align-items: center; }
.mm[data-mm-contato="fecho"] .mm-contato-titulo { font-size: clamp(40px, 7vw, 88px); }
.mm[data-mm-contato="fecho"] .mm-contato-acoes { width: 100%; max-width: 420px; }
.mm[data-mm-contato="fecho"] .mm-dados { align-items: center; }

.mm[data-mm-contato="bloco"] .mm-contato-titulo { font-size: clamp(40px, 6.4vw, 76px); }
.mm[data-mm-contato="bloco"] .mm-dados { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; border-top: 2px solid var(--d-text); }
.mm[data-mm-contato="bloco"] .mm-dado { padding: .9rem 0; border-bottom: 1px solid var(--d-border); }
.mm[data-mm-contato="bloco"] .mm-dado:first-child dd { font-family: var(--d-display); font-size: clamp(24px, 3.2vw, 38px); line-height: 1.1; }

@media (min-width: 560px) {
  .mm[data-mm-vantagens="quadrantes"] .mm-vant-lista { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mm[data-mm-numeros="placar"] .mm-num-lista { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .mm[data-mm-numeros="placar"] .mm-num-item + .mm-num-item { border-top: 0; border-left: 2px solid var(--d-text); }
  .mm[data-mm-destaque="tira"] .mm-dest-grade { grid-template-columns: 160px minmax(0, 1fr); }
}

@media (min-width: 768px) {
  .mm[data-mm-abertura="dividida"] .mm-hero {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); column-gap: 3.5rem; align-items: center;
    padding-block: 140px 5rem;
  }
  .mm[data-mm-abertura="dividida"] .mm-hero-foto { aspect-ratio: 4 / 5; }
  .mm .mm-hero-faixas { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .mm .mm-faixa { font-size: 15px; padding: .9rem 1.1rem; }
  .mm[data-mm-vantagens="faixa"] .mm-vant-lista { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.5rem; }
  .mm[data-mm-vantagens="faixa"] .mm-vant-item { flex-direction: column; border-width: 0; }
  .mm[data-mm-estoque="lista"] .mm-carro { grid-template-columns: 168px minmax(0, 1fr); column-gap: 1.5rem; }
  .mm[data-mm-estoque="lista"] .mm-carro-corpo {
    display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 1.5rem; row-gap: .5rem;
  }
  .mm[data-mm-estoque="lista"] .mm-carro-valores { grid-column: 2; grid-row: 1 / span 2; align-items: flex-end; text-align: right; }
  .mm[data-mm-estoque="lista"] .mm-carro-nome,
  .mm[data-mm-estoque="lista"] .mm-carro-chips,
  .mm[data-mm-estoque="lista"] .mm-carro-painel { grid-column: 1; }
  .mm[data-mm-estoque="lista"] .mm-carro-painel { grid-column: 1 / -1; }
  .mm[data-mm-estoque="vitrine"] .mm-carro-foto { aspect-ratio: 21 / 9; }
  .mm[data-mm-estoque="vitrine"] .mm-carro-corpo {
    display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; column-gap: 2rem;
  }
  .mm[data-mm-estoque="vitrine"] .mm-carro-valores { grid-column: 2; grid-row: 1; }
  .mm[data-mm-estoque="vitrine"] .mm-carro-chips,
  .mm[data-mm-estoque="vitrine"] .mm-carro-painel { grid-column: 1 / -1; }
  .mm[data-mm-destaque="catalogo"] .mm-ficha { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 3rem; }
  .mm[data-mm-destaque="ficha"] .mm-dest-grade { grid-template-columns: 220px minmax(0, 1fr); gap: 2.5rem; }
  .mm[data-mm-avaliacao="formulario"] .mm-aval-caixa { grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); }
  .mm[data-mm-depoimentos="tira"] .mm-dep-trilho { grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 2rem; }
  .mm[data-mm-contato="bloco"] .mm-dado { display: grid; grid-template-columns: 180px minmax(0, 1fr); align-items: baseline; }
}

@media (min-width: 900px) {
  .mm[data-mm-estoque="tabela"] .mm-carro { grid-template-columns: 112px minmax(0, 1fr); column-gap: 1.5rem; }
  .mm[data-mm-estoque="tabela"] .mm-carro-corpo {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 2fr) auto; column-gap: 1.5rem;
  }
  .mm[data-mm-estoque="tabela"] .mm-carro-chips {
    grid-column: 2; grid-row: 1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .5rem;
  }
  .mm[data-mm-estoque="tabela"] .mm-carro-chips > * { border: 0; background: transparent; padding: 0; font-size: 13px; }
  .mm[data-mm-estoque="tabela"] .mm-carro-valores { grid-column: 3; }
  .mm[data-mm-simulador="painel"] .mm-sim-controles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2rem; }
  .mm[data-mm-simulador="painel"] .mm-sim-resultado { display: grid; grid-template-columns: auto auto minmax(0, 1fr); align-items: center; column-gap: 2rem; }
  .mm[data-mm-simulador="lateral"] .mm-sim-secao { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 3rem; align-items: start; }
}

@media (min-width: 768px) {
  .mm .mm-dest-grade { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
}
`;

/**
 * A composição do material bruto — o que a skin renderiza quando o tema não
 * declara `multimarcas`. É o desenho que existia antes do eixo de variante,
 * e é o que a variante `vortice` declara.
 */
export const MULTIMARCAS_COMPOSICAO_PADRAO: MultimarcasComposicao = {
  abertura: "tipografica",
  estoque: "grade",
  vantagens: "grade",
  numeros: "linha",
  destaque: "cartao",
  simulador: "cartoes",
  avaliacao: "faixa",
  depoimentos: "carrossel",
  contato: "rodape",
};

/** Os `data-mm-*` do wrapper — um por knob. */
export function atributosDaComposicao(comp: MultimarcasComposicao): Record<string, string> {
  return Object.fromEntries(Object.entries(comp).map(([knob, valor]) => [`data-mm-${knob}`, valor]));
}
