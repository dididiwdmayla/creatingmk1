/** Uma árvore de seções, composições por knobs tipados. CSS sai no servidor.
 * Texturas são estáticas e locais; não usam a camada de efeitos/FPS da Forja. */
export const BARBEARIA_COMPOSICAO_CSS = `
.be { --be-textura:none; --be-title-size:clamp(3rem,8vw,6.5rem); }
.be section { background-image:var(--be-textura); }
.be [data-be-foto] { box-shadow:0 1rem 3rem color-mix(in srgb,var(--d-text) var(--be-sombra),transparent); }
.be img { filter:contrast(.98) saturate(var(--be-saturacao)); }
.be [data-d-secao] { scroll-margin-top:6rem; }
.be .be-hero-grid { grid-template-columns:minmax(0,1fr); }
.be .be-hero-copy { min-width:0; }
.be h1 { overflow-wrap:anywhere; }
.be .be-hero-photo { height:26rem; }
.be .be-quick-grid { grid-template-columns:minmax(0,1fr); }
.be .be-quick-photo { max-height:22rem; }
.be[data-be-textura="fibra"] { --be-textura:repeating-linear-gradient(94deg,transparent 0 6px,color-mix(in srgb,var(--d-text) 2%,transparent) 7px,transparent 8px); }
.be[data-be-textura="registro"] { --be-textura:linear-gradient(90deg,transparent calc(100% - 1px),color-mix(in srgb,var(--d-text) 3%,transparent) 0); }
.be[data-be-textura="registro"] section { background-size:4rem 100%; }
.be[data-be-textura="papel"] { --be-textura:radial-gradient(color-mix(in srgb,var(--d-text) 8%,transparent) .5px,transparent .7px); }
.be[data-be-textura="papel"] section { background-size:5px 5px; }
.be[data-be-textura="fosco"] { --be-textura:repeating-linear-gradient(0deg,transparent 0 3px,color-mix(in srgb,var(--d-text) 2%,transparent) 4px); }
.be[data-be-moldura="dupla"] [data-be-foto] { border:1px solid var(--d-border); outline:1px solid var(--d-border); outline-offset:.4rem; }
.be[data-be-equipe="perfis"] .be-team-card { padding:0 0 1.5rem;border:0;border-bottom:1px solid var(--d-border);background:transparent;box-shadow:none; }
.be[data-be-equipe="perfis"] .be-team-card > :last-child { padding:0; }
.be[data-be-filosofia="linhas"] .be-pillars { grid-template-columns:1fr;gap:0; }
.be[data-be-filosofia="linhas"] .be-pillars > div { padding:1.5rem 0;border-top:1px solid var(--d-border); }
.be[data-be-abertura="urbana"] { --be-title-size:clamp(3rem,6.5vw,5.8rem); }
.be[data-be-abertura="urbana"] .be-hero { min-height:0;padding-bottom:3rem; }
.be[data-be-abertura="urbana"] .be-hero-copy { gap:1.5rem; }
.be[data-be-abertura="urbana"] .be-hero-photo { height:20rem; }
.be[data-be-abertura="urbana"] .be-hero-stars { margin-top:0; }
.be[data-be-abertura="urbana"] .be-service-row { padding-block:1rem; }
.be[data-be-abertura="urbana"] .be-quick { padding-block:2.5rem; }
.be[data-be-abertura="urbana"] .be-quick-photo { max-height:15rem; }
.be[data-be-abertura="almanaque"] { --be-title-size:clamp(2.5rem,5vw,4.5rem); }
.be[data-be-abertura="almanaque"] .be-hero { padding-bottom:3.5rem; }
.be[data-be-abertura="almanaque"] h1 { line-height:1.06;letter-spacing:-.045em;filter:none; }
.be[data-be-abertura="almanaque"] .be-hero-photo { height:24rem; }
.be[data-be-abertura="almanaque"] .be-quick { background-color:var(--d-bg);border-block:double 3px var(--d-border); }
.be[data-be-abertura="almanaque"] .be-quick-photo { max-height:15rem; }
.be[data-be-abertura="salao"] { --be-title-size:clamp(3.2rem,7vw,6rem); }
.be[data-be-abertura="salao"] .be-hero { padding-bottom:3.5rem; }
.be[data-be-abertura="salao"] .be-hero-copy { align-items:center;text-align:center;border-block:double 3px var(--d-border);padding-block:2.5rem; }
.be[data-be-abertura="salao"] .be-hero-photo { height:28rem; }
.be[data-be-abertura="salao"] .be-ritual p { font-size:clamp(2rem,4vw,3.6rem);max-width:20ch; }
.be[data-be-abertura="salao"] .be-quick { padding-block:3rem;background-color:var(--d-bg-alt); }
.be[data-be-abertura="salao"] .be-quick-photo { max-height:16rem; }
.be .be-service-row > div { min-width:0; }
.be .be-service-row h3 { overflow-wrap:anywhere; }
.be .be-service-row [data-demo-slot$=".preco"] { flex-shrink:0; }
@media(min-width:768px) {
 .be .be-hero-grid { grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr); }
 .be .be-quick-grid { grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr); }
 .be .be-hero-photo { height:38rem; }
 .be[data-be-abertura="urbana"] .be-hero-grid { grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:2.5rem; }
 .be[data-be-abertura="urbana"] .be-hero-photo { height:26rem; }
 .be[data-be-abertura="urbana"] .be-hero { min-height:40rem; }
 .be[data-be-abertura="almanaque"] .be-hero-grid { grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:4rem; }
 .be[data-be-abertura="almanaque"] .be-hero-photo { order:-1;height:33rem; }
 .be[data-be-abertura="salao"] .be-hero-grid { grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:4rem; }
 .be[data-be-abertura="salao"] .be-hero-photo { height:35rem; }
 .be[data-be-servicos="tabela"] .be-services-grid { grid-template-columns:1fr; }
 .be[data-be-servicos="tabela"] .be-services-grid > div { grid-column:auto; }
 .be[data-be-servicos="tabela"] .be-services-heading { position:static;display:grid;grid-template-columns:minmax(0,1fr) 15rem;align-items:center; }
 .be[data-be-servicos="tabela"] .be-services-photo { aspect-ratio:2/1; }
 .be[data-be-servicos="tabela"] .be-service-list { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:3rem; }
 .be[data-be-equipe="perfis"] .be-team-card { display:grid;grid-template-columns:7rem minmax(0,1fr);gap:1.5rem;align-items:start; }
 .be[data-be-equipe="perfis"] .be-team-grid { grid-template-columns:1fr; }
 .be[data-be-equipe="perfis"] .be-team-photo { margin:0;aspect-ratio:3/4; }
 .be[data-be-filosofia="linhas"] .be-pillars > div { display:grid;grid-template-columns:3rem minmax(8rem,.6fr) minmax(0,1.4fr);gap:2rem;align-items:baseline; }
}
@media(max-width:767px) {
 .be { --d-sec-y:4rem; }
 .be[data-be-abertura="urbana"] { --d-sec-y:2.75rem; }
 .be[data-be-abertura="almanaque"],.be[data-be-abertura="salao"] { --d-sec-y:4.75rem; }
 .be .be-hero { min-height:0;padding-top:6rem; }
 .be .be-hero-copy { margin-top:1rem; }
 .be .be-hero-grid { gap:2.5rem; }
 .be .be-quick { padding-block:2.5rem; }
 .be .be-quick-photo { max-height:13rem;aspect-ratio:16/9; }
 .be .be-hero-stars { margin-top:0; }
 .be .d-cta { font-size:1rem;padding:1rem 1.25rem; }
 .be header a:first-child { font-size:clamp(1.05rem,5vw,1.5rem);max-width:100%; }
}
`;
