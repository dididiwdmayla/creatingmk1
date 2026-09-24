import type { PigmentoComposicao } from "@/lib/demos/types";

/**
 * A composição da Pigmento Vivo: quatro sites, um contrato e um caminho de
 * render. Cada knob vira um `data-pv-*` no wrapper e CSS servido junto do
 * HTML — layout depois da hidratação seria CLS.
 *
 * Regras de casa:
 * 1. a Aquarela é o default e também existe na folha, nunca só no JSX;
 * 2. especificidade desce por `.pv[data-pv-*]`, sem `!important`;
 * 3. composição move/redimensiona/retexturiza, nunca remove texto nem slot;
 * 4. forma usa `--pv-mancha-*`; texto usa `--d-accent*`/`--d-text`;
 * 5. animação só toca `transform`/`opacity`; blur, quando existe, é estático.
 */

export const PIGMENTO_COMPOSICAO_PADRAO: PigmentoComposicao = {
  abertura: "mancha",
  portfolio: "trilha",
  investimento: "gotas",
  processo: "onda",
  manifesto: "circulo",
  estilos: "mostruario",
  artistas: "assinaturas",
  depoimentos: "bilhetes",
  faq: "acordeao",
  agendar: "gota",
  contato: "assinatura",
};

export function atributosDaComposicao(
  composicao: PigmentoComposicao,
): Record<string, string> {
  return {
    "data-pv-abertura": composicao.abertura,
    "data-pv-portfolio": composicao.portfolio,
    "data-pv-investimento": composicao.investimento,
    "data-pv-processo": composicao.processo,
    "data-pv-manifesto": composicao.manifesto,
    "data-pv-estilos": composicao.estilos,
    "data-pv-artistas": composicao.artistas,
    "data-pv-depoimentos": composicao.depoimentos,
    "data-pv-faq": composicao.faq,
    "data-pv-agendar": composicao.agendar,
    "data-pv-contato": composicao.contato,
  };
}

export const PIGMENTO_COMPOSICAO_CSS = `
/* ── Superfícies: o default (Aquarela) também mora na folha ────────── */
.pv {
  --pv-forma-raio: 46% 54% 58% 42% / 44% 42% 58% 56%;
  --pv-forma-borda: 1px solid color-mix(in srgb, var(--d-text) 10%, transparent);
  --pv-forma-sombra: 0 18px 60px color-mix(in srgb, var(--d-text) 8%, transparent);
  --pv-textura: repeating-linear-gradient(96deg, transparent 0 7px, color-mix(in srgb, var(--d-text) 2%, transparent) 8px, transparent 9px);
  --pv-papel: var(--d-bg);
}
.pv[data-pv-variante="boreal"] {
  --pv-forma-raio: 0;
  --pv-forma-borda: 1px dashed color-mix(in srgb, var(--d-accent-2) 58%, transparent);
  --pv-forma-sombra: 12px 12px 0 color-mix(in srgb, var(--pv-mancha-2) 12%, transparent);
  --pv-textura: repeating-linear-gradient(90deg, transparent 0 31px, color-mix(in srgb, var(--d-accent-2) 7%, transparent) 32px);
  --pv-papel: var(--d-bg-alt);
}
.pv[data-pv-variante="meia-noite"] {
  --pv-forma-raio: var(--d-radius);
  --pv-forma-borda: 1px solid color-mix(in srgb, var(--d-accent) 34%, transparent);
  --pv-forma-sombra: 0 0 42px color-mix(in srgb, var(--pv-mancha-1) 18%, transparent);
  --pv-textura: radial-gradient(circle, color-mix(in srgb, var(--d-text) 14%, transparent) 1px, transparent 1.5px);
  --pv-papel: var(--d-bg-alt);
}
.pv[data-pv-variante="terra"] {
  --pv-forma-raio: 48% 52% 44% 56% / 54% 42% 58% 46%;
  --pv-forma-borda: 3px double color-mix(in srgb, var(--d-accent) 58%, transparent);
  --pv-forma-sombra: inset 0 0 0 7px color-mix(in srgb, var(--pv-mancha-2) 7%, transparent), 0 18px 48px color-mix(in srgb, var(--d-text) 10%, transparent);
  --pv-textura: repeating-linear-gradient(4deg, transparent 0 4px, color-mix(in srgb, var(--d-text) 2.5%, transparent) 5px);
  --pv-papel: var(--d-bg-elev);
}

.pv::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: var(--pv-textura);
  background-size: 12px 12px;
  opacity: .48;
}
.pv > * { position: relative; }

/* ── ABERTURA ────────────────────────────────────────────────────────
   mancha:       nome em duas linhas ancorado a três manchas macias;
   sobreposição: decalque fantasma deslocado + nome sólido + régua;
   cartela:      três faixas cheias e o nome numa tarja na base;
   medalhão:     fio oval duplo e anel de três pigmentos. */
.pv .pv-hero-nome-caixa { position: relative; width: min(100%, 58rem); }
.pv .pv-hero-nome { position: relative; z-index: 2; }
.pv .pv-hero-fantasma,
.pv .pv-hero-arco,
.pv .pv-hero-regua { display: none; }
.pv .pv-hero-mancha { filter: blur(3rem); }

.pv[data-pv-abertura="mancha"] .pv-hero-conteudo { align-items: flex-start; }
.pv[data-pv-abertura="mancha"] .pv-hero-nome-bloco { align-items: flex-start; text-align: left; }
.pv[data-pv-abertura="mancha"] .pv-hero-nome-caixa { max-width: 48rem; }
.pv[data-pv-abertura="mancha"] .pv-hero-nome { max-width: 9ch; }
.pv[data-pv-abertura="mancha"] .pv-hero-etiqueta { margin-top: 3svh; }

.pv[data-pv-abertura="sobreposicao"] .pv-hero {
  min-height: 88svh;
  justify-content: center;
  padding-block: 8rem 4rem;
}
.pv[data-pv-abertura="sobreposicao"] .pv-hero-conteudo { align-items: flex-start; }
.pv[data-pv-abertura="sobreposicao"] .pv-hero-nome-bloco { align-items: flex-start; text-align: left; }
.pv[data-pv-abertura="sobreposicao"] .pv-hero-nome-caixa { width: min(100%, 64rem); }
.pv[data-pv-abertura="sobreposicao"] .pv-hero-fantasma {
  display: block;
  position: absolute;
  z-index: 0;
  inset: -.04em auto auto .08em;
  width: 100%;
  color: transparent;
  -webkit-text-stroke: 1px var(--d-accent-2);
  font-family: var(--d-hero-font);
  font-size: calc(clamp(2.75rem, 9vw, 7.5rem) * var(--d-hero-escala));
  line-height: .98;
  opacity: .28;
  transform: translate(.13em, .16em);
}
.pv[data-pv-abertura="sobreposicao"] .pv-hero-mancha { filter: none; }
.pv[data-pv-abertura="sobreposicao"] .pv-hero-mancha .d-blob {
  border: var(--pv-forma-borda);
  border-radius: 0;
  background: color-mix(in srgb, var(--pv-mancha-2) 9%, transparent);
}
.pv[data-pv-abertura="sobreposicao"] .pv-hero-mancha-a {
  left: auto; right: 4%; top: 10%; width: min(38vw, 30rem); height: min(38vw, 30rem);
  transform: rotate(4deg);
}
.pv[data-pv-abertura="sobreposicao"] .pv-hero-mancha-b {
  right: 14%; top: 25%; width: min(31vw, 24rem); height: min(31vw, 24rem);
  transform: rotate(-3deg);
}
.pv[data-pv-abertura="sobreposicao"] .pv-hero-mancha-c { display: none; }
.pv[data-pv-abertura="sobreposicao"] .pv-hero-regua {
  display: grid;
  grid-template-columns: .7rem minmax(5rem, 18rem) .7rem;
  align-items: center;
  gap: .55rem;
  width: min(100%, 24rem);
  margin-top: 2rem;
}
.pv[data-pv-abertura="sobreposicao"] .pv-hero-regua span:nth-child(1),
.pv[data-pv-abertura="sobreposicao"] .pv-hero-regua span:nth-child(3) {
  width: .7rem; height: .7rem; border: 1px solid var(--d-accent-2); border-radius: 50%;
}
.pv[data-pv-abertura="sobreposicao"] .pv-hero-regua span:nth-child(2) {
  height: 1px;
  background: repeating-linear-gradient(90deg, var(--d-accent-2) 0 .65rem, transparent .65rem 1rem);
}

.pv[data-pv-abertura="cartela"] .pv-hero {
  min-height: 100svh;
  justify-content: flex-start;
  padding: 52svh 0 4rem;
}
.pv[data-pv-abertura="cartela"] .pv-hero-traco { display: none; }
.pv[data-pv-abertura="cartela"] .pv-hero-mancha {
  display: block;
  top: 0;
  bottom: auto;
  height: 52svh;
  width: 34%;
  filter: none;
  overflow: hidden;
  border-radius: 0;
}
.pv[data-pv-abertura="cartela"] .pv-hero-mancha .d-blob {
  border-radius: 0;
  background: var(--pv-cartela-cor);
  mix-blend-mode: normal;
  animation: none;
}
.pv[data-pv-abertura="cartela"] .pv-hero-mancha-a { left: 0; --pv-cartela-cor: var(--pv-mancha-1); }
.pv[data-pv-abertura="cartela"] .pv-hero-mancha-b { left: 33%; right: auto; --pv-cartela-cor: var(--pv-mancha-2); }
.pv[data-pv-abertura="cartela"] .pv-hero-mancha-c { left: 66%; --pv-cartela-cor: var(--pv-mancha-3); }
.pv[data-pv-abertura="cartela"] .pv-hero-conteudo { max-width: none; }
.pv[data-pv-abertura="cartela"] .pv-hero-etiqueta,
.pv[data-pv-abertura="cartela"] .pv-hero-texto-caixa,
.pv[data-pv-abertura="cartela"] .pv-hero-cta { padding-inline: clamp(1.5rem, 5vw, 4.5rem); }
.pv[data-pv-abertura="cartela"] .pv-hero-nome-bloco {
  align-items: flex-start;
  width: 100%;
  padding: clamp(1.5rem, 3.5vw, 3rem) clamp(1.5rem, 5vw, 4.5rem);
  background: var(--d-bg);
  text-align: left;
}
.pv[data-pv-abertura="cartela"] .pv-hero-nome-caixa { width: 100%; max-width: none; }
.pv[data-pv-abertura="cartela"] .pv-hero-nome { max-width: none; letter-spacing: -.045em; }

@keyframes pv-medalhao-a { to { transform: rotate(360deg); } }
@keyframes pv-medalhao-b { to { transform: rotate(-360deg); } }
.pv[data-pv-abertura="medalhao"] .pv-hero { min-height: 100svh; padding-block: 8rem 4rem; }
.pv[data-pv-abertura="medalhao"] .pv-hero-traco,
.pv[data-pv-abertura="medalhao"] .pv-hero-mancha { display: none; }
.pv[data-pv-abertura="medalhao"] .pv-hero-conteudo,
.pv[data-pv-abertura="medalhao"] .pv-hero-nome-bloco { align-items: center; text-align: center; }
.pv[data-pv-abertura="medalhao"] .pv-hero-nome-caixa {
  display: grid;
  place-items: center;
  width: min(90vw, 58rem);
  min-height: clamp(18rem, 48vw, 32rem);
  padding: clamp(3.5rem, 8vw, 7rem) clamp(2rem, 7vw, 6rem);
  border: 4px double var(--d-text);
  border-radius: 50%;
  box-shadow: var(--pv-forma-sombra);
}
.pv[data-pv-abertura="medalhao"] .pv-hero-nome { max-width: 8ch; text-align: center; }
.pv[data-pv-abertura="medalhao"] .pv-hero-arco {
  display: block;
  position: absolute;
  pointer-events: none;
  border: .28rem solid transparent;
  border-radius: 50%;
}
.pv[data-pv-abertura="medalhao"] .pv-hero-arco-a {
  inset: -1.2rem;
  border-top-color: var(--pv-mancha-1);
  animation: pv-medalhao-a 18s linear infinite;
}
.pv[data-pv-abertura="medalhao"] .pv-hero-arco-b {
  inset: -.72rem;
  border-right-color: var(--pv-mancha-2);
  animation: pv-medalhao-b 22s linear infinite;
}
.pv[data-pv-abertura="medalhao"] .pv-hero-arco-c {
  inset: -.25rem;
  border-bottom-color: var(--pv-mancha-3);
  transform: rotate(22deg);
}
.pv[data-d-anim="nenhuma"][data-pv-abertura="medalhao"] .pv-hero-arco { animation: none; }
@media (prefers-reduced-motion: reduce) {
  .pv[data-pv-abertura="medalhao"] .pv-hero-arco { animation: none; }
}

@media (max-width: 47.999rem) {
  .pv .pv-hero-mancha { filter: blur(2rem); }
  .pv[data-pv-abertura="mancha"] .pv-hero-mancha-a { width: 78vw; height: 78vw; }
  .pv[data-pv-abertura="mancha"] .pv-hero-mancha-b { width: 72vw; height: 72vw; }
  .pv[data-pv-abertura="sobreposicao"] .pv-hero-mancha { filter: none; opacity: .7; }
  .pv[data-pv-abertura="sobreposicao"] .pv-hero-mancha-a { width: 62vw; height: 62vw; }
  .pv[data-pv-abertura="sobreposicao"] .pv-hero-mancha-b { width: 54vw; height: 54vw; }
  .pv[data-pv-abertura="cartela"] .pv-hero-mancha { filter: none; }
  .pv[data-pv-abertura="medalhao"] .pv-hero-nome-caixa {
    width: min(88vw, 34rem);
    min-height: min(88vw, 29rem);
    padding: 3.8rem 1.5rem;
  }
}

/* ── PORTFÓLIO ───────────────────────────────────────────────────────
   trilha:  pinada no desktop, zigue-zague vertical no celular;
   vitrine: uma peça dominante + sete miniaturas;
   manchas: recortes orgânicos, dois por linha e escalonados;
   mesa:    polaroides giradas e sobrepostas em menos de 20%. */
.pv .pv-portfolio-foto {
  width: min(var(--pv-foto-largura), 78vw);
  height: var(--pv-foto-altura);
  background: var(--d-bg-elev);
}
.pv .pv-portfolio-legenda { max-width: 34ch; }

.pv[data-pv-portfolio="vitrine"] .pv-portfolio-lista,
.pv[data-pv-portfolio="manchas"] .pv-portfolio-lista,
.pv[data-pv-portfolio="mesa"] .pv-portfolio-lista {
  width: min(100%, 76rem);
  margin-inline: auto;
  padding-inline: clamp(1.5rem, 5vw, 4.5rem);
  overflow: visible;
}

.pv[data-pv-portfolio="vitrine"] .pv-portfolio-lista {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  grid-auto-rows: minmax(8rem, 13vw);
  align-items: stretch;
  gap: .8rem;
}
.pv[data-pv-portfolio="vitrine"] .pv-portfolio-item { min-width: 0; }
.pv[data-pv-portfolio="vitrine"] .pv-portfolio-item:first-child {
  grid-column: span 2;
  grid-row: span 2;
}
.pv[data-pv-portfolio="vitrine"] .pv-portfolio-foto {
  width: 100%;
  height: 100%;
  min-height: 4rem;
  aspect-ratio: 1;
  border-radius: 0;
}
.pv[data-pv-portfolio="vitrine"] .pv-portfolio-item:first-child .pv-portfolio-foto {
  aspect-ratio: 4 / 5;
}
.pv[data-pv-portfolio="vitrine"] .pv-portfolio-legenda {
  margin-top: .45rem;
  font-size: .6875rem;
  line-height: 1.25;
}

.pv[data-pv-portfolio="manchas"] .pv-portfolio-lista {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(1.25rem, 4vw, 4rem);
  align-items: center;
}
.pv[data-pv-portfolio="manchas"] .pv-portfolio-item { width: 100%; }
.pv[data-pv-portfolio="manchas"] .pv-portfolio-item:nth-child(even) { transform: translateY(12%); }
.pv[data-pv-portfolio="manchas"] .pv-portfolio-item:nth-child(4n + 1) { width: 86%; justify-self: end; }
.pv[data-pv-portfolio="manchas"] .pv-portfolio-item:nth-child(4n + 2) { width: 94%; justify-self: start; }
.pv[data-pv-portfolio="manchas"] .pv-portfolio-item:nth-child(4n + 3) { width: 100%; }
.pv[data-pv-portfolio="manchas"] .pv-portfolio-item:nth-child(4n) { width: 82%; }
.pv[data-pv-portfolio="manchas"] .pv-portfolio-foto {
  width: 100%;
  height: auto;
  aspect-ratio: 4 / 5;
  border-radius: 0;
  clip-path: polygon(8% 2%, 91% 0, 100% 18%, 94% 91%, 75% 100%, 7% 94%, 0 71%, 3% 13%);
}
.pv[data-pv-portfolio="manchas"] .pv-portfolio-item:nth-child(even) .pv-portfolio-foto {
  clip-path: polygon(3% 12%, 20% 1%, 92% 5%, 100% 29%, 93% 93%, 67% 100%, 4% 91%, 0 32%);
}

.pv[data-pv-portfolio="mesa"] .pv-portfolio-lista {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: start;
  gap: clamp(1rem, 2vw, 2rem) 0;
  padding-block: 2.5rem;
}
.pv[data-pv-portfolio="mesa"] .pv-portfolio-item {
  width: 112%;
  padding: .7rem .7rem 1rem;
  background: var(--d-bg-elev);
  box-shadow: 0 .8rem 2.2rem color-mix(in srgb, var(--d-text) 15%, transparent);
  transform: rotate(-4deg);
  transform-origin: 50% 80%;
}
.pv[data-pv-portfolio="mesa"] .pv-portfolio-item:nth-child(even) { transform: rotate(4deg); }
.pv[data-pv-portfolio="mesa"] .pv-portfolio-item:nth-child(3n) { transform: rotate(-1.5deg); }
.pv[data-pv-portfolio="mesa"] .pv-portfolio-item:not(:first-child) { margin-inline-start: -12%; }
.pv[data-pv-portfolio="mesa"] .pv-portfolio-foto {
  width: 100%;
  height: auto;
  aspect-ratio: 4 / 5;
  border-radius: 0;
}
.pv[data-pv-portfolio="mesa"] .pv-portfolio-legenda { color: var(--d-text); }

@media (max-width: 47.999rem) {
  .pv[data-pv-portfolio="trilha"] .pv-portfolio-lista {
    display: grid;
    width: 100%;
    padding-inline: 1.5rem;
    overflow: visible;
    gap: 2rem;
  }
  .pv[data-pv-portfolio="trilha"] .pv-portfolio-item { width: 82%; justify-self: start; }
  .pv[data-pv-portfolio="trilha"] .pv-portfolio-item:nth-child(even) { width: 68%; justify-self: end; }
  .pv[data-pv-portfolio="trilha"] .pv-portfolio-item:nth-child(3n) { width: 76%; justify-self: center; }
  .pv[data-pv-portfolio="trilha"] .pv-portfolio-foto {
    width: 100%;
    height: auto;
    aspect-ratio: 4 / 5;
  }
  .pv[data-pv-portfolio="vitrine"] .pv-portfolio-lista {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: auto;
  }
  .pv[data-pv-portfolio="vitrine"] .pv-portfolio-item:first-child {
    grid-column: 1 / -1;
    grid-row: auto;
  }
  .pv[data-pv-portfolio="vitrine"] .pv-portfolio-foto { height: auto; aspect-ratio: 1; }
  .pv[data-pv-portfolio="vitrine"] .pv-portfolio-item:first-child .pv-portfolio-foto { aspect-ratio: 4 / 5; }
  .pv[data-pv-portfolio="manchas"] .pv-portfolio-lista { gap: 2.2rem 1rem; }
  .pv[data-pv-portfolio="manchas"] .pv-portfolio-item:nth-child(even) { transform: translateY(7%); }
  .pv[data-pv-portfolio="mesa"] .pv-portfolio-lista {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding-inline: 1.5rem;
  }
  .pv[data-pv-portfolio="mesa"] .pv-portfolio-item { width: 110%; }
}

/* ── INVESTIMENTO ────────────────────────────────────────────────────
   gotas:     preço grande dentro de formas orgânicas;
   régua:     posição derivada de precoValor, sem valor vai para o fim;
   etiquetas: tags penduradas em fios;
   selos:     preço carimbado ao lado da descrição. */
.pv[data-pv-investimento="gotas"] .pv-investimento-lista {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(1rem, 2.8vw, 2.5rem);
}
.pv[data-pv-investimento="gotas"] .pv-investimento-item {
  min-height: 18rem;
  padding: clamp(1.5rem, 3vw, 2.75rem);
  border: 0;
  border-radius: var(--pv-forma-raio);
  background: color-mix(in srgb, var(--pv-item-mancha) 15%, var(--d-bg-alt));
  box-shadow: var(--pv-forma-sombra);
}
.pv[data-pv-investimento="gotas"] .pv-investimento-item:nth-child(3n + 2) { transform: translateY(1.8rem); }
.pv[data-pv-investimento="gotas"] .pv-investimento-item:last-child { grid-column: 1 / -1; width: 58%; justify-self: center; }
.pv[data-pv-investimento="gotas"] .pv-investimento-preco {
  order: -1;
  padding: 0;
  background: transparent;
  color: var(--pv-item-tinta);
  font-family: var(--d-display);
  font-size: clamp(2rem, 4vw, 4.25rem);
  line-height: 1;
}

.pv[data-pv-investimento="regua"] .pv-investimento-caixa { max-width: 72rem; }
.pv[data-pv-investimento="regua"] .pv-investimento-lista {
  position: relative;
  height: 25rem;
  margin-top: 5rem;
  border-top: 2px solid var(--d-text);
}
.pv[data-pv-investimento="regua"] .pv-investimento-lista::before,
.pv[data-pv-investimento="regua"] .pv-investimento-lista::after {
  content: "";
  position: absolute;
  top: -.5rem;
  width: 1px;
  height: 1rem;
  background: var(--d-text);
}
.pv[data-pv-investimento="regua"] .pv-investimento-lista::before { left: 0; }
.pv[data-pv-investimento="regua"] .pv-investimento-lista::after { right: 0; }
.pv[data-pv-investimento="regua"] .pv-investimento-item {
  position: absolute;
  left: calc(var(--pv-preco-pos) * 1%);
  top: 1.5rem;
  display: flex;
  width: clamp(8.5rem, 15vw, 12rem);
  padding: 1rem 0 0;
  border: 0;
  transform: translateX(-50%);
}
.pv[data-pv-investimento="regua"] .pv-investimento-item:nth-child(even) { top: 12.5rem; }
.pv[data-pv-investimento="regua"] .pv-investimento-item[data-preco-sem-valor="true"] {
  top: 7rem;
  left: 100%;
  transform: translateX(-100%);
}
.pv[data-pv-investimento="regua"] .pv-investimento-item::before {
  content: "";
  position: absolute;
  top: -2.05rem;
  left: 50%;
  width: .9rem;
  height: .9rem;
  border: .18rem solid var(--d-bg-alt);
  border-radius: 50%;
  background: var(--pv-item-tinta);
  box-shadow: 0 0 0 1px var(--pv-item-tinta);
}
.pv[data-pv-investimento="regua"] .pv-investimento-item:nth-child(even)::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 100%;
  width: 1px;
  height: 10.5rem;
  background: color-mix(in srgb, var(--pv-item-tinta) 45%, transparent);
}
.pv[data-pv-investimento="regua"] .pv-investimento-preco {
  order: -1;
  padding: 0;
  background: transparent;
  color: var(--pv-item-tinta);
}

.pv[data-pv-investimento="etiquetas"] .pv-investimento-lista {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4rem 1.5rem;
  padding-top: 3rem;
}
.pv[data-pv-investimento="etiquetas"] .pv-investimento-item {
  position: relative;
  min-height: 17rem;
  padding: 2.25rem 1.5rem 1.5rem;
  border: var(--pv-forma-borda);
  border-radius: var(--d-radius);
  background: var(--d-bg-elev);
  box-shadow: var(--pv-forma-sombra);
  transform: rotate(-2.5deg);
}
.pv[data-pv-investimento="etiquetas"] .pv-investimento-item:nth-child(even) { transform: rotate(2.5deg); }
.pv[data-pv-investimento="etiquetas"] .pv-investimento-item::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: calc(100% - .55rem);
  width: 1px;
  height: 4rem;
  background: var(--pv-item-tinta);
}
.pv[data-pv-investimento="etiquetas"] .pv-investimento-item::after {
  content: "";
  position: absolute;
  left: calc(50% - .35rem);
  top: .75rem;
  width: .7rem;
  height: .7rem;
  border: 1px solid var(--pv-item-tinta);
  border-radius: 50%;
  background: var(--d-bg-alt);
}
.pv[data-pv-investimento="etiquetas"] .pv-investimento-preco {
  order: -1;
  padding: .3rem 0 1rem;
  background: transparent;
  color: var(--pv-item-tinta);
  font-size: 1.15rem;
}

.pv[data-pv-investimento="selos"] .pv-investimento-lista { gap: 0; }
.pv[data-pv-investimento="selos"] .pv-investimento-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 7.5rem;
  align-items: center;
  gap: 1.5rem;
  min-height: 9rem;
  padding-block: 1.25rem;
}
.pv[data-pv-investimento="selos"] .pv-investimento-preco {
  display: grid;
  place-items: center;
  width: 7rem;
  height: 7rem;
  padding: .8rem;
  border: .2rem double var(--pv-item-tinta);
  border-radius: 50%;
  background: color-mix(in srgb, var(--pv-item-mancha) 10%, var(--d-bg-alt));
  color: var(--pv-item-tinta);
  text-align: center;
  white-space: normal;
  transform: rotate(3deg);
}

@media (max-width: 47.999rem) {
  .pv[data-pv-investimento="gotas"] .pv-investimento-lista { grid-template-columns: minmax(0, 1fr); }
  .pv[data-pv-investimento="gotas"] .pv-investimento-item,
  .pv[data-pv-investimento="gotas"] .pv-investimento-item:last-child {
    width: 100%;
    min-height: 15rem;
    grid-column: auto;
    transform: none;
  }
  .pv[data-pv-investimento="regua"] .pv-investimento-lista {
    height: auto;
    margin: 2.5rem 0 0 .5rem;
    padding-left: 1.5rem;
    border-top: 0;
    border-left: 2px solid var(--d-text);
  }
  .pv[data-pv-investimento="regua"] .pv-investimento-lista::before,
  .pv[data-pv-investimento="regua"] .pv-investimento-lista::after { display: none; }
  .pv[data-pv-investimento="regua"] .pv-investimento-item,
  .pv[data-pv-investimento="regua"] .pv-investimento-item:nth-child(even),
  .pv[data-pv-investimento="regua"] .pv-investimento-item[data-preco-sem-valor="true"] {
    position: relative;
    inset: auto;
    width: 100%;
    min-height: 0;
    padding: 0 0 2.5rem;
    transform: none;
  }
  .pv[data-pv-investimento="regua"] .pv-investimento-item::before {
    top: .2rem;
    left: -2.02rem;
  }
  .pv[data-pv-investimento="regua"] .pv-investimento-item::after { display: none; }
  .pv[data-pv-investimento="etiquetas"] .pv-investimento-lista {
    grid-template-columns: minmax(0, 1fr);
  }
  .pv[data-pv-investimento="etiquetas"] .pv-investimento-item { min-height: 14rem; }
  .pv[data-pv-investimento="selos"] .pv-investimento-item { grid-template-columns: minmax(0, 1fr) 6.2rem; }
  .pv[data-pv-investimento="selos"] .pv-investimento-preco { width: 6rem; height: 6rem; }
}

/* ── MANIFESTO ───────────────────────────────────────────────────────
   círculo: texto como núcleo dentro de um campo circular;
   grifo:   linhas frias de marca-texto atravessam a declaração;
   pilha:   manifesto sobre três folhas deslocadas;
   carta:   papel pautado com voz manuscrita. */
.pv .pv-manifesto-quadro { position: relative; }
.pv .pv-manifesto-texto { position: relative; z-index: 2; margin-inline: auto; }
.pv .pv-manifesto-folha,
.pv .pv-manifesto-marca { display: none; pointer-events: none; }

.pv[data-pv-manifesto="circulo"] .pv-manifesto-quadro {
  display: grid;
  place-items: center;
  width: min(88vw, 56rem);
  min-height: min(88vw, 56rem);
  margin-inline: auto;
  padding: clamp(3rem, 9vw, 8rem);
  border: var(--pv-forma-borda);
  border-radius: 50%;
  background: radial-gradient(circle at 34% 30%, color-mix(in srgb, var(--pv-mancha-1) 17%, transparent), transparent 45%),
              radial-gradient(circle at 68% 64%, color-mix(in srgb, var(--pv-mancha-2) 13%, transparent), transparent 48%);
}
.pv[data-pv-manifesto="circulo"] .pv-manifesto-texto { text-align: center; }

.pv[data-pv-manifesto="grifo"] .pv-manifesto-quadro {
  max-width: 76rem;
  margin-inline: auto;
  padding-block: clamp(2rem, 7vw, 6rem);
}
.pv[data-pv-manifesto="grifo"] .pv-manifesto-texto {
  margin-inline: 0;
  padding: 1.5rem 0;
  text-align: left;
}
.pv[data-pv-manifesto="grifo"] .pv-manifesto-texto [data-accent] {
  padding-inline: .08em;
  background: linear-gradient(transparent 58%, color-mix(in srgb, var(--pv-mancha-2) 32%, transparent) 58% 88%, transparent 88%);
}
.pv[data-pv-manifesto="grifo"] .pv-manifesto-marca {
  display: block;
  position: absolute;
  z-index: 1;
  left: -4%;
  right: 9%;
  top: 48%;
  height: clamp(1.25rem, 3vw, 2.4rem);
  background: color-mix(in srgb, var(--pv-mancha-1) 14%, transparent);
  transform: rotate(-1.2deg);
}

.pv[data-pv-manifesto="pilha"] .pv-manifesto-quadro {
  width: min(90%, 66rem);
  margin-inline: auto;
  padding: clamp(3rem, 8vw, 7rem);
  border: var(--pv-forma-borda);
  border-radius: var(--d-radius);
  background: var(--d-bg-elev);
  box-shadow: var(--pv-forma-sombra);
}
.pv[data-pv-manifesto="pilha"] .pv-manifesto-folha {
  display: block;
  position: absolute;
  inset: 0;
  z-index: 0;
  border: 1px solid var(--d-accent-2);
  border-radius: var(--d-radius);
  background: color-mix(in srgb, var(--pv-mancha-2) 8%, var(--d-bg-elev));
}
.pv[data-pv-manifesto="pilha"] .pv-manifesto-folha-a { transform: translate(-1.2rem, 1.1rem) rotate(-2deg); }
.pv[data-pv-manifesto="pilha"] .pv-manifesto-folha-b {
  background: color-mix(in srgb, var(--pv-mancha-3) 7%, var(--d-bg-elev));
  transform: translate(1.25rem, 1.8rem) rotate(2.5deg);
}
.pv[data-pv-manifesto="pilha"] .pv-manifesto-texto { text-align: center; }

.pv[data-pv-manifesto="carta"] .pv-manifesto-quadro {
  width: min(92%, 58rem);
  margin-inline: auto;
  padding: clamp(3.5rem, 8vw, 7rem) clamp(2rem, 8vw, 6rem);
  border: var(--pv-forma-borda);
  background-color: var(--d-bg-elev);
  background-image: repeating-linear-gradient(transparent 0 2.15rem, color-mix(in srgb, var(--pv-mancha-3) 16%, transparent) 2.15rem calc(2.15rem + 1px));
  box-shadow: var(--pv-forma-sombra);
  transform: rotate(-1deg);
}
.pv[data-pv-manifesto="carta"] .pv-manifesto-quadro::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: clamp(1.2rem, 4vw, 3.4rem);
  width: 1px;
  background: color-mix(in srgb, var(--pv-mancha-1) 42%, transparent);
}
.pv[data-pv-manifesto="carta"] .pv-manifesto-texto {
  font-family: var(--font-pv-manuscrita), var(--d-serif);
  font-size: clamp(2.2rem, 6vw, 5.25rem);
  line-height: 1.05;
}

@media (max-width: 47.999rem) {
  .pv[data-pv-manifesto="circulo"] .pv-manifesto-quadro {
    width: 100%;
    min-height: 33rem;
    padding: 3rem 2rem;
    border-radius: 48% 52% 46% 54% / 51% 44% 56% 49%;
  }
  .pv[data-pv-manifesto="pilha"] .pv-manifesto-quadro { width: 94%; padding: 3rem 1.5rem; }
  .pv[data-pv-manifesto="carta"] .pv-manifesto-quadro { width: 96%; padding: 3.5rem 2.2rem 3.5rem 3rem; }
}

/* ── ESTILOS ────────────────────────────────────────────────────────
   mostruário: cinco cartões iguais e o último invertido;
   bento:      uma peça dominante e quatro módulos;
   paleta:     discos pigmentados com o título dentro;
   baralho:    cartas manuscritas, giradas e sobrepostas. */
.pv .pv-estilo-numero { color: var(--pv-estilo-tinta); }
.pv .pv-estilo-texto { color: var(--d-muted); }

.pv[data-pv-estilos="mostruario"] .pv-estilos-lista {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}
.pv[data-pv-estilos="mostruario"] .pv-estilo-item:last-child .pv-estilo-cartao {
  background: var(--d-text);
  color: var(--d-bg);
  border-color: var(--d-text);
}
.pv[data-pv-estilos="mostruario"] .pv-estilo-item:last-child .pv-estilo-numero { color: var(--d-bg); }
.pv[data-pv-estilos="mostruario"] .pv-estilo-item:last-child .pv-estilo-texto { color: color-mix(in srgb, var(--d-bg) 72%, transparent); }

.pv[data-pv-estilos="bento"] .pv-estilos-lista {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: minmax(10rem, auto);
  gap: 1rem;
}
.pv[data-pv-estilos="bento"] .pv-estilo-item { grid-column: span 4; }
.pv[data-pv-estilos="bento"] .pv-estilo-item:first-child {
  grid-column: span 8;
  grid-row: span 2;
}
.pv[data-pv-estilos="bento"] .pv-estilo-cartao {
  min-height: 100%;
  border: var(--pv-forma-borda);
  border-radius: 0;
  background: color-mix(in srgb, var(--d-card-blob) 8%, var(--d-bg-alt));
}
.pv[data-pv-estilos="bento"] .pv-estilo-item:first-child .pv-estilo-titulo {
  max-width: 8ch;
  font-size: clamp(3rem, 7vw, 6rem);
}
.pv[data-pv-estilos="bento"] .d-estilo-card-escuro { color: var(--d-text); }

.pv[data-pv-estilos="paleta"] .pv-estilos-lista {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: start;
  gap: clamp(.75rem, 2vw, 1.5rem);
}
.pv[data-pv-estilos="paleta"] .pv-estilo-cartao {
  aspect-ratio: 1;
  min-height: 0;
  justify-content: center;
  padding: clamp(1rem, 2.5vw, 2rem);
  border: 1px solid var(--pv-estilo-tinta);
  border-radius: 50%;
  background: color-mix(in srgb, var(--d-card-blob) 18%, var(--d-bg-elev));
  color: var(--d-text);
  text-align: center;
}
.pv[data-pv-estilos="paleta"] .pv-estilo-cartao::before { display: none; }
.pv[data-pv-estilos="paleta"] .pv-estilo-numero {
  position: absolute;
  top: 18%;
  left: 50%;
  transform: translateX(-50%);
}
.pv[data-pv-estilos="paleta"] .pv-estilo-copy { position: static; }
.pv[data-pv-estilos="paleta"] .pv-estilo-titulo { margin: 0; font-size: clamp(1rem, 2.1vw, 2rem); }
.pv[data-pv-estilos="paleta"] .pv-estilo-texto { display: none; }
.pv[data-pv-estilos="paleta"] .d-estilo-card-escuro { color: var(--d-text); }

.pv[data-pv-estilos="baralho"] .pv-estilos-lista {
  display: flex;
  align-items: stretch;
  max-width: 68rem;
  margin-inline: auto;
  padding-block: 2.5rem;
}
.pv[data-pv-estilos="baralho"] .pv-estilo-item {
  flex: 1 1 0;
  min-width: 0;
  transform: rotate(-4deg);
  transform-origin: 50% 80%;
}
.pv[data-pv-estilos="baralho"] .pv-estilo-item + .pv-estilo-item { margin-left: -4%; }
.pv[data-pv-estilos="baralho"] .pv-estilo-item:nth-child(even) { transform: translateY(1.5rem) rotate(4deg); }
.pv[data-pv-estilos="baralho"] .pv-estilo-item:nth-child(3) { transform: translateY(-1rem) rotate(-1deg); }
.pv[data-pv-estilos="baralho"] .pv-estilo-cartao {
  min-height: 23rem;
  border: var(--pv-forma-borda);
  background: var(--d-bg-elev);
  color: var(--d-text);
  box-shadow: var(--pv-forma-sombra);
}
.pv[data-pv-estilos="baralho"] .pv-estilo-cartao::before { display: none; }
.pv[data-pv-estilos="baralho"] .pv-estilo-titulo {
  font-family: var(--font-pv-manuscrita), var(--d-display);
  font-size: clamp(1.8rem, 3vw, 3rem);
}
.pv[data-pv-estilos="baralho"] .d-estilo-card-escuro { color: var(--d-text); }

@media (max-width: 63.999rem) {
  .pv[data-pv-estilos="mostruario"] .pv-estilos-lista { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pv[data-pv-estilos="mostruario"] .pv-estilo-item:last-child { grid-column: 1 / -1; }
}
@media (max-width: 47.999rem) {
  .pv[data-pv-estilos="mostruario"] .pv-estilos-lista { grid-template-columns: minmax(0, 1fr); }
  .pv[data-pv-estilos="mostruario"] .pv-estilo-item:last-child { grid-column: auto; }
  .pv[data-pv-estilos="bento"] .pv-estilos-lista { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pv[data-pv-estilos="bento"] .pv-estilo-item,
  .pv[data-pv-estilos="bento"] .pv-estilo-item:first-child { grid-column: span 1; grid-row: auto; }
  .pv[data-pv-estilos="bento"] .pv-estilo-item:first-child { grid-column: 1 / -1; min-height: 22rem; }
  .pv[data-pv-estilos="paleta"] .pv-estilos-lista { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pv[data-pv-estilos="paleta"] .pv-estilo-item:last-child { grid-column: 1 / -1; width: 50%; justify-self: center; }
  .pv[data-pv-estilos="baralho"] .pv-estilos-lista { display: grid; grid-template-columns: minmax(0, 1fr); padding-inline: 1.5rem; }
  .pv[data-pv-estilos="baralho"] .pv-estilo-item,
  .pv[data-pv-estilos="baralho"] .pv-estilo-item:nth-child(even),
  .pv[data-pv-estilos="baralho"] .pv-estilo-item:nth-child(3) { transform: rotate(-2deg); }
  .pv[data-pv-estilos="baralho"] .pv-estilo-item:nth-child(even) { transform: rotate(2deg); }
  .pv[data-pv-estilos="baralho"] .pv-estilo-item + .pv-estilo-item { margin: -3rem 0 0; }
  .pv[data-pv-estilos="baralho"] .pv-estilo-cartao { min-height: 16rem; }
}

/* ── ARTISTAS ────────────────────────────────────────────────────────
   assinaturas: rabisco amplo desenhado sobre três colunas;
   monogramas:  iniciais em discos frios;
   bandeiras:   uma faixa pigmentada por artista;
   livro:       verbetes horizontais com rabisco na margem. */
.pv .pv-artista-monograma { display: none; }
.pv .pv-artista-cartao { height: 100%; }

.pv[data-pv-artistas="assinaturas"] .pv-artistas-lista {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.pv[data-pv-artistas="assinaturas"] .pv-artista-item { max-width: none; }
.pv[data-pv-artistas="assinaturas"] .pv-artista-rabisco { min-height: 10rem; }

.pv[data-pv-artistas="monogramas"] .pv-artistas-lista {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(1rem, 3vw, 3rem);
}
.pv[data-pv-artistas="monogramas"] .pv-artista-item { max-width: none; }
.pv[data-pv-artistas="monogramas"] .pv-artista-cartao { text-align: center; }
.pv[data-pv-artistas="monogramas"] .pv-artista-monograma {
  display: grid;
  place-items: center;
  width: clamp(8rem, 18vw, 14rem);
  aspect-ratio: 1;
  margin: 0 auto 2rem;
  border: var(--pv-forma-borda);
  border-radius: 50%;
  background: color-mix(in srgb, var(--pv-artista-mancha) 13%, var(--d-bg-alt));
  color: var(--pv-artista-tinta);
  font-family: var(--d-display);
  font-size: clamp(2.5rem, 6vw, 5rem);
  letter-spacing: -.08em;
}
.pv[data-pv-artistas="monogramas"] .pv-artista-rabisco { display: none; }

.pv[data-pv-artistas="bandeiras"] .pv-artistas-lista {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
}
.pv[data-pv-artistas="bandeiras"] .pv-artista-item { max-width: none; }
.pv[data-pv-artistas="bandeiras"] .pv-artista-cartao {
  display: flex;
  align-items: flex-end;
  min-height: 30rem;
  padding: clamp(1.5rem, 3vw, 3rem);
  border-left: 1px solid color-mix(in srgb, var(--pv-artista-tinta) 42%, transparent);
  background: linear-gradient(to bottom, color-mix(in srgb, var(--pv-artista-mancha) 64%, var(--d-bg-elev)), color-mix(in srgb, var(--pv-artista-mancha) 13%, var(--d-bg-elev)) 67%);
}
.pv[data-pv-artistas="bandeiras"] .pv-artista-rabisco { display: none; }
.pv[data-pv-artistas="bandeiras"] .pv-artista-copy {
  padding-top: 1.5rem;
  border-top: 2px solid var(--pv-artista-tinta);
}
.pv[data-pv-artistas="bandeiras"] .pv-artista-subtitulo { color: var(--pv-artista-tinta); }

.pv[data-pv-artistas="livro"] .pv-artistas-lista {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  max-width: 68rem;
  margin-inline: auto;
  gap: 0;
  border-top: 1px solid var(--d-text);
}
.pv[data-pv-artistas="livro"] .pv-artista-item { max-width: none; }
.pv[data-pv-artistas="livro"] .pv-artista-cartao {
  display: grid;
  grid-template-columns: 9rem minmax(10rem, .8fr) minmax(0, 1.4fr);
  align-items: center;
  gap: clamp(1rem, 3vw, 3rem);
  padding-block: 2rem;
  border-bottom: 1px solid var(--d-text);
}
.pv[data-pv-artistas="livro"] .pv-artista-rabisco {
  grid-column: 1;
  width: 7rem;
  margin: 0;
}
.pv[data-pv-artistas="livro"] .pv-artista-copy { display: contents; }
.pv[data-pv-artistas="livro"] .pv-artista-titulo {
  grid-column: 2;
  margin: 0;
  font-family: var(--font-pv-manuscrita), var(--d-display);
}
.pv[data-pv-artistas="livro"] .pv-artista-subtitulo,
.pv[data-pv-artistas="livro"] .pv-artista-texto { grid-column: 3; }
.pv[data-pv-artistas="livro"] .pv-artista-subtitulo { align-self: end; margin: 0 0 .35rem; }
.pv[data-pv-artistas="livro"] .pv-artista-texto { align-self: start; }

@media (max-width: 47.999rem) {
  .pv[data-pv-artistas="assinaturas"] .pv-artistas-lista,
  .pv[data-pv-artistas="monogramas"] .pv-artistas-lista,
  .pv[data-pv-artistas="bandeiras"] .pv-artistas-lista { grid-template-columns: minmax(0, 1fr); }
  .pv[data-pv-artistas="assinaturas"] .pv-artista-rabisco { min-height: 0; max-height: 12rem; }
  .pv[data-pv-artistas="monogramas"] .pv-artista-monograma { width: 10rem; }
  .pv[data-pv-artistas="bandeiras"] .pv-artista-cartao { min-height: 20rem; }
  .pv[data-pv-artistas="livro"] .pv-artista-cartao {
    grid-template-columns: 5rem minmax(0, 1fr);
    gap: .8rem 1.2rem;
  }
  .pv[data-pv-artistas="livro"] .pv-artista-rabisco { width: 4.5rem; grid-row: 1 / 4; }
  .pv[data-pv-artistas="livro"] .pv-artista-titulo,
  .pv[data-pv-artistas="livro"] .pv-artista-subtitulo,
  .pv[data-pv-artistas="livro"] .pv-artista-texto { grid-column: 2; }
}

/* ── DEPOIMENTOS ────────────────────────────────────────────────────
   bilhetes: papéis soltos presos por uma faixa de pigmento;
   conversa: balões alternados, como uma troca de mensagens;
   coro:     três vozes sem caixa, unidas numa faixa escura;
   caderno:  entradas pautadas em sequência. */
.pv .pv-depoimento { position: relative; border-radius: var(--d-radius); }
.pv .pv-depoimento-estrelas { color: var(--pv-depoimento-tinta); }

.pv[data-pv-depoimentos="bilhetes"] .pv-depoimentos-lista {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: stretch;
}
.pv[data-pv-depoimentos="bilhetes"] .pv-depoimento {
  min-height: 20rem;
  padding-top: 3rem;
  border: 1px solid color-mix(in srgb, var(--pv-depoimento-tinta) 20%, var(--d-border));
  border-radius: .25rem;
  background: color-mix(in srgb, var(--pv-depoimento-mancha) 7%, var(--d-bg-elev));
  box-shadow: var(--pv-forma-sombra);
  transform: rotate(-1.5deg);
}
.pv[data-pv-depoimentos="bilhetes"] .pv-depoimento:nth-child(even) { transform: translateY(1.5rem) rotate(1.5deg); }
.pv[data-pv-depoimentos="bilhetes"] .pv-depoimento::before {
  content: "";
  position: absolute;
  top: .8rem;
  left: 35%;
  width: 30%;
  height: 1.2rem;
  background: color-mix(in srgb, var(--pv-depoimento-mancha) 48%, transparent);
  transform: rotate(-2deg);
}

.pv[data-pv-depoimentos="conversa"] .pv-depoimentos-caixa { max-width: 58rem; }
.pv[data-pv-depoimentos="conversa"] .pv-depoimentos-lista {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.5rem;
}
.pv[data-pv-depoimentos="conversa"] .pv-depoimento {
  width: min(78%, 42rem);
  min-height: 0;
  padding: 1.5rem 2rem;
  border: 1px solid var(--pv-depoimento-tinta);
  border-radius: 1.4rem 1.4rem 1.4rem .2rem;
  background: color-mix(in srgb, var(--pv-depoimento-mancha) 9%, var(--d-bg-alt));
}
.pv[data-pv-depoimentos="conversa"] .pv-depoimento:nth-child(even) {
  align-self: flex-end;
  border-radius: 1.4rem 1.4rem .2rem 1.4rem;
  text-align: right;
}
.pv[data-pv-depoimentos="conversa"] .pv-depoimento-texto { font-family: var(--d-corpo); font-style: normal; }

.pv[data-pv-depoimentos="coro"] .pv-depoimentos-caixa { max-width: 78rem; }
.pv[data-pv-depoimentos="coro"] .pv-depoimentos-lista {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  border-block: 1px solid var(--d-accent);
}
.pv[data-pv-depoimentos="coro"] .pv-depoimento {
  min-height: 24rem;
  padding: clamp(1.5rem, 3.5vw, 3rem);
  border-right: 1px solid color-mix(in srgb, var(--d-accent-2) 42%, transparent);
  border-radius: 0;
  background: transparent;
}
.pv[data-pv-depoimentos="coro"] .pv-depoimento:last-child { border-right: 0; }
.pv[data-pv-depoimentos="coro"] .pv-depoimento:nth-child(2) { padding-top: 6rem; }
.pv[data-pv-depoimentos="coro"] .pv-depoimento-texto { font-size: clamp(1.25rem, 2.5vw, 2rem); }

.pv[data-pv-depoimentos="caderno"] .pv-depoimentos-caixa { max-width: 64rem; }
.pv[data-pv-depoimentos="caderno"] .pv-depoimentos-lista {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  padding: 1.5rem clamp(1.5rem, 5vw, 4rem);
  border: var(--pv-forma-borda);
  background-color: var(--d-bg-elev);
  background-image: repeating-linear-gradient(transparent 0 2.4rem, color-mix(in srgb, var(--pv-mancha-3) 13%, transparent) 2.4rem calc(2.4rem + 1px));
  box-shadow: var(--pv-forma-sombra);
}
.pv[data-pv-depoimentos="caderno"] .pv-depoimento {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  min-height: 12rem;
  padding: 2rem 0;
  border-bottom: 1px solid color-mix(in srgb, var(--d-text) 36%, transparent);
  border-radius: 0;
  background: transparent;
}
.pv[data-pv-depoimentos="caderno"] .pv-depoimento:last-child { border-bottom: 0; }
.pv[data-pv-depoimentos="caderno"] .pv-depoimento-texto {
  font-family: var(--font-pv-manuscrita), var(--d-serif);
  font-size: clamp(1.6rem, 3vw, 2.6rem);
  line-height: 1.05;
}
.pv[data-pv-depoimentos="caderno"] .pv-depoimento-autor { padding-left: 1.5rem; color: var(--pv-depoimento-tinta); }

@media (max-width: 47.999rem) {
  .pv[data-pv-depoimentos="bilhetes"] .pv-depoimentos-lista,
  .pv[data-pv-depoimentos="coro"] .pv-depoimentos-lista { grid-template-columns: minmax(0, 1fr); }
  .pv[data-pv-depoimentos="bilhetes"] .pv-depoimento:nth-child(n) { min-height: 15rem; transform: rotate(-1deg); }
  .pv[data-pv-depoimentos="bilhetes"] .pv-depoimento:nth-child(even) { transform: rotate(1deg); }
  .pv[data-pv-depoimentos="conversa"] .pv-depoimento { width: 88%; padding: 1.25rem; }
  .pv[data-pv-depoimentos="coro"] .pv-depoimento {
    min-height: 15rem;
    padding: 2rem 0;
    border-right: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--d-accent-2) 42%, transparent);
  }
  .pv[data-pv-depoimentos="coro"] .pv-depoimento:nth-child(2) { padding-top: 2rem; }
  .pv[data-pv-depoimentos="caderno"] .pv-depoimento { grid-template-columns: minmax(0, 1fr); }
  .pv[data-pv-depoimentos="caderno"] .pv-depoimento-autor { padding: 1rem 0 0; }
}

/* ── FAQ ─────────────────────────────────────────────────────────────
   acordeão: details nativo, primeiro item aberto;
   fichas:    cartões em duas colunas, respostas abertas;
   manchete:  pergunta grande e resposta pequena, todas abertas;
   respostas: versalete seguido de parágrafo corrido. */
.pv[data-pv-faq="acordeao"] .pv-faq-lista { border-color: var(--d-border); }

.pv[data-pv-faq="fichas"].pv-faq { max-width: 72rem; }
.pv[data-pv-faq="fichas"] .pv-faq-lista {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  border: 0;
}
.pv[data-pv-faq="fichas"] .pv-faq-item {
  min-height: 14rem;
  padding: 1.5rem;
  border: var(--pv-forma-borda);
  background: color-mix(in srgb, var(--pv-mancha-2) 6%, var(--d-bg-alt));
  box-shadow: var(--pv-forma-sombra);
}
.pv[data-pv-faq="fichas"] .pv-faq-pergunta { padding-block: 0 1rem; }
.pv[data-pv-faq="fichas"] .pv-faq-resposta { max-width: none; padding: 0; }
.pv[data-pv-faq="fichas"] .pv-faq-icone { display: none; }

.pv[data-pv-faq="manchete"].pv-faq { max-width: 78rem; }
.pv[data-pv-faq="manchete"] .pv-faq-lista { border-top: 0; }
.pv[data-pv-faq="manchete"] .pv-faq-item {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(16rem, .6fr);
  align-items: center;
  gap: clamp(2rem, 6vw, 7rem);
  padding-block: clamp(2rem, 5vw, 4rem);
  border-bottom: 1px solid var(--pv-faq-tinta);
}
.pv[data-pv-faq="manchete"] .pv-faq-pergunta { padding: 0; }
.pv[data-pv-faq="manchete"] .pv-faq-titulo {
  font-family: var(--d-display);
  font-size: clamp(2.2rem, 6vw, 5.8rem);
  line-height: .92;
  letter-spacing: -.04em;
}
.pv[data-pv-faq="manchete"] .pv-faq-ponto,
.pv[data-pv-faq="manchete"] .pv-faq-icone { display: none; }
.pv[data-pv-faq="manchete"] .pv-faq-resposta {
  max-width: 32ch;
  padding: 0;
  font-size: .95rem;
}

.pv[data-pv-faq="respostas"].pv-faq { max-width: 68rem; }
.pv[data-pv-faq="respostas"] .pv-faq-lista { border-top: 2px solid var(--d-text); }
.pv[data-pv-faq="respostas"] .pv-faq-item {
  display: grid;
  grid-template-columns: minmax(10rem, .55fr) minmax(0, 1.45fr);
  gap: clamp(1.5rem, 5vw, 5rem);
  padding-block: 1.75rem;
  border-bottom: 1px solid var(--d-text);
}
.pv[data-pv-faq="respostas"] .pv-faq-pergunta { padding: 0; }
.pv[data-pv-faq="respostas"] .pv-faq-titulo {
  font-family: var(--d-mono);
  font-size: .78rem;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
}
.pv[data-pv-faq="respostas"] .pv-faq-ponto,
.pv[data-pv-faq="respostas"] .pv-faq-icone { display: none; }
.pv[data-pv-faq="respostas"] .pv-faq-resposta {
  max-width: 58ch;
  padding: 0;
  color: var(--d-text);
}

@media (max-width: 47.999rem) {
  .pv[data-pv-faq="fichas"] .pv-faq-lista { grid-template-columns: minmax(0, 1fr); }
  .pv[data-pv-faq="fichas"] .pv-faq-item { min-height: 0; }
  .pv[data-pv-faq="manchete"] .pv-faq-item,
  .pv[data-pv-faq="respostas"] .pv-faq-item { grid-template-columns: minmax(0, 1fr); gap: 1rem; }
  .pv[data-pv-faq="manchete"] .pv-faq-titulo { font-size: clamp(2.35rem, 13vw, 4.5rem); }
}

/* ── PROCESSO ────────────────────────────────────────────────────────
   onda:       passos alternados dos dois lados de um traço contínuo;
   camadas:    quatro folhas de decalque em cascata;
   quadrinhos: painéis irregulares separados por calhas diagonais;
   ciclo:      anel com quatro nós e textos em volta. */
.pv .pv-processo-ciclo { display: none; }
.pv .pv-processo-item { --pv-passo-cor: var(--d-accent); --pv-passo-mancha: var(--pv-mancha-1); }
.pv .pv-processo-item:nth-child(3n + 2) { --pv-passo-cor: var(--d-accent-2); --pv-passo-mancha: var(--pv-mancha-2); }
.pv .pv-processo-item:nth-child(3n) { --pv-passo-cor: var(--d-accent-3); --pv-passo-mancha: var(--pv-mancha-3); }

.pv[data-pv-processo="onda"] .pv-processo-caixa { max-width: 74rem; }
.pv[data-pv-processo="onda"] .pv-processo-corpo { padding-block: 5.5rem; }
.pv[data-pv-processo="onda"] .pv-processo-onda {
  display: block;
  top: calc(50% - 1.9rem);
}
.pv[data-pv-processo="onda"] .pv-processo-lista {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(1.25rem, 3vw, 3rem);
}
.pv[data-pv-processo="onda"] .pv-processo-item:nth-child(odd) { transform: translateY(-4.5rem); }
.pv[data-pv-processo="onda"] .pv-processo-item:nth-child(even) { transform: translateY(4.5rem); }
.pv[data-pv-processo="onda"] .pv-processo-numero {
  background: var(--d-bg);
  box-shadow: 0 0 0 .5rem var(--d-bg);
}

.pv[data-pv-processo="camadas"] .pv-processo-caixa { max-width: 62rem; }
.pv[data-pv-processo="camadas"] .pv-processo-corpo { padding: 1rem 0 4rem; }
.pv[data-pv-processo="camadas"] .pv-processo-lista {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
}
.pv[data-pv-processo="camadas"] .pv-processo-item {
  position: relative;
  width: 72%;
  min-height: 13rem;
  padding: 2rem clamp(2rem, 5vw, 4rem);
  border: var(--pv-forma-borda);
  background: color-mix(in srgb, var(--pv-passo-mancha) 8%, var(--d-bg-elev));
  box-shadow: var(--pv-forma-sombra);
}
.pv[data-pv-processo="camadas"] .pv-processo-item + .pv-processo-item { margin-top: -3.6rem; }
.pv[data-pv-processo="camadas"] .pv-processo-item:nth-child(2) { margin-left: 9%; }
.pv[data-pv-processo="camadas"] .pv-processo-item:nth-child(3) { margin-left: 18%; }
.pv[data-pv-processo="camadas"] .pv-processo-item:nth-child(4) { margin-left: 27%; }
.pv[data-pv-processo="camadas"] .pv-processo-numero {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  border-radius: 0;
  background: transparent;
}
.pv[data-pv-processo="camadas"] .pv-processo-titulo { padding-right: 4.5rem; }

.pv[data-pv-processo="quadrinhos"] .pv-processo-caixa { max-width: 72rem; }
.pv[data-pv-processo="quadrinhos"] .pv-processo-lista {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: .7rem;
}
.pv[data-pv-processo="quadrinhos"] .pv-processo-item {
  min-height: 15rem;
  padding: clamp(1.5rem, 3vw, 2.75rem);
  border: 1px solid var(--pv-passo-cor);
  background: color-mix(in srgb, var(--pv-passo-mancha) 8%, var(--d-bg-elev));
  clip-path: polygon(4% 0, 100% 0, 96% 100%, 0 96%);
}
.pv[data-pv-processo="quadrinhos"] .pv-processo-item:nth-child(1),
.pv[data-pv-processo="quadrinhos"] .pv-processo-item:nth-child(4) { grid-column: span 7; }
.pv[data-pv-processo="quadrinhos"] .pv-processo-item:nth-child(2),
.pv[data-pv-processo="quadrinhos"] .pv-processo-item:nth-child(3) { grid-column: span 5; }
.pv[data-pv-processo="quadrinhos"] .pv-processo-item:nth-child(even) {
  clip-path: polygon(0 4%, 96% 0, 100% 96%, 5% 100%);
}
.pv[data-pv-processo="quadrinhos"] .pv-processo-numero {
  width: auto;
  height: auto;
  border: 0;
  border-radius: 0;
  background: transparent;
  font-size: clamp(2.5rem, 6vw, 5rem);
  line-height: .8;
}

.pv[data-pv-processo="ciclo"] .pv-processo-caixa { max-width: 68rem; }
.pv[data-pv-processo="ciclo"] .pv-processo-corpo { min-height: 42rem; }
.pv[data-pv-processo="ciclo"] .pv-processo-ciclo {
  display: block;
  position: absolute;
  inset: 50% auto auto 50%;
  width: min(62%, 38rem);
  transform: translate(-50%, -50%);
}
.pv[data-pv-processo="ciclo"] .pv-processo-lista {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: space-between;
  min-height: 42rem;
  gap: 11rem 16rem;
}
.pv[data-pv-processo="ciclo"] .pv-processo-item {
  position: relative;
  z-index: 1;
  padding: 1.25rem;
  background: var(--d-bg);
}
.pv[data-pv-processo="ciclo"] .pv-processo-numero {
  border-width: .2rem;
  border-style: double;
  background: color-mix(in srgb, var(--pv-passo-mancha) 13%, var(--d-bg));
}
.pv[data-pv-processo="ciclo"] .pv-processo-item:nth-child(even) { text-align: right; }
.pv[data-pv-processo="ciclo"] .pv-processo-item:nth-child(even) .pv-processo-numero { margin-left: auto; }

@media (max-width: 47.999rem) {
  .pv[data-pv-processo="onda"] .pv-processo-cabeca { margin-bottom: 4rem; }
  .pv[data-pv-processo="onda"] .pv-processo-corpo { padding-block: 0; }
  .pv[data-pv-processo="onda"] .pv-processo-onda {
    top: 0;
    left: 50%;
    width: 36rem;
    transform: rotate(90deg);
    transform-origin: 0 0;
  }
  .pv[data-pv-processo="onda"] .pv-processo-lista {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4.5rem 2rem;
  }
  .pv[data-pv-processo="onda"] .pv-processo-item:nth-child(n) { transform: none; }
  .pv[data-pv-processo="onda"] .pv-processo-item:nth-child(even) { margin-top: 6rem; }
  .pv[data-pv-processo="camadas"] .pv-processo-item {
    width: 88%;
    min-height: 13.5rem;
    padding: 1.5rem;
  }
  .pv[data-pv-processo="camadas"] .pv-processo-item + .pv-processo-item { margin-top: -2rem; }
  .pv[data-pv-processo="camadas"] .pv-processo-item:nth-child(2) { margin-left: 4%; }
  .pv[data-pv-processo="camadas"] .pv-processo-item:nth-child(3) { margin-left: 8%; }
  .pv[data-pv-processo="camadas"] .pv-processo-item:nth-child(4) { margin-left: 12%; }
  .pv[data-pv-processo="quadrinhos"] .pv-processo-lista { grid-template-columns: minmax(0, 1fr); }
  .pv[data-pv-processo="quadrinhos"] .pv-processo-item:nth-child(n) { grid-column: auto; min-height: 13rem; }
  .pv[data-pv-processo="ciclo"] .pv-processo-corpo { min-height: 0; }
  .pv[data-pv-processo="ciclo"] .pv-processo-ciclo {
    position: relative;
    inset: auto;
    width: 100%;
    margin-bottom: 2rem;
    transform: none;
  }
  .pv[data-pv-processo="ciclo"] .pv-processo-lista {
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;
    gap: 1rem;
  }
  .pv[data-pv-processo="ciclo"] .pv-processo-item:nth-child(n) { text-align: left; }
  .pv[data-pv-processo="ciclo"] .pv-processo-item:nth-child(n) .pv-processo-numero { margin-left: 0; }
}
`;
