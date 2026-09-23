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
  position: absolute; z-index: 3; display: flex; align-items: center; gap: .625rem;
  top: calc(86px + env(safe-area-inset-top)); right: max(24px, 5vw);
}
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
