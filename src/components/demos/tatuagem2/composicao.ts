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
`;
