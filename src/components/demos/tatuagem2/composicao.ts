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
`;
